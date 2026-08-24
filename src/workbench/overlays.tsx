import {
  BookOpen, CalendarCheck2, Check, CheckSquare2, ChevronRight, Clock3,
  Download, FileUp, HeartPulse, Pause, PenLine, Play, RotateCcw, Search,
  TimerReset, Trash2, Upload, WalletCards, X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createId, dateKey, normalizeWorkbenchData, type CustomRecipe, type Tone, type WorkbenchData, type WorkbenchTask } from "../workbench-data";
import { field, formatMoney, type NavItem, type PageKey, recipeCards, type ModalState, useWorkbench } from "./context";
import { fetchContentText, readTextFile } from "./storage";
import { FormField, FormSelect, IconButton, ModalActions, ModalHead } from "./ui";

function EditorModal({ modal, close }: { modal: Exclude<ModalState, null>; close: () => void }) {
  const { data, updateData, openModal, notify } = useWorkbench();
  const backupData = async () => {
    const books = await Promise.all(data.books.map(async (b) => ({ ...b, content: b.content || await fetchContentText("book", b.id) })));
    const documents = await Promise.all(data.documents.map(async (d) => ({ ...d, content: d.content || await fetchContentText("doc", d.id) })));
    const blob = new Blob([JSON.stringify({ ...data, books, documents }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `工作台备份-${dateKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    notify("已导出全部数据备份");
  };
  const restoreData = async (file?: File) => {
    if (!file) return;
    try {
      const text = await readTextFile(file);
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object") { notify("备份文件格式无效"); return; }
      if (!window.confirm("将用备份恢复全部记录（保留当前工作台偏好设置），确定吗？")) return;
      updateData((current) => ({ ...normalizeWorkbenchData(parsed), settings: current.settings }));
      notify("已从备份恢复全部数据");
    } catch { notify("备份文件格式无效"); }
  };
  const today = dateKey();
  // 烹饪倒计时
  const [cookingActive, setCookingActive] = useState(false);
  const [cookingLeft, setCookingLeft] = useState(0);
  useEffect(() => {
    if (!cookingActive || cookingLeft <= 0) return;
    const t = window.setInterval(() => setCookingLeft((v) => { if (v <= 1) { clearInterval(t); return 0; } return v - 1; }), 1000);
    return () => window.clearInterval(t);
  }, [cookingActive, cookingLeft]);
  const planningDate = (modal.kind === "plan" || modal.kind === "task" || modal.kind === "schedule") && /^\d{4}-\d{2}-\d{2}$/.test(modal.payload ?? "") ? modal.payload! : today;
  const finish = (message: string) => { notify(message); close(); };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (modal.kind === "task") {
      const id = createId("task"); const date = field(form, "date"); const time = field(form, "time"); const repeat = field(form, "repeat") as "daily" | "weekly" | "monthly" | "";
      const task: WorkbenchTask = { id, title: field(form, "title"), meta: field(form, "meta") || "个人计划", date, time, tag: field(form, "tag") || "待办", tone: field(form, "tone") as Tone, done: false, focusMinutes: Number(field(form, "focusMinutes")) || 25, ...(repeat ? { repeat } : {}) };
      updateData((current) => ({ ...current, tasks: [...current.tasks, task], schedule: form.get("syncSchedule") ? [...current.schedule, { id: createId("event"), title: task.title, date, time, location: field(form, "location") || "待确认", duration: task.focusMinutes, tone: task.tone, sourceTaskId: id }] : current.schedule })); finish(form.get("syncSchedule") ? "任务已创建，并同步到日程" : "任务已创建");
    }
    if (modal.kind === "schedule") {
      updateData((current) => ({ ...current, schedule: [...current.schedule, { id: createId("event"), title: field(form, "title"), date: field(form, "date"), time: field(form, "time"), location: field(form, "location") || "待确认", duration: Number(field(form, "duration")) || 30, tone: field(form, "tone") as Tone }] })); finish("日程已添加，仪表盘已同步");
    }
    if (modal.kind === "transaction") {
      updateData((current) => ({ ...current, ledger: [{ id: createId("ledger"), type: field(form, "type") as "income" | "expense", amount: Math.abs(Number(field(form, "amount"))), category: field(form, "category"), note: field(form, "note"), date: field(form, "date"), time: field(form, "time") }, ...current.ledger] })); finish("账单已记录，结余与图表已更新");
    }
    if (modal.kind === "budget") { updateData((current) => ({ ...current, settings: { ...current.settings, monthlyBudget: Math.max(0, Number(field(form, "budget"))) } })); finish("本月预算已更新"); }
    if (modal.kind === "health") {
      updateData((current) => ({ ...current, health: { ...current.health, [today]: { steps: Number(field(form, "steps")), sleepMinutes: Number(field(form, "sleepHours")) * 60 + Number(field(form, "sleepMinutes")), sleepQuality: Number(field(form, "sleepQuality")), heartRate: Number(field(form, "heartRate")), activeMinutes: Number(field(form, "activeMinutes")), calories: Number(field(form, "calories")), workouts: Number(field(form, "workouts")), water: current.health[today]?.water ?? 0 } } })); finish("今日健康数据已更新");
    }
    if (modal.kind === "settings") { updateData((current) => ({ ...current, settings: { ...current.settings, displayName: field(form, "displayName"), workspaceTitle: field(form, "workspaceTitle"), workspaceSubtitle: field(form, "workspaceSubtitle"), weeklyTaskGoal: Number(field(form, "weeklyTaskGoal")), fontScale: Number(field(form, "fontScale") || "1"), reminderAdvanceMinutes: Number(field(form, "reminderAdvanceMinutes") || "0"), theme: (field(form, "theme") as "light" | "dark") || "light", autoLaunch: form.get("autoLaunch") === "on" } })); finish("工作台偏好已保存"); }
    if (modal.kind === "meal") { updateData((current) => ({ ...current, mealPlan: { ...current.mealPlan, [modal.payload ?? "五"]: field(form, "recipe") } })); finish(`周${modal.payload ?? "五"}餐单已更新`); }
    if (modal.kind === "addRecipe") { const recipe: CustomRecipe = { id: createId("custom-recipe"), title: field(form, "title"), content: field(form, "content"), meta: field(form, "meta") || "自定义食谱", tag: field(form, "tag") || "自创", tone: field(form, "tone") as Tone, image: field(form, "image") || "https://miaoda-site-img.cdn.bcebos.com/images/MiaoTu_020cbc37-5ef5-4abf-bfa9-df2520dadbb1.jpg" }; updateData((current) => ({ ...current, customRecipes: [recipe, ...current.customRecipes] })); finish("自定义食谱已添加"); }
  };
  const deleteEvent = (id: string) => { updateData((current) => ({ ...current, schedule: current.schedule.filter((item) => item.id !== id) })); notify("日程已删除"); };
  const recipe = recipeCards.find((item) => item.title === modal.payload) ?? data.customRecipes.find((item) => item.id === modal.payload || item.title === modal.payload) ?? data.importedRecipes.find((item) => item.id === modal.payload);
  const currentHealth = data.health[today];
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><IconButton label="关闭" className="modal-close" onClick={close}><X size={18} /></IconButton>
    {modal.kind === "plan" && <div><ModalHead eyebrow="NEW PLAN" title="新建计划" copy={`${new Date(`${planningDate}T12:00:00`).getMonth() + 1} 月 ${new Date(`${planningDate}T12:00:00`).getDate()} 日 · 先选择要创建的计划类型。`} /><div className="plan-type-grid"><button type="button" onClick={() => openModal("task", planningDate)}><span className="planner-guide-icon task-guide-icon"><CheckSquare2 size={20} /></span><strong>新建任务</strong><p>追踪要完成的结果，可以勾选完成。</p><ChevronRight size={18} /></button><button type="button" onClick={() => openModal("schedule", planningDate)}><span className="planner-guide-icon schedule-guide-icon"><CalendarCheck2 size={20} /></span><strong>添加日程</strong><p>安排固定时间、地点和时长。</p><ChevronRight size={18} /></button></div></div>}
    {modal.kind === "task" && <form onSubmit={submit}><ModalHead eyebrow="NEW TASK" title="新建任务" copy="任务用于追踪结果；如确实占用固定时间，也可同步生成一条日程。" /><div className="form-grid"><FormField label="任务名称" name="title" required /><FormField label="所属计划" name="meta" placeholder="例如：个人项目" /><FormField label="日期" name="date" type="date" defaultValue={planningDate} required /><FormField label="提醒时间" name="time" type="time" defaultValue="09:00" required /><FormField label="标签" name="tag" defaultValue="待办" /><FormField label="预计投入（分钟）" name="focusMinutes" type="number" defaultValue="25" min="1" /><FormSelect label="色彩" name="tone" options={[["purple", "粉紫"], ["pink", "柔粉"], ["blue", "雾蓝"], ["sand", "暖杏"]]} /><FormSelect label="重复" name="repeat" options={[["", "不重复"], ["daily", "每天"], ["weekly", "每周"], ["monthly", "每月"]]} /><label className="check-field"><input type="checkbox" name="syncSchedule" /><span>同时生成固定时间日程</span></label><FormField label="地点（同步日程时使用）" name="location" placeholder="例如：线上会议" /></div><ModalActions close={close} label="创建任务" /></form>}
    {modal.kind === "schedule" && <form onSubmit={submit}><ModalHead eyebrow="SCHEDULE" title="管理日程" copy="日程记录固定时间、地点和时长；它不需要勾选完成，也不会计入任务目标。" /><div className="modal-record-list">{data.schedule.filter((item) => item.date === planningDate).sort((a, b) => a.time.localeCompare(b.time)).map((item) => <div key={item.id}><span className={`schedule-dot ${item.tone}`} /><p><strong>{item.time} · {item.title}</strong><small>{item.location} · {item.duration} 分钟{item.sourceTaskId ? " · 关联任务" : ""}</small></p><IconButton label="删除日程" onClick={() => deleteEvent(item.id)}><Trash2 size={16} /></IconButton></div>)}</div><div className="modal-divider"><span>添加新日程</span></div><div className="form-grid"><FormField label="日程名称" name="title" required /><FormField label="日期" name="date" type="date" defaultValue={planningDate} required /><FormField label="时间" name="time" type="time" defaultValue="10:00" required /><FormField label="地点" name="location" required /><FormField label="时长（分钟）" name="duration" type="number" defaultValue="30" min="1" /><FormSelect label="色彩" name="tone" options={[["purple", "粉紫"], ["pink", "柔粉"], ["blue", "雾蓝"], ["sand", "暖杏"]]} /></div><ModalActions close={close} label="添加日程" /></form>}
    {modal.kind === "transaction" && <form onSubmit={submit}><ModalHead eyebrow="NEW RECORD" title="记一笔" copy="保存后会同时更新结余、预算进度、趋势与分类占比。" /><div className="form-grid"><FormSelect label="类型" name="type" options={[["expense", "支出"], ["income", "收入"]]} /><FormField label="金额" name="amount" type="number" min="0.01" step="0.01" required /><FormSelect label="分类" name="category" options={[["餐饮", "餐饮"], ["购物", "购物"], ["居住", "居住"], ["其他", "其他"], ["收入", "收入"]]} /><FormField label="说明" name="note" required placeholder="例如：午后咖啡" /><FormField label="日期" name="date" type="date" defaultValue={today} required /><FormField label="时间" name="time" type="time" defaultValue={new Date().toTimeString().slice(0, 5)} required /></div><ModalActions close={close} label="保存账单" /></form>}
    {modal.kind === "budget" && <form onSubmit={submit}><ModalHead eyebrow="BUDGET" title="设置本月预算" copy="预算只控制支出目标，实际使用额始终来自账单。" /><FormField label="预算金额" name="budget" type="number" min="0" defaultValue={String(data.settings.monthlyBudget)} required /><ModalActions close={close} label="更新预算" /></form>}
    {modal.kind === "health" && <form onSubmit={submit}><ModalHead eyebrow="WELLNESS" title="记录今日健康" copy="仪表盘只展示你在这里输入的真实数据。" /><div className="form-grid"><FormField label="步数" name="steps" type="number" min="0" defaultValue={String(currentHealth?.steps ?? 0)} /><FormField label="睡眠小时" name="sleepHours" type="number" min="0" max="24" defaultValue={String(Math.floor((currentHealth?.sleepMinutes ?? 0) / 60))} /><FormField label="睡眠分钟" name="sleepMinutes" type="number" min="0" max="59" defaultValue={String((currentHealth?.sleepMinutes ?? 0) % 60)} /><FormField label="睡眠质量 %" name="sleepQuality" type="number" min="0" max="100" defaultValue={String(currentHealth?.sleepQuality ?? 0)} /><FormField label="静息心率" name="heartRate" type="number" min="0" defaultValue={String(currentHealth?.heartRate ?? 0)} /><FormField label="活跃分钟" name="activeMinutes" type="number" min="0" defaultValue={String(currentHealth?.activeMinutes ?? 0)} /><FormField label="消耗千卡" name="calories" type="number" min="0" defaultValue={String(currentHealth?.calories ?? 0)} /><FormField label="训练次数" name="workouts" type="number" min="0" defaultValue={String(currentHealth?.workouts ?? 0)} /></div><ModalActions close={close} label="保存健康数据" /></form>}
    {modal.kind === "settings" && <form onSubmit={submit}><ModalHead eyebrow="PREFERENCES" title="工作台偏好" copy="修改名字与目标后，侧栏、问候语和进度卡会同步更新。" /><div className="form-grid"><FormField label="称呼" name="displayName" defaultValue={data.settings.displayName} required /><FormField label="工作台标题" name="workspaceTitle" defaultValue={data.settings.workspaceTitle} required /><FormField label="副标题" name="workspaceSubtitle" defaultValue={data.settings.workspaceSubtitle} required /><FormField label="每周任务目标" name="weeklyTaskGoal" type="number" min="1" defaultValue={String(data.settings.weeklyTaskGoal)} /><FormSelect label="字体大小" name="fontScale" defaultValue={String(data.settings.fontScale)} options={[["0.9", "较小"], ["1", "标准"], ["1.15", "大"], ["1.3", "特大"]]} /><FormSelect label="提醒提前量" name="reminderAdvanceMinutes" defaultValue={String(data.settings.reminderAdvanceMinutes)} options={[["0", "到点提醒"], ["5", "提前 5 分钟"], ["10", "提前 10 分钟"], ["15", "提前 15 分钟"], ["30", "提前 30 分钟"]]} /><FormSelect label="外观主题" name="theme" defaultValue={String(data.settings.theme)} options={[["light", "浅色"], ["dark", "深色"]]} /><label className="check-field"><input type="checkbox" name="autoLaunch" defaultChecked={data.settings.autoLaunch} /><span>开机自动启动</span></label></div><ModalActions close={close} label="保存偏好" /></form>}
    {modal.kind === "meal" && <form onSubmit={submit}><ModalHead eyebrow="MEAL PLAN" title={`安排周${modal.payload ?? "五"}餐单`} copy="选择后会写入一周餐桌。" /><FormSelect label="食谱" name="recipe" defaultValue={data.mealPlan[modal.payload ?? "五"]} options={[...recipeCards.map((item) => [item.title, item.title]), ...data.customRecipes.map((item) => [item.title, item.title]), ...data.importedRecipes.map((item) => [item.title, item.title])]} /><ModalActions close={close} label="保存餐单" /></form>}
    {modal.kind === "addRecipe" && (() => {
      const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
          const raw = await readTextFile(file);
          let title = file.name.replace(/\.(md|txt|json)$/i, "");
          let content = raw.trim();
          if (file.name.endsWith(".json")) { const parsed = JSON.parse(raw) as { title?: string; content?: string; steps?: string[] }; title = parsed.title ?? title; content = parsed.content ?? parsed.steps?.join("\n") ?? raw; }
          else { title = raw.split("\n").find((line) => line.trim())?.replace(/^#+\s*/, "").slice(0, 40) || title; }
          updateData((current) => ({ ...current, importedRecipes: [{ id: createId("recipe"), title, content: content.slice(0, 12000), sourceName: file.name }, ...current.importedRecipes] }));
          notify(`已导入「${title}」`); close();
        } catch { notify("导入失败，请检查文件格式"); }
        event.currentTarget.value = "";
      };
      return <form onSubmit={submit}>
        <ModalHead eyebrow="NEW RECIPE" title="添加食谱" copy={`可以先导入文件，也可以在下方手动填写；两种方式都会进入同一个"我的食谱"数据库。`} />
        <label className="recipe-import-card">
          <span className="recipe-import-icon"><FileUp size={22} /></span>
          <span className="recipe-import-text"><strong>从文件快速导入</strong><small>支持 JSON、Markdown 和 TXT，选择后会立即解析并保存。</small></span>
          <span className="button button-primary recipe-import-btn">选择文件</span>
          <input type="file" accept=".md,.txt,.json,text/plain,application/json" style={{ display: "none" }} onChange={handleImport} />
        </label>
        <div className="modal-or-divider"><span>或手动填写</span></div>
        <div className="form-grid">
          <FormField label="食谱名称" name="title" required />
          <FormField label="时间与热量" name="meta" defaultValue="" placeholder="例如：20 分钟 · 380 kcal" />
          <FormField label="分类标签" name="tag" defaultValue="" placeholder="例如：早餐" />
          <FormSelect label="点缀色" name="tone" options={[["blue", "雾蓝"], ["purple", "粉紫"], ["pink", "柔粉"], ["sand", "暖杏"]]} />
          <FormField label="封面图片路径" name="image" placeholder="不填则使用默认封面" />
        </div>
        <label className="form-field full-field"><span>做法</span><textarea name="content" rows={4} required placeholder="写下食材、步骤和注意事项……" /></label>
        <ModalActions close={close} label="添加食谱" />
      </form>;
    })()}
    {modal.kind === "recipe" && (() => {
      const recipeMeta = "meta" in (recipe ?? {}) ? String((recipe as { meta?: string }).meta ?? "20 分钟") : "20 分钟";
      const totalMinutes = parseInt(String(recipeMeta.match(/(\d+)\s*分钟/)?.[1] ?? "20"), 10);
      const totalSeconds = totalMinutes * 60;
      const mins = String(Math.floor(cookingLeft / 60)).padStart(2, "0");
      const secs = String(cookingLeft % 60).padStart(2, "0");
      const pct = totalSeconds > 0 ? Math.round((1 - cookingLeft / totalSeconds) * 100) : 0;
      const startCooking = () => { setCookingLeft(totalSeconds); setCookingActive(true); };
      return <div><ModalHead eyebrow="RECIPE" title={recipe?.title ?? "番茄罗勒烤芝士"} copy={recipeMeta} />
        <div className="reader-copy">{"content" in (recipe ?? {}) ? String((recipe as { content?: string }).content ?? "番茄切片，与芝士叠放在吐司中，小火煎至两面金黄，最后加入罗勒即可。") : "番茄切片，与芝士叠放在吐司中，小火煎至两面金黄，最后加入罗勒即可。"}</div>
        {!cookingActive ? (
          <button className="button button-primary modal-single-action" type="button" onClick={startCooking}><Play size={15} fill="currentColor" /> 开始烹饪计时</button>
        ) : (
          <div className="cooking-timer">
            <div className="cooking-ring" style={{ "--cook-pct": `${pct * 3.6}deg` } as React.CSSProperties}>
              <div>{cookingLeft > 0 ? <><strong>{mins}:{secs}</strong><span>剩余</span></> : <><strong>完成！</strong><span>享用吧</span></>}</div>
            </div>
            <div className="cooking-actions">
              <button type="button" className="button button-soft" onClick={() => setCookingActive((v) => !v)}>{cookingActive ? <><Pause size={14} /> 暂停</> : <><Play size={14} /> 继续</>}</button>
              <button type="button" className="button button-soft" onClick={() => { setCookingActive(false); setCookingLeft(0); }}><RotateCcw size={14} /> 重置</button>
              <button type="button" className="button button-primary" onClick={() => finish("烹饪完成，祝你好胃口！")}><Check size={14} /> 完成烹饪</button>
            </div>
          </div>
        )}
      </div>;
    })()}
    {modal.kind === "backup" && <div><ModalHead eyebrow="DATA" title="数据备份与恢复" copy="把全部数据导出为 JSON 文件备份，或从备份文件恢复。" /><div className="modal-actions"><button type="button" className="button button-soft" onClick={() => { backupData(); close(); }}><Download size={15} /> 备份数据</button><label className="button button-primary"><Upload size={15} /> 恢复数据<input type="file" accept=".json,application/json" style={{ display: "none" }} onChange={(event) => { void restoreData(event.target.files?.[0]); event.currentTarget.value = ""; close(); }} /></label></div></div>}
    {modal.kind === "clear" && <div><ModalHead eyebrow="CLEAR" title="清空所有记录" copy="这会删除任务、日程、专注、账单、心情、日记、健康等全部记录，仅保留工作台设置，操作无法撤销。" /><div className="modal-actions"><button type="button" className="button button-soft" onClick={close}>取消</button><button type="button" className="button danger-button" onClick={() => { updateData((current) => ({ ...current, tasks: [], schedule: [], focusSessions: [], ledger: [], moodLogs: {}, diaryEntries: [], health: {}, likedRecipes: [], importedRecipes: [], mealPlan: {}, customWords: [], customRecipes: [], learning: { masteredWords: [], bookmarkedWords: [], studyMinutes: 0, customWords: [] }, books: [], documents: [], noteFolders: [] })); finish("已清空所有记录"); }}>确认清空</button></div></div>}
  </section></div>;
}

function CommandPalette({ open, onClose, navItems, data, navigate, openNote, openBook }: {
  open: boolean;
  onClose: () => void;
  navItems: NavItem[];
  data: WorkbenchData;
  navigate: (key: PageKey) => void;
  openNote: (id: string) => void;
  openBook: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const q = query.trim().toLowerCase();
  const matches = (text?: string) => !q || (text ?? "").toLowerCase().includes(q);
  const results = [
    ...navItems.filter((item) => matches(item.label) || matches(item.caption) || matches(item.key)).map((item) => ({ id: `page:${item.key}`, group: "页面", icon: item.icon, label: item.label, hint: item.caption, run: () => { navigate(item.key); onClose(); } })),
    ...data.documents.filter((doc) => matches(doc.title) || matches(doc.preview) || matches(doc.content)).map((doc) => ({ id: `doc:${doc.id}`, group: "笔记", icon: PenLine, label: doc.title || "无标题", hint: "笔记", run: () => openNote(doc.id) })),
    ...data.books.filter((book) => matches(book.title) || matches(book.author)).map((book) => ({ id: `book:${book.id}`, group: "图书", icon: BookOpen, label: book.title, hint: book.author || "图书", run: () => openBook(book.id) })),
  ];
  const activeIndex = results.length ? Math.min(index, results.length - 1) : -1;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setIndex((i) => Math.min(i + 1, results.length - 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
    else if (event.key === "Enter") { event.preventDefault(); if (activeIndex >= 0) results[activeIndex].run(); }
    else if (event.key === "Escape") { event.preventDefault(); onClose(); }
  };

  if (!open) return null;

  return <div className="palette-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="palette-panel" role="dialog" aria-modal="true" aria-label="快速查找"><div className="palette-input-row"><Search size={16} /><input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setIndex(0); }} onKeyDown={onKeyDown} placeholder="搜索页面、笔记、图书…" /><kbd>ESC</kbd></div><div className="palette-list">{results.length === 0 && <div className="palette-empty">没有找到相关内容</div>}{results.map((result, i) => { const Icon = result.icon; return <button type="button" key={result.id} className={`palette-item${i === activeIndex ? " is-active" : ""}`} onMouseEnter={() => setIndex(i)} onClick={() => result.run()}><Icon size={16} /><span className="palette-item-label">{result.label}</span>{result.hint && <span className="palette-item-hint">{result.hint}</span>}<span className="palette-item-group">{result.group}</span></button>; })}</div></div></div>;
}

function ReminderPanel({ data, navigate, onClose }: { data: WorkbenchData; navigate: (key: PageKey) => void; onClose: () => void }) {
  const today = dateKey();
  const month = today.slice(0, 7);
  const pendingTasks = data.tasks.filter((task) => task.date === today && !task.done);
  const schedule = data.schedule.filter((item) => item.date === today).sort((a, b) => a.time.localeCompare(b.time));
  const monthSpent = data.ledger.filter((entry) => entry.type === "expense" && entry.date.startsWith(month)).reduce((sum, entry) => sum + entry.amount, 0);
  const budget = data.settings.monthlyBudget;
  const health = data.health[today];
  const todayFocus = data.focusSessions.filter((session) => session.date === today).reduce((sum, session) => sum + session.minutes, 0);
  const overBudget = budget > 0 && monthSpent > budget;
  const go = (key: PageKey) => { navigate(key); onClose(); };

  return <div className="reminder-panel"><header className="reminder-head"><strong>今日提醒</strong><small>{pendingTasks.length ? `${pendingTasks.length} 件事待处理` : "一切就绪"}</small></header><button type="button" className="reminder-row" onClick={() => go("tasks")}><span className="reminder-icon"><CalendarCheck2 size={16} /></span><div className="reminder-copy"><strong>{pendingTasks.length ? `${pendingTasks.length} 项待办` : "今日没有待办"}</strong><span>{pendingTasks.length ? pendingTasks.slice(0, 3).map((t) => t.title).join("、") : "所有任务都完成了"}</span></div><ChevronRight size={15} /></button>{schedule.length > 0 && <button type="button" className="reminder-row" onClick={() => go("tasks")}><span className="reminder-icon"><Clock3 size={16} /></span><div className="reminder-copy"><strong>今日日程</strong><span>{schedule.slice(0, 3).map((s) => `${s.time} ${s.title}`).join(" · ")}</span></div><ChevronRight size={15} /></button>}<button type="button" className="reminder-row" onClick={() => go("finance")}><span className="reminder-icon"><WalletCards size={16} /></span><div className="reminder-copy"><strong>{overBudget ? "本月已超支" : "本月预算"}</strong><span>{budget > 0 ? `已花 ${formatMoney(monthSpent)} · 预算 ${formatMoney(budget)} · 剩余 ${formatMoney(budget - monthSpent)}` : "还没有设置月预算"}</span></div><ChevronRight size={15} /></button><button type="button" className="reminder-row" onClick={() => go("health")}><span className="reminder-icon"><HeartPulse size={16} /></span><div className="reminder-copy"><strong>{health ? "今日健康已记录" : "还没记录今日健康"}</strong><span>{health ? `睡眠 ${Math.round(health.sleepMinutes / 60)} 小时 · ${health.steps} 步` : "去记录睡眠、运动和步数"}</span></div><ChevronRight size={15} /></button>{todayFocus > 0 && <button type="button" className="reminder-row" onClick={() => go("focus")}><span className="reminder-icon"><TimerReset size={16} /></span><div className="reminder-copy"><strong>今日专注</strong><span>{todayFocus} 分钟</span></div><ChevronRight size={15} /></button>}</div>;
}

export { CommandPalette, EditorModal, ReminderPanel };
