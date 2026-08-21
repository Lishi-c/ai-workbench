# 月蓝琉璃工作台（Moonblue Glass Workbench）

本地优先的个人工作台桌面应用，一站式管理任务、财务、健康、日记、专注、英语学习、图书与便签笔记。**数据全部存本机文件，无后端、无云端、无需联网。**

## 特性

- 📋 任务与日程：任务（可重复）、日程（固定时间/地点/时长），周视图
- 💰 收支记账：预算、分类图表、近 6 月趋势，支持微信/支付宝账单 CSV 导入
- ❤️ 健康管理：步数 / 睡眠 / 心率 / 饮水记录
- 📔 心情日记：心情打卡 + 心情日历，Markdown 编辑
- ⏱️ 专注（番茄钟）：25/45/60 分钟，可关联任务
- 🔤 英语学习：间隔重复（Spaced Repetition）背单词
- 📚 图书库：导入 TXT/Markdown，读书笔记与划线
- 📝 便签笔记：导入 TXT/Markdown/JSON，拖拽排序
- 🎉 节日标记：心情日历 + 周视图自动标农历/阳历节日与调休补班
- 🔔 提醒：到点 / 提前提醒，系统通知 + 开机自启 + 托盘常驻
- 🌙 深色模式、字体缩放、`Ctrl+K` 全局命令面板
- 💾 自动备份（退出时 + 每天），数据损坏自动从备份恢复

## 技术栈

Vite + React 18 + TypeScript，UI 用 Radix + shadcn 风格组件 + Tailwind CSS。打包为 **Electron 便携版 exe**（Windows）。

## 数据存储

数据存系统用户数据目录 `%APPDATA%\月蓝琉璃工作台\`：

- `workbench-data.json` — 主数据（元信息）
- `content/` — 图书/笔记正文（大文本拆分存储）
- `backups/` — 自动备份（保留最近 10 份）

换电脑迁移：应用内「数据备份」导出 JSON → 新电脑「数据备份」导入。

## 本地开发

```bash
npm install          # 安装依赖（Node 18+）
npx vite --host 127.0.0.1 --port 5173   # 起开发服务器
npx electron .       # Electron 调试
npm run build:web    # 构建前端产物
npm test             # 单测（账单 CSV 解析）
npm run dist         # 打包便携版 exe（版本号自动 +1）
```

> 打包注意：`npm run dist` 前先停掉正在跑的 vite 开发服务器；国内需设镜像：
>
> ```bash
> ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
> ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
> ```

## 目录结构

```
├── src/                 # React 前端源码
│   └── workbench/       # 工作台核心（context/storage/pages/overlays 等）
│       └── pages/       # 各页面（dashboard/tasks/finance/… 10 个页面）
├── electron/            # Electron 主进程（本地 HTTP 服务 + 数据读写/备份/提醒）
├── scripts/             # 打包辅助脚本（版本号 bump、清理、图标生成）
├── build/               # 应用图标源文件
└── electron-builder.yml # 打包配置
```

## 隐私

应用完全本地运行：无后端、无遥测、不上传任何个人数据。仅「调休」功能会向 `timor.tech` 拉取节假日数据（请求只含年份、不含个人数据，失败静默降级为只显示传统节日）。
