const { app, BrowserWindow, shell, Tray, Menu, nativeImage, Notification } = require("electron");
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// 应用名（决定 userData 目录名，需在读取 userData 之前设置）
app.setName("月蓝琉璃工作台");
// Windows 通知需要有效的 AppUserModelID（对应 electron-builder 的 appId）
app.setAppUserModelId("com.lumi.workbench");

const HOST = "127.0.0.1";
const MAX_BACKUPS = 10;
// 每次启动随机生成，前端请求 /api/* 时需携带，防止本机其它进程读写数据
const AUTH_TOKEN = crypto.randomBytes(32).toString("hex");

// 静态资源目录：开发时是项目 dist/，打包后是 asar 内的 dist/
const DIST = path.join(__dirname, "..", "dist");

// 数据文件：存放在系统用户数据目录，exe 可随意移动不丢数据
function dataFile() {
  return path.join(app.getPath("userData"), "workbench-data.json");
}

// 大块内容（图书/笔记正文）单独存放的目录与文件
function contentDir() {
  return path.join(app.getPath("userData"), "content");
}

function contentFile(type, id) {
  return path.join(contentDir(), `${type}-${id}.txt`);
}

function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 首次运行迁移：把原项目 data/ 里的历史数据复制过来（仅当目标不存在）
function migrateData() {
  const target = dataFile();
  if (fs.existsSync(target)) return;
  const candidates = [
    path.join(__dirname, "..", "data", "workbench-data.json"),
    path.join(process.cwd(), "data", "workbench-data.json"),
  ];
  for (const legacy of candidates) {
    if (fs.existsSync(legacy)) {
      try {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(legacy, target);
      } catch (err) {
        console.error("数据迁移失败：", err);
      }
      return;
    }
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
};

function readData() {
  const file = dataFile();
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

function writeData(value) {
  const file = dataFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // 先写临时文件再原子替换，避免写一半崩溃损坏 JSON
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf-8");
  fs.renameSync(tmp, file);
}

// 校验写入数据的最小结构，防止前端 bug / 坏数据写坏文件
function isValidData(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  for (const key of ["tasks", "schedule", "books", "documents"]) {
    if (value[key] !== undefined && !Array.isArray(value[key])) return false;
  }
  return true;
}

// 从新到旧找第一份能解析的备份目录
function latestValidBackupDir() {
  const backupRoot = path.join(app.getPath("userData"), "backups");
  if (!fs.existsSync(backupRoot)) return null;
  const dirs = fs.readdirSync(backupRoot).filter((d) => d.startsWith("backup-")).sort().reverse();
  for (const name of dirs) {
    const dir = path.join(backupRoot, name);
    const jsonPath = path.join(dir, "workbench-data.json");
    if (!fs.existsSync(jsonPath)) continue;
    try { JSON.parse(fs.readFileSync(jsonPath, "utf-8")); return dir; } catch { /* 这份坏了，试更旧的 */ }
  }
  return null;
}

// 数据文件损坏时自动从最近备份恢复（保留损坏文件供人工抢救）
function restoreFromBackup() {
  const dir = latestValidBackupDir();
  if (!dir) return false;
  try {
    const file = dataFile();
    if (fs.existsSync(file)) fs.renameSync(file, `${file}.corrupt-${Date.now()}`);
    writeData(JSON.parse(fs.readFileSync(path.join(dir, "workbench-data.json"), "utf-8")));
    const backupContent = path.join(dir, "content");
    if (fs.existsSync(backupContent)) {
      fs.rmSync(contentDir(), { recursive: true, force: true });
      fs.cpSync(backupContent, contentDir(), { recursive: true });
    }
    return true;
  } catch (err) {
    console.error("从备份恢复失败：", err);
    return false;
  }
}

// 供前端 GET 使用：区分「文件不存在」与「损坏」，损坏时先恢复再返回
function readDataForClient() {
  const file = dataFile();
  if (!fs.existsSync(file)) return { data: null, restored: false };
  try {
    return { data: JSON.parse(fs.readFileSync(file, "utf-8")), restored: false };
  } catch {
    if (restoreFromBackup()) {
      try {
        return { data: JSON.parse(fs.readFileSync(file, "utf-8")), restored: true };
      } catch { /* 恢复后仍读不到，按缺失处理 */ }
    }
    return { data: null, restored: false };
  }
}

// ── 一、自动备份：退出时 + 每天一份，保留最近 10 份 ─────────────────────
function backupData() {
  try {
    const file = dataFile();
    if (!fs.existsSync(file)) return;
    const backupRoot = path.join(app.getPath("userData"), "backups");
    fs.mkdirSync(backupRoot, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 23);
    const backupDir = path.join(backupRoot, `backup-${stamp}`);
    fs.mkdirSync(backupDir, { recursive: true });
    fs.copyFileSync(file, path.join(backupDir, "workbench-data.json"));
    const cdir = contentDir();
    if (fs.existsSync(cdir)) {
      fs.cpSync(cdir, path.join(backupDir, "content"), { recursive: true });
    }
    const dirs = fs.readdirSync(backupRoot).filter((d) => d.startsWith("backup-")).sort();
    while (dirs.length > MAX_BACKUPS) {
      fs.rmSync(path.join(backupRoot, dirs.shift()), { recursive: true, force: true });
    }
  } catch (err) {
    console.error("自动备份失败：", err);
  }
}

let lastBackupDate = "";
function dailyBackup() {
  const today = dateKey();
  if (lastBackupDate === today) return;
  lastBackupDate = today;
  backupData();
}

// ── 二、内容拆分：正文存到单独文件，主 JSON 只留元信息 + preview ────────
function splitContent(value) {
  for (const book of value.books ?? []) {
    if (book.content) {
      writeContent("book", book.id, book.content);
      book.preview = book.content.slice(0, 200);
      book.content = "";
    }
  }
  for (const doc of value.documents ?? []) {
    if (doc.content) {
      writeContent("doc", doc.id, doc.content);
      doc.preview = doc.content.slice(0, 200);
      doc.content = "";
    }
  }
}

function readContent(type, id) {
  const file = contentFile(type, id);
  if (!file || !id || !fs.existsSync(file)) return "";
  try {
    return fs.readFileSync(file, "utf-8");
  } catch {
    return "";
  }
}

function writeContent(type, id, content) {
  fs.mkdirSync(contentDir(), { recursive: true });
  const file = contentFile(type, id);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, content, "utf-8");
  fs.renameSync(tmp, file);
}

// 老数据（正文还嵌在 JSON 里）首次启动时拆出来，先备份再拆
function migrateContentSplit() {
  const data = readData();
  if (!data) return;
  const hasEmbedded = (data.books ?? []).some((b) => b.content) || (data.documents ?? []).some((d) => d.content);
  if (!hasEmbedded) return;
  backupData();
  splitContent(data);
  writeData(data);
}

// ── 节假日调休：每年从 timor.tech 拉一次缓存到本地，断网静默降级 ──────────
function holidayFile(year) {
  return path.join(app.getPath("userData"), `holidays-${year}.json`);
}

async function ensureHolidays(year) {
  const file = holidayFile(year);
  if (fs.existsSync(file)) {
    try { return JSON.parse(fs.readFileSync(file, "utf-8")); } catch { /* 缓存损坏则重拉 */ }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`https://timor.tech/api/holiday/year/${year}`, { signal: controller.signal });
    const json = await res.json();
    if (json && json.code === 0 && json.holiday && typeof json.holiday === "object") {
      const map = {};
      for (const [md, v] of Object.entries(json.holiday)) {
        map[`${year}-${md}`] = { holiday: Boolean(v.holiday), name: String(v.name || "") };
      }
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(map, null, 2), "utf-8");
      return map;
    }
  } catch (err) {
    console.error("节假日拉取失败：", err);
  } finally {
    clearTimeout(timer);
  }
  return {};
}

function handleApi(req, res) {
  if (req.headers["x-auth-token"] !== AUTH_TOKEN) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }
  const url = req.url || "";

  if (url.startsWith("/api/workbench-data")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (req.method === "GET") {
      const result = readDataForClient();
      res.end(JSON.stringify({ data: result.data, restored: result.restored }));
    } else if (req.method === "PUT") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          if (!isValidData(parsed)) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "invalid data" }));
            return;
          }
          splitContent(parsed);
          writeData(parsed);
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "invalid json" }));
        }
      });
    } else {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "method not allowed" }));
    }
    return;
  }

  if (url.startsWith("/api/content")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    const params = new URLSearchParams(url.split("?")[1] || "");
    const type = params.get("type");
    const id = params.get("id");
    if (req.method === "GET") {
      res.end(JSON.stringify({ content: readContent(type, id) }));
    } else if (req.method === "PUT") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          writeContent(type, id, parsed.content ?? "");
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "invalid json" }));
        }
      });
    } else {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "method not allowed" }));
    }
  }

  if (url.startsWith("/api/holidays")) {
    const params = new URLSearchParams(url.split("?")[1] || "");
    const year = Number(params.get("year")) || new Date().getFullYear();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    ensureHolidays(year).then((map) => res.end(JSON.stringify({ holiday: map })));
    return;
  }
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(DIST, safePath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, "index.html");
  }
  const ext = path.extname(filePath).toLowerCase();
  res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
  if (ext === ".html") {
    // CSP：禁外部脚本/请求，放行菜谱图外链；配合前端 DOMPurify 双保险
    res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data: https://*.cdn.bcebos.com; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:; connect-src 'self'");
  }
  fs.createReadStream(filePath).pipe(res);
}

function startServer() {
  const server = http.createServer((req, res) => {
    const url = req.url || "";
    if (url.startsWith("/api/")) {
      handleApi(req, res);
    } else {
      serveStatic(req, res);
    }
  });
  return new Promise((resolve) => {
    server.listen(0, HOST, () => resolve(server));
  });
}

// ── 三、托盘 + 最小化到托盘 + 开机自启 + 系统通知 ────────────────────────
let mainWindow = null;
let tray = null;
let isQuitting = false;
let appUrl = "";

// 运行时图标：打包后随 electron/ 一起进入 asar，供窗口与托盘使用
function appIcon() {
  return nativeImage.createFromPath(path.join(__dirname, "icon.png"));
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 640,
    title: "月蓝琉璃工作台",
    icon: appIcon(),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL(url);
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: "deny" };
  });
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function showWindow() {
  if (!mainWindow) {
    createWindow(appUrl);
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  // Windows 上 hidden 的窗口 show() 后可能不置顶，用一次「置顶再取消」强制拉到前台
  mainWindow.setAlwaysOnTop(true);
  mainWindow.setAlwaysOnTop(false);
}

function createTray() {
  const icon = appIcon();
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 }));
  tray.setToolTip("月蓝琉璃工作台");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "打开工作台", click: () => showWindow() },
    { type: "separator" },
    { label: "退出", click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray.on("click", () => showWindow());
}

function showStartupReminder() {
  try {
    const data = readData();
    if (!data) return;
    const today = dateKey();
    const taskCount = (data.tasks ?? []).filter((t) => t.date === today && !t.done).length;
    const scheduleCount = (data.schedule ?? []).filter((s) => s.date === today).length;
    if (taskCount + scheduleCount > 0) {
      const parts = [];
      if (taskCount > 0) parts.push(`${taskCount} 件待办`);
      if (scheduleCount > 0) parts.push(`${scheduleCount} 项日程`);
      new Notification({ title: "月蓝琉璃工作台", body: `今天还有 ${parts.join("、")}` }).show();
    }
  } catch (err) {
    console.error("提醒失败：", err);
  }
}

// 已提醒去重：按天持久化到文件，跨天自动重置，重启不重复弹、也不会无限增长
function notifiedFile() {
  return path.join(app.getPath("userData"), "notified.json");
}

let notifiedDate = "";
let notifiedIds = new Set();

function loadNotified(today) {
  notifiedDate = today;
  notifiedIds = new Set();
  try {
    const file = notifiedFile();
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
      const ids = parsed && typeof parsed === "object" ? parsed[today] : undefined;
      if (Array.isArray(ids)) for (const id of ids) notifiedIds.add(String(id));
    }
  } catch { /* 忽略，视为空 */ }
}

function persistNotified() {
  try {
    fs.writeFileSync(notifiedFile(), JSON.stringify({ [notifiedDate]: [...notifiedIds] }, null, 2), "utf-8");
  } catch { /* 忽略写失败 */ }
}

// 追赶提醒只补「最近 30 分钟」内的，其余靠开机汇总兜底，避免深夜补早上的提醒
const CATCHUP_WINDOW_MIN = 30;

function minutesOfDay(hm) {
  const [h, m] = String(hm || "").split(":").map((n) => Number(n) || 0);
  return h * 60 + m;
}

function checkReminders() {
  try {
    const now = new Date();
    const today = dateKey(now);
    if (today !== notifiedDate) loadNotified(today);
    const data = readData();
    if (!data) return;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const advance = Number(data.settings?.reminderAdvanceMinutes) || 0;
    let changed = false;
    for (const t of data.tasks ?? []) {
      if (t.date === today && !t.done && t.time && !notifiedIds.has(t.id)) {
        const trigger = minutesOfDay(t.time) - advance;
        if (nowMin >= trigger && nowMin - trigger <= CATCHUP_WINDOW_MIN) {
          notifiedIds.add(t.id);
          new Notification({ title: "待办提醒", body: `${t.time} · ${t.title}` }).show();
          changed = true;
        }
      }
    }
    for (const s of data.schedule ?? []) {
      const key = `s-${s.id}`;
      if (s.date === today && s.time && !notifiedIds.has(key)) {
        const trigger = minutesOfDay(s.time) - advance;
        if (nowMin >= trigger && nowMin - trigger <= CATCHUP_WINDOW_MIN) {
          notifiedIds.add(key);
          new Notification({ title: "日程提醒", body: `${s.time} · ${s.title}` }).show();
          changed = true;
        }
      }
    }
    if (changed) persistNotified();
  } catch (err) {
    // 忽略读取/提醒错误
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => showWindow());

  app.whenReady().then(async () => {
    migrateData();
    migrateContentSplit();
    dailyBackup();
    loadNotified(dateKey());
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true });

    const server = await startServer();
    const addr = server.address();
    appUrl = `http://${HOST}:${addr.port}/?t=${AUTH_TOKEN}`;

    createTray();
    createWindow(appUrl);

    // 开机提示 + 每分钟检查一次到点提醒
    setTimeout(showStartupReminder, 3000);
    setInterval(checkReminders, 60 * 1000);
    setInterval(dailyBackup, 60 * 60 * 1000);

    app.on("activate", () => showWindow());
  });

  app.on("before-quit", () => {
    isQuitting = true;
    backupData();
  });
}
