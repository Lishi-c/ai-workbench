import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "path";
import fs from "fs";

// 数据文件路径：数据保存在项目 data/ 文件夹里的 JSON 文件，跨浏览器共享
const DATA_FILE = path.resolve(__dirname, "data", "workbench-data.json");

function workbenchDataPlugin() {
  return {
    name: "workbench-data",
    configureServer(server: any) {
      server.middlewares.use("/api/workbench-data", (req: any, res: any) => {
        res.setHeader("Content-Type", "application/json");
        if (req.method === "GET") {
          try {
            if (fs.existsSync(DATA_FILE)) {
              const raw = fs.readFileSync(DATA_FILE, "utf-8");
              res.end(JSON.stringify({ data: JSON.parse(raw) }));
            } else {
              res.end(JSON.stringify({ data: null }));
            }
          } catch {
            res.end(JSON.stringify({ data: null }));
          }
        } else if (req.method === "PUT") {
          let body = "";
          req.on("data", (chunk: any) => { body += chunk; });
          req.on("end", () => {
            try {
              const parsed = JSON.parse(body);
              fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
              fs.writeFileSync(DATA_FILE, JSON.stringify(parsed, null, 2), "utf-8");
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
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
    workbenchDataPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  build: {
    cssTarget: "esnext",
  },
});
