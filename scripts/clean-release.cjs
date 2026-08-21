// 清理 release/ 里的旧打包产物：只保留最新 N 个版本号 exe，删除其余 exe 和 nsis.7z
// 被系统进程锁定的文件会跳过并提示（重启电脑后再跑一次即可删干净）
const fs = require("fs");
const path = require("path");

const releaseDir = path.join(__dirname, "..", "release");
const KEEP = 2; // 保留最新 2 个版本

if (!fs.existsSync(releaseDir)) { console.log("release 目录不存在"); process.exit(0); }

const versioned = [];
const others = [];
for (const name of fs.readdirSync(releaseDir)) {
  if (/^月蓝琉璃工作台-v[\d.]+\.exe$/.test(name)) versioned.push(name);
  else if (/\.exe$/.test(name) || /\.7z$/.test(name)) others.push(name);
}

versioned.sort((a, b) => {
  const va = a.match(/v([\d.]+)\.exe$/)[1].split(".").map(Number);
  const vb = b.match(/v([\d.]+)\.exe$/)[1].split(".").map(Number);
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    const d = (va[i] || 0) - (vb[i] || 0);
    if (d) return d;
  }
  return 0;
});

const keep = new Set(versioned.slice(-KEEP));
const toDelete = [...versioned.filter((e) => !keep.has(e)), ...others];

let deleted = 0;
const locked = [];
for (const name of toDelete) {
  const file = path.join(releaseDir, name);
  try {
    fs.rmSync(file, { force: true });
    console.log(`已删除 ${name}`);
    deleted++;
  } catch {
    locked.push(name);
  }
}

// 删除中间产物目录（每次打包都会重新生成）
for (const dir of ["win-unpacked"]) {
  const p = path.join(releaseDir, dir);
  if (fs.existsSync(p)) {
    try {
      fs.rmSync(p, { recursive: true, force: true });
      console.log(`已删除 ${dir}/`);
      deleted++;
    } catch {
      locked.push(`${dir}/`);
    }
  }
}

console.log(`\n清理完成：删除 ${deleted} 个文件，保留 ${[...keep].join("、")}`);
if (locked.length) console.log(`以下文件被占用，重启电脑后再跑 npm run clean:release 即可删除：\n${locked.join("\n")}`);
