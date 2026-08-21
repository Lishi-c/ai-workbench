import { Solar } from "lunar-javascript";

export type HolidayInfo = { holiday: boolean; name: string };
export type HolidayMap = Record<string, HolidayInfo>;

// 阳历 + 农历节日（纯本地、同步、离线可用）
export function getFestival(dateKey: string): string | null {
  const [y, m, d] = dateKey.split("-").map((n) => Number(n) || 0);
  if (!y || !m || !d) return null;
  const solar = Solar.fromYmd(y, m, d);
  const names = [...solar.getFestivals(), ...solar.getLunar().getFestivals()];
  return names[0] ?? null;
}

// 汇总某天的展示标签：调休/补班优先，其次节日
export function getDateLabel(holidays: HolidayMap, dateKey: string): { text: string; workday: boolean } | null {
  const h = holidays[dateKey];
  if (h) return { text: h.holiday ? h.name : "班", workday: !h.holiday };
  const festival = getFestival(dateKey);
  return festival ? { text: festival, workday: false } : null;
}
