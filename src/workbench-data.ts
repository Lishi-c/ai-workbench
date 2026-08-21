export type Tone = "purple" | "pink" | "sand" | "blue";
export type MoodId = "great" | "good" | "calm" | "low";

export type WorkbenchTask = {
  id: string;
  title: string;
  meta: string;
  date: string;
  time: string;
  tag: string;
  tone: Tone;
  done: boolean;
  focusMinutes: number;
  repeat?: "daily" | "weekly" | "monthly";
};

export type ScheduleItem = {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  duration: number;
  tone: Tone;
  sourceTaskId?: string;
};

export type FocusSession = {
  id: string;
  date: string;
  startedAt: string;
  minutes: number;
  label: string;
  taskId?: string;
};

export type LedgerEntry = {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  note: string;
  date: string;
  time: string;
  sourceId?: string;
};

export type DiaryEntry = {
  id: string;
  date: string;
  time: string;
  title: string;
  content: string;
  tags: string[];
  mood: MoodId;
};

export type HealthRecord = {
  steps: number;
  sleepMinutes: number;
  sleepQuality: number;
  heartRate: number;
  activeMinutes: number;
  calories: number;
  workouts: number;
  water: number;
};

export type ImportedRecipe = {
  id: string;
  title: string;
  content: string;
  sourceName: string;
};

export type CustomWord = {
  word: string;
  phonetic: string;
  cn: string;
  example: string;
  exampleCn: string;
};

export type CustomRecipe = {
  id: string;
  title: string;
  content: string;
  meta: string;
  tag: string;
  tone: Tone;
  image: string;
};

export type Book = {
  id: string;
  title: string;
  author: string;
  content: string;
  preview?: string;
  format: "txt" | "md" | "json";
  progress: number;
  status: "reading" | "finished";
  favorite: boolean;
  addedAt: string;
  notes?: { id: string; text: string; createdAt: string }[];
  highlights?: { id: string; text: string; page: number; createdAt: string }[];
};

export type Document = {
  id: string;
  title: string;
  content: string;
  preview?: string;
  format: "txt" | "md" | "json";
  createdAt: string;
};

export type WorkbenchData = {
  version: 1;
  settings: {
    displayName: string;
    workspaceTitle: string;
    workspaceSubtitle: string;
    weeklyTaskGoal: number;
    monthlyBudget: number;
    fontScale: number;
    reminderAdvanceMinutes: number;
    theme: "light" | "dark";
  };
  tasks: WorkbenchTask[];
  schedule: ScheduleItem[];
  focusSessions: FocusSession[];
  ledger: LedgerEntry[];
  moodLogs: Record<string, MoodId>;
  diaryEntries: DiaryEntry[];
  health: Record<string, HealthRecord>;
  likedRecipes: string[];
  importedRecipes: ImportedRecipe[];
  mealPlan: Record<string, string>;
  customWords: CustomWord[];
  customRecipes: CustomRecipe[];
  learning: {
    masteredWords: string[];
    bookmarkedWords: string[];
    studyMinutes: number;
    customWords: CustomWord[];
    wordReviews?: Record<string, { due: string; interval: number }>;
  };
  books: Book[];
  documents: Document[];
};

export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftedDateKey(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return dateKey(date);
}

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultWorkbenchData(): WorkbenchData {
  const today = dateKey();
  const yesterday = shiftedDateKey(-1);
  return {
    version: 1,
    settings: {
      displayName: "秒小哒",
      workspaceTitle: "秒小哒的工作台",
      workspaceSubtitle: "TODAY · GOOD DAY",
      weeklyTaskGoal: 20,
      monthlyBudget: 6000,
      fontScale: 1,
      reminderAdvanceMinutes: 0,
      theme: "light",
    },
    tasks: [
      { id: "task-1", title: "整理工作台页面架构", meta: "个人项目", date: today, time: "09:30", tag: "设计", tone: "purple", done: true, focusMinutes: 80 },
      { id: "task-2", title: "完成英语听力练习", meta: "每日成长", date: today, time: "13:00", tag: "学习", tone: "blue", done: false, focusMinutes: 45 },
      { id: "task-3", title: "傍晚散步 30 分钟", meta: "健康计划", date: today, time: "18:30", tag: "生活", tone: "pink", done: false, focusMinutes: 30 },
      { id: "task-4", title: "记录今天的三个小确幸", meta: "晚间复盘", date: today, time: "21:00", tag: "日记", tone: "sand", done: false, focusMinutes: 20 },
    ],
    schedule: [
      { id: "event-1", title: "产品周会", date: today, time: "10:30", location: "线上会议", duration: 45, tone: "purple" },
      { id: "event-2", title: "原型评审", date: today, time: "15:00", location: "设计工作室", duration: 60, tone: "pink" },
      { id: "event-3", title: "瑜伽课程", date: today, time: "19:30", location: "社区中心", duration: 50, tone: "sand" },
    ],
    focusSessions: [
      { id: "focus-1", date: today, startedAt: "09:05", minutes: 25, label: "整理工作台页面架构", taskId: "task-1" },
      { id: "focus-2", date: yesterday, startedAt: "20:10", minutes: 45, label: "英语听力练习" },
    ],
    ledger: [
      { id: "ledger-1", type: "expense", amount: 32, category: "餐饮", note: "午后咖啡", date: today, time: "15:24" },
      { id: "ledger-2", type: "expense", amount: 186.5, category: "购物", note: "生活用品", date: today, time: "12:10" },
      { id: "ledger-3", type: "income", amount: 3200, category: "收入", note: "项目收入", date: yesterday, time: "18:30" },
      { id: "ledger-4", type: "expense", amount: 2800, category: "居住", note: "房租", date: shiftedDateKey(-2), time: "09:00" },
      { id: "ledger-5", type: "income", amount: 5220, category: "收入", note: "月度收入", date: shiftedDateKey(-4), time: "10:00" },
      { id: "ledger-6", type: "expense", amount: 941.5, category: "其他", note: "交通与日常", date: shiftedDateKey(-3), time: "17:40" },
    ],
    moodLogs: {
      [shiftedDateKey(-6)]: "great",
      [shiftedDateKey(-4)]: "calm",
      [shiftedDateKey(-3)]: "good",
      [shiftedDateKey(-1)]: "low",
      [today]: "good",
    },
    diaryEntries: [
      { id: "diary-1", date: today, time: "21:08", title: "傍晚的云是淡淡的粉色", content: "下班后绕着公园多走了一圈，风很轻，突然觉得不必事事都赶时间。", tags: ["散步", "小确幸"], mood: "good" },
      { id: "diary-2", date: shiftedDateKey(-2), time: "23:14", title: "终于把拖延很久的事情做完了", content: "开始之前总觉得很难，真正动手之后反而比想象中轻松。给今天的自己一个拥抱。", tags: ["成长", "完成感"], mood: "great" },
    ],
    health: {
      [today]: { steps: 7842, sleepMinutes: 456, sleepQuality: 92, heartRate: 68, activeMinutes: 52, calories: 430, workouts: 1, water: 5 },
    },
    likedRecipes: ["莓果酸奶碗"],
    importedRecipes: [],
    mealPlan: { "一": "轻食", "二": "汤面", "三": "三明治", "四": "咖喱", "五": "奶油南瓜意面", "六": "炖菜", "日": "添加" },
    customWords: [],
    customRecipes: [],
    learning: { masteredWords: [], bookmarkedWords: [], studyMinutes: 12, customWords: [] },
    books: [],
    documents: [],
  };
}

export function normalizeWorkbenchData(value?: Partial<WorkbenchData> | null): WorkbenchData {
  const defaults = createDefaultWorkbenchData();
  if (!value) return defaults;
  const settings = { ...defaults.settings, ...(value.settings ?? {}) };
  if (settings.workspaceSubtitle === "记录日常，也收藏灵感") settings.workspaceSubtitle = "TODAY · GOOD DAY";
  return {
    ...defaults,
    ...value,
    version: 1,
    settings,
    tasks: Array.isArray(value.tasks) ? value.tasks : defaults.tasks,
    schedule: Array.isArray(value.schedule) ? value.schedule : defaults.schedule,
    focusSessions: Array.isArray(value.focusSessions) ? value.focusSessions : [],
    ledger: Array.isArray(value.ledger) ? value.ledger : defaults.ledger,
    moodLogs: value.moodLogs ?? defaults.moodLogs,
    diaryEntries: Array.isArray(value.diaryEntries) ? value.diaryEntries : defaults.diaryEntries,
    health: value.health ?? defaults.health,
    likedRecipes: Array.isArray(value.likedRecipes) ? value.likedRecipes : defaults.likedRecipes,
    importedRecipes: Array.isArray(value.importedRecipes) ? value.importedRecipes : defaults.importedRecipes,
    mealPlan: value.mealPlan ?? defaults.mealPlan,
    customWords: Array.isArray(value.customWords) ? value.customWords : defaults.customWords,
    customRecipes: Array.isArray(value.customRecipes) ? value.customRecipes : defaults.customRecipes,
    learning: { ...defaults.learning, ...(value.learning ?? {}), customWords: Array.isArray(value.learning?.customWords) ? value.learning.customWords : [] },
    books: Array.isArray(value.books) ? value.books.map((b) => ({ ...b, format: b.format === "md" || b.format === "json" ? b.format : "txt" })) : [],
    documents: Array.isArray(value.documents) ? value.documents.map((d) => ({ ...d, format: (d.format === "md" || d.format === "json") ? d.format : "txt" })) : [],
  };
}
