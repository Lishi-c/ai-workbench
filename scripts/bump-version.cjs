// 打包前自动递增补丁版本号，让 electron-builder 每次都产出新文件名，避免覆盖被锁定的旧 exe
const fs = require("fs");
const path = require("path");

const pkgPath = path.join(__dirname, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
const [major, minor, patch] = pkg.version.split(".").map((n) => Number(n) || 0);
pkg.version = `${major}.${minor}.${patch + 1}`;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8");
console.log(`版本号已更新：${pkg.version}`);
