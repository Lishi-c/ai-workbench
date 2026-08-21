import type { LucideIcon } from "lucide-react";
import {
  BookHeart, BookOpen, CalendarCheck2, CheckSquare2, CookingPot, Frown,
  HeartPulse, Home, Languages, LayoutDashboard, Meh, PenLine, Smile,
  TimerReset, WalletCards,
} from "lucide-react";
import { createContext, useContext } from "react";
import type { MoodId, Tone, WorkbenchData } from "../workbench-data";
import type { HolidayMap } from "./calendar-festivals";

export type PageKey = "dashboard" | "tasks" | "finance" | "recipes" | "health" | "diary" | "focus" | "english" | "library" | "notes";
export type ModalKind = "plan" | "task" | "schedule" | "transaction" | "budget" | "health" | "settings" | "recipe" | "meal" | "clear" | "backup" | "addRecipe";
export type ModalState = { kind: ModalKind; payload?: string } | null;
export type NavItem = { key: PageKey; label: string; caption: string; icon: LucideIcon };
export type WorkbenchContextValue = {
  data: WorkbenchData;
  updateData: (recipe: (current: WorkbenchData) => WorkbenchData) => void;
  navigate: (key: PageKey) => void;
  openModal: (kind: ModalKind, payload?: string) => void;
  notify: (message: string) => void;
  holidays: HolidayMap;
  loadHolidays: (year: number) => void;
};

export const WorkbenchContext = createContext<WorkbenchContextValue | null>(null);

export function useWorkbench() {
  const context = useContext(WorkbenchContext);
  if (!context) throw new Error("Workbench context is unavailable");
  return context;
}

export const navSections: { label: string; items: NavItem[] }[] = [
  { label: "总览", items: [
    { key: "dashboard", label: "仪表盘", caption: "今日概览", icon: LayoutDashboard },
    { key: "tasks", label: "时间计划", caption: "任务与日程", icon: CalendarCheck2 },
  ] },
  { label: "生活", items: [
    { key: "notes", label: "便签笔记", caption: "导入与阅读", icon: PenLine },
    { key: "diary", label: "心情日记", caption: "感受与片段", icon: BookHeart },
    { key: "health", label: "健康管理", caption: "运动与睡眠", icon: HeartPulse },
    { key: "recipes", label: "美味食谱", caption: "灵感与收藏", icon: CookingPot },
    { key: "finance", label: "收支记录", caption: "预算与账单", icon: WalletCards },
  ] },
  { label: "成长", items: [
    { key: "focus", label: "专注记录", caption: "番茄学习模式", icon: TimerReset },
    { key: "english", label: "英语学习", caption: "词汇与练习", icon: Languages },
    { key: "library", label: "图书库", caption: "导入与阅读", icon: BookOpen },
  ] },
];

export const bottomItems: { key: PageKey; label: string; icon: LucideIcon }[] = [
  { key: "dashboard", label: "首页", icon: Home },
  { key: "tasks", label: "任务", icon: CheckSquare2 },
  { key: "finance", label: "账本", icon: WalletCards },
  { key: "diary", label: "日记", icon: BookHeart },
];

export const moods: { id: MoodId; label: string; short: string; icon: LucideIcon; tone: Tone }[] = [
  { id: "great", label: "超开心", short: "开心", icon: Smile, tone: "purple" },
  { id: "good", label: "还不错", short: "不错", icon: Smile, tone: "pink" },
  { id: "calm", label: "很平静", short: "平静", icon: Meh, tone: "blue" },
  { id: "low", label: "有点累", short: "有点累", icon: Frown, tone: "sand" },
];

export const recipeCards = [
  { title: "奶油南瓜意面", meta: "25 分钟 · 420 kcal", image: "https://miaoda-site-img.cdn.bcebos.com/images/MiaoTu_020cbc37-5ef5-4abf-bfa9-df2520dadbb1.jpg", tone: "sand", tag: "一人食", content: "南瓜蒸熟压泥，与牛奶和少量奶油煮成酱汁，拌入意面并用盐与黑胡椒调味。" },
  { title: "牛油果温泉蛋吐司", meta: "12 分钟 · 310 kcal", image: "https://miaoda-site-img.cdn.bcebos.com/images/MiaoTu_8d28e44a-9ea6-49c5-93cd-c19c740d38fc.jpg", tone: "sage", tag: "早餐", content: "吐司烤至金黄，铺上调味牛油果泥与温泉蛋，撒少量黑胡椒即可。" },
  { title: "莓果酸奶碗", meta: "8 分钟 · 260 kcal", image: "https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_2686f724-e146-41bb-81cc-ffb79d42bca2.jpg", tone: "pink", tag: "轻食", content: "酸奶铺底，加入莓果、坚果与少量蜂蜜，食用前轻轻拌匀。" },
];

export const words = [
  { word: "serendipity", phonetic: "/ˌser.ənˈdɪp.ə.ti/", cn: "意外发现美好事物的运气", example: "We met by pure serendipity.", exampleCn: "我们的相遇纯属美丽的偶然。" },
  { word: "resilient", phonetic: "/rɪˈzɪl.i.ənt/", cn: "有韧性的；能迅速恢复的", example: "She is more resilient than she realizes.", exampleCn: "她比自己想象中更有韧性。" },
  { word: "wanderlust", phonetic: "/ˈwɒn.də.lʌst/", cn: "强烈的旅行愿望", example: "Spring always awakens my wanderlust.", exampleCn: "春天总会唤醒我远行的渴望。" },
];

export const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
export const monthNames = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];

export function formatMoney(value: number) {
  return `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export function safePercent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export function field(form: FormData, name: string) { return String(form.get(name) ?? "").trim(); }
