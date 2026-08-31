import { invoke } from "@tauri-apps/api/core";
import type { WorkbenchData } from "../workbench-data";
import type { HolidayMap } from "./calendar-festivals";

export async function readTextFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    try {
      return new TextDecoder("gb18030").decode(buffer);
    } catch {
      return new TextDecoder("utf-8").decode(buffer);
    }
  }
}

const STORAGE_KEY = "lumi-workbench-data";
const API_URL = "/api/workbench-data";
// Tauri 环境探测：Tauri v2 会在 window 上挂 __TAURI_INTERNALS__；Electron 无此标记
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// 旧 Electron 版把随机 token 放在 URL query 里；现在仅 vite 开发模式（无 token）会走到这个 fetch 回退分支
function authHeaders(): Record<string, string> {
  const token = new URLSearchParams(window.location.search).get("t");
  return token ? { "x-auth-token": token } : {};
}

export type LoadResult = { data: WorkbenchData | null; restored: boolean };

export async function loadLocalData(): Promise<LoadResult> {
  if (isTauri) {
    try {
      return await invoke<LoadResult>("load_data");
    } catch { /* 落到下方 localStorage 回退 */ }
  }
  try {
    const res = await fetch(API_URL, { headers: authHeaders() });
    if (res.ok) {
      const payload = await res.json();
      if (payload && typeof payload === "object" && payload.data != null) {
        return { data: payload.data as WorkbenchData, restored: Boolean(payload.restored) };
      }
    }
  } catch { /* 文件后端不可用，回退 localStorage */ }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return { data: raw ? (JSON.parse(raw) as WorkbenchData) : null, restored: false };
  } catch {
    return { data: null, restored: false };
  }
}

export async function saveLocalData(value: WorkbenchData): Promise<boolean> {
  if (isTauri) {
    try {
      return await invoke<boolean>("save_data", { value });
    } catch {
      return false;
    }
  }
  try {
    const res = await fetch(API_URL, { method: "PUT", headers: { "content-type": "application/json", ...authHeaders() }, body: JSON.stringify(value) });
    return res.ok;
  } catch {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* ignore */ }
    return false;
  }
}

export async function fetchContentText(type: string, id: string): Promise<string> {
  if (isTauri) {
    try {
      return await invoke<string>("get_content", { kind: type, id });
    } catch {
      return "";
    }
  }
  try {
    const res = await fetch(`/api/content?type=${type}&id=${encodeURIComponent(id)}`, { headers: authHeaders() });
    if (res.ok) {
      const payload = await res.json();
      return payload.content ?? "";
    }
  } catch { /* 忽略，返回空 */ }
  return "";
}

export async function fetchHolidays(year: number): Promise<HolidayMap> {
  if (isTauri) {
    try {
      const payload = await invoke<{ holiday: HolidayMap }>("get_holidays", { year });
      return payload.holiday ?? {};
    } catch {
      return {};
    }
  }
  try {
    const res = await fetch(`/api/holidays?year=${year}`, { headers: authHeaders() });
    if (res.ok) {
      const payload = await res.json();
      if (payload && typeof payload === "object" && payload.holiday) return payload.holiday as HolidayMap;
    }
  } catch { /* 忽略，降级为无调休 */ }
  return {};
}

export const isTauriRuntime = isTauri;

// 备份到用户指定位置：Tauri 下弹「另存为」对话框，返回保存路径；取消返回 null
export async function saveBackupFile(json: string, fileName: string): Promise<string | null> {
  if (!isTauri) return null;
  try {
    return await invoke<string | null>("save_backup", { json, fileName });
  } catch {
    return null;
  }
}

// 打开文件所在目录并选中该文件（Windows 用 explorer /select）
export async function revealInFolder(path: string): Promise<void> {
  if (!isTauri) return;
  try {
    await invoke("reveal_in_folder", { path });
  } catch { /* ignore */ }
}

export type UpdateInfo = {
  has_update: boolean;
  current_version: string;
  latest_version: string;
  download_url: string;
  html_url: string;
  file_name: string;
};

export async function getAppVersion(): Promise<string> {
  if (!isTauri) return "";
  try {
    return await invoke<string>("get_app_version");
  } catch {
    return "";
  }
}

export async function checkForUpdates(): Promise<UpdateInfo | null> {
  if (!isTauri) return null;
  try {
    return await invoke<UpdateInfo>("check_for_updates");
  } catch {
    return null;
  }
}

export async function downloadUpdate(url: string, fileName: string): Promise<string | null> {
  if (!isTauri) return null;
  try {
    return await invoke<string>("download_update", { url, fileName });
  } catch {
    return null;
  }
}

export async function installUpdate(path: string): Promise<void> {
  if (!isTauri) return;
  try {
    await invoke("install_update", { path });
  } catch { /* ignore */ }
}
