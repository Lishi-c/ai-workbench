// 自动截图各页面到 docs/screenshots/，供 README 使用
// 使用前先启动 vite 开发服务器：npx vite --host 127.0.0.1 --port 5173
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:5173";
const OUT = "docs/screenshots";

const pages = [
  ["dashboard", "dashboard.png"],
  ["tasks", "tasks.png"],
  ["finance", "finance.png"],
  ["health", "health.png"],
  ["diary", "diary.png"],
  ["focus", "focus.png"],
  ["english", "english.png"],
  ["library", "library.png"],
  ["notes", "notes.png"],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

  // 首次加载，等应用就绪
  await page.goto(BASE, { timeout: 30000 });
  await page.waitForSelector(".workbench-app", { timeout: 20000 });
  await page.waitForTimeout(2500);

  for (const [key, file] of pages) {
    await page.goto(`${BASE}/#${key}`, { timeout: 30000 });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${OUT}/${file}` });
    console.log(`✓ ${file}`);
  }

  // 节日标记：翻到 10 月（国庆节）让节日标签更明显
  try {
    await page.goto(`${BASE}/#diary`, { timeout: 30000 });
    await page.waitForTimeout(1500);
    for (let i = 0; i < 2; i++) {
      await page.locator('button[aria-label="下个月"]').first().click();
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/festival.png` });
    console.log("✓ festival.png");
  } catch (err) {
    await page.goto(`${BASE}/#diary`, { timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/festival.png` });
    console.log("✓ festival.png（降级为当前月）");
  }

  // 深色模式：给工作台根节点加 dark class
  await page.goto(`${BASE}/#dashboard`, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.querySelector(".workbench-app")?.classList.add("dark"));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/dark.png` });
  console.log("✓ dark.png");

  await browser.close();
  console.log("全部截图完成");
})();
