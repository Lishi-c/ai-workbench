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

// Electron 主进程把随机 token 放在 URL query 里，请求时作为 header 带回；开发模式（vite）无 token 则不带
function authHeaders(): Record<string, string> {
  const token = new URLSearchParams(window.location.search).get("t");
  return token ? { "x-auth-token": token } : {};
}

export type LoadResult = { data: WorkbenchData | null; restored: boolean };

export async function loadLocalData(): Promise<LoadResult> {
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
  try {
    const res = await fetch(API_URL, { method: "PUT", headers: { "content-type": "application/json", ...authHeaders() }, body: JSON.stringify(value) });
    return res.ok;
  } catch {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* ignore */ }
    return false;
  }
}

export async function fetchContentText(type: string, id: string): Promise<string> {
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
  try {
    const res = await fetch(`/api/holidays?year=${year}`, { headers: authHeaders() });
    if (res.ok) {
      const payload = await res.json();
      if (payload && typeof payload === "object" && payload.holiday) return payload.holiday as HolidayMap;
    }
  } catch { /* 忽略，降级为无调休 */ }
  return {};
}
