import { Check, ChevronLeft, ChevronRight, MessageCircleHeart, PenLine, Plus, Quote, RotateCcw, Search, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createId, dateKey, type DiaryEntry, type MoodId } from "../../workbench-data";
import { moods, useWorkbench } from "../context";
import { renderMarkdown, MdToolbar } from "./md";
import { getDateLabel } from "../calendar-festivals";
import { ConfirmDialog, FormField, IconButton, PageIntro, SectionTitle } from "../ui";

function buildCalendar(cursor: Date) {
  const year = cursor.getFullYear(); const month = cursor.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const first = new Date(year, month, 1).getDay();
  const blanks = first === 0 ? 6 : first - 1;
  return [...Array.from({ length: blanks }, () => null), ...Array.from({ length: days }, (_, index) => index + 1)];
}

function highlightText(text: string, keyword: string) {
  if (!keyword) return text;
  const lower = text.toLowerCase();
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (let hit = lower.indexOf(keyword); hit >= 0; hit = lower.indexOf(keyword, cursor)) {
    if (hit > cursor) nodes.push(text.slice(cursor, hit));
    nodes.push(<mark className="note-hit" key={`${hit}-${nodes.length}`}>{text.slice(hit, hit + keyword.length)}</mark>);
    cursor = hit + keyword.length;
  }
  nodes.push(text.slice(cursor));
  return nodes;
}

function RecentNotes({ entries, onOpen }: { entries: DiaryEntry[]; onOpen: (id: string) => void }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (searchOpen) inputRef.current?.focus(); }, [searchOpen]);
  const closeSearch = () => { setSearchOpen(false); setQuery(""); };
  const keyword = query.trim().toLowerCase();
  const sorted = [...entries].sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  const visible = keyword ? sorted.filter((entry) => entry.title.toLowerCase().includes(keyword) || entry.date.includes(keyword) || entry.content.toLowerCase().includes(keyword)) : sorted;
  return <article className="panel recent-notes">
    <SectionTitle eyebrow={keyword ? "SEARCH" : "RECENT"} title={keyword ? `搜索结果 · ${visible.length} 篇` : "最近记录"} action={<IconButton label={searchOpen ? "关闭搜索" : "搜索日记"} className="recent-notes-toggle" onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}>{searchOpen ? <X size={16} /> : <Search size={16} />}</IconButton>} />
    {searchOpen && <div className="recent-notes-search"><Search size={14} /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索日期或标题…" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); closeSearch(); } }} /></div>}
    <div className="recent-notes-list">
      {!entries.length ? <p className="recent-notes-empty">还没有日记，点「今日记录」写下第一篇</p>
        : !visible.length ? <p className="recent-notes-empty">没有找到匹配的日记</p>
          : visible.map((entry) => { const moodIndex = moods.findIndex((m) => m.id === entry.mood); return <button type="button" className="recent-note" key={entry.id} onClick={() => onOpen(entry.id)}><i className={`recent-note-dot mood-dot-${moodIndex}`} /><span className="recent-note-copy"><strong>{highlightText(entry.title || "无标题", keyword)}</strong><small>{highlightText(`${entry.date} · ${entry.time}`, keyword)}</small></span><ChevronRight size={14} /></button>; })}
    </div>
  </article>;
}

export function DiaryPage() {
  const { data, updateData, notify, holidays, loadHolidays } = useWorkbench();
  const today = dateKey();
  const [cursor, setCursor] = useState(() => new Date());
  const [promptIndex, setPromptIndex] = useState(0);
  const [viewingDiaryId, setViewingDiaryId] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState<string | null>(null);
  const prompts = ["最近有什么小事，让你觉得被治愈？", "今天哪一个瞬间最值得被记住？", "此刻的你，最想感谢什么？"];
  const chooseMood = (mood: MoodId) => { updateData((current) => ({ ...current, moodLogs: { ...current.moodLogs, [today]: mood } })); notify(`今天的心情已记录为「${moods.find((item) => item.id === mood)?.label}」`); };
  const days = buildCalendar(cursor);
  const cursorPrefix = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
  const moveMonth = (offset: number) => setCursor((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  const cursorYear = cursor.getFullYear();
  useEffect(() => { loadHolidays(cursorYear); }, [cursorYear, loadHolidays]);
  const calendarRef = useRef<HTMLElement>(null);
  const [sideHeight, setSideHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const element = calendarRef.current;
    if (!element) return;
    const stacked = window.matchMedia("(max-width: 920px)");
    const sync = () => { const height = element.getBoundingClientRect().height; setSideHeight(stacked.matches || height <= 0 ? null : height); };
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    stacked.addEventListener("change", sync);
    sync();
    return () => { observer.disconnect(); stacked.removeEventListener("change", sync); };
  }, [viewingDiaryId, draftDate]);
  if (viewingDiaryId) return <DiaryEntryPage entryId={viewingDiaryId} onBack={() => setViewingDiaryId(null)} />;
  if (draftDate) return <DiaryEntryPage newDate={draftDate} onBack={() => setDraftDate(null)} />;
  return <div className="page-stack page-enter"><PageIntro eyebrow="DEAR DIARY" title="收好今天的心情" copy="心情选项、心情日历与日记使用同一套四种状态，不再出现名称错位。" actions={<button className="button button-primary" onClick={() => setDraftDate(today)}><Plus size={17} /> 今日记录</button>} /><section className="mood-checkin panel-lilac"><div><span className="section-eyebrow">MOOD CHECK-IN</span><h2>此刻的你，感觉怎么样？</h2><p>选择后会立刻写入今天的心情日历。</p></div><div className="mood-options">{moods.map((item) => { const Icon = item.icon; const active = data.moodLogs[today] === item.id; return <button type="button" key={item.id} className={`${active ? "active" : ""} tone-${item.tone}`} onClick={() => chooseMood(item.id)}><span><Icon size={23} /></span><strong>{item.label}</strong>{active && <i><Check size={11} /></i>}</button>; })}</div></section><section className="diary-grid"><article className="panel mood-calendar" ref={calendarRef}><SectionTitle eyebrow={`${cursor.getFullYear()} · ${String(cursor.getMonth() + 1).padStart(2, "0")}`} title="心情日历" action={<div className="calendar-nav"><IconButton label="上个月" onClick={() => moveMonth(-1)}><ChevronLeft size={16} /></IconButton><IconButton label="下个月" onClick={() => moveMonth(1)}><ChevronRight size={16} /></IconButton></div>} /><div className="calendar-week"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div className="calendar-days">{days.map((day, index) => { const key = day ? `${cursorPrefix}-${String(day).padStart(2, "0")}` : ""; const mood = day ? data.moodLogs[key] : undefined; const moodIndex = moods.findIndex((item) => item.id === mood); const diaryEntry = day ? data.diaryEntries.find((e) => e.date === key) : undefined; const hasDiary = !!diaryEntry; const diaryTitle = diaryEntry?.title ?? ""; const label = day ? getDateLabel(holidays, key) : null; return <button type="button" className={`${key === today ? "today" : ""} ${mood ? `has-mood mood-${moodIndex}` : ""} ${hasDiary ? "has-diary" : ""}`} key={`${key}-${index}`} disabled={!day} onClick={() => { if (!day) return; const entry = data.diaryEntries.find((e) => e.date === key); if (entry) setViewingDiaryId(entry.id); else setDraftDate(key); }} title={hasDiary ? "查看日记" : (mood ? moods[moodIndex].label : "写日记")}>{hasDiary && <small className="diary-day-title">{diaryTitle || "日记"}</small>}<span>{day ?? ""}</span>{label && <small className={`festival-label${label.workday ? " is-workday" : ""}`}>{label.text}</small>}</button>; })}</div><div className="calendar-legend">{moods.map((item, index) => <span key={item.id}><i className={`mood-${index}`} />{item.label}</span>)}</div></article><aside className="diary-side" style={sideHeight ? { height: sideHeight } : undefined}><article className="quote-card panel-purple"><Quote size={27} /><p>“平凡的一天，也会因为被认真感受而闪闪发光。”</p><span>今日寄语</span><Sparkles className="quote-sparkle" size={20} /></article><article className="panel writing-prompt"><span className="prompt-icon"><MessageCircleHeart size={20} /></span><div><small>今日书写灵感</small><strong>{prompts[promptIndex]}</strong></div><button type="button" onClick={() => setPromptIndex((value) => (value + 1) % prompts.length)}><RotateCcw size={15} /> 换一个</button></article><RecentNotes entries={data.diaryEntries} onOpen={setViewingDiaryId} /></aside></section></div>;
}

export function DiaryEntryPage({ entryId, newDate, onBack }: { entryId?: string; newDate?: string; onBack: () => void }) {
  const { data, updateData, notify } = useWorkbench();
  const entry = entryId ? data.diaryEntries.find((e) => e.id === entryId) : undefined;
  const [editing, setEditing] = useState(!entryId);
  const [date, setDate] = useState(entry?.date ?? newDate ?? "");
  const [time, setTime] = useState(entry?.time ?? new Date().toTimeString().slice(0, 5));
  const [title, setTitle] = useState(entry?.title ?? "");
  const [content, setContent] = useState(entry?.content ?? "");
  const [mood, setMood] = useState<MoodId>(entry?.mood ?? (newDate ? data.moodLogs[newDate] ?? "good" : "good"));
  const [tags, setTags] = useState((entry?.tags ?? []).join("，"));
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setDate(entry?.date ?? newDate ?? ""); setTime(entry?.time ?? new Date().toTimeString().slice(0, 5)); setTitle(entry?.title ?? ""); setContent(entry?.content ?? ""); setMood(entry?.mood ?? (newDate ? data.moodLogs[newDate] ?? "good" : "good")); setTags((entry?.tags ?? []).join("，")); setEditing(!entry?.content);
  }, [entryId, newDate]);

  if (!entry && !newDate) return <div className="page-stack page-enter"><PageIntro eyebrow="DIARY" title="日记不存在" copy="这条日记可能已被删除。" actions={<button className="button button-soft" onClick={onBack}><ChevronLeft size={16} /> 返回</button>} /></div>;

  const moodInfo = moods.find((m) => m.id === mood);
  const cleanedTags = () => tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean);

  const save = () => {
    if (entryId) {
      updateData((current) => ({
        ...current,
        moodLogs: { ...current.moodLogs, [date]: mood },
        diaryEntries: current.diaryEntries.map((e) => (e.id === entryId ? { ...e, date, time, title: title.trim(), content, tags: cleanedTags(), mood } : e)),
      }));
      notify("日记已保存");
      setEditing(false);
    } else {
      updateData((current) => ({
        ...current,
        moodLogs: { ...current.moodLogs, [date]: mood },
        diaryEntries: [{ id: createId("diary"), date, time, title: title.trim(), content, tags: cleanedTags(), mood }, ...current.diaryEntries],
      }));
      notify("日记已保存");
      onBack();
    }
  };

  const removeEntry = () => { updateData((current) => ({ ...current, diaryEntries: current.diaryEntries.filter((e) => e.id !== entryId) })); notify("已删除日记"); onBack(); };

  return <div className="page-stack page-enter doc-page"><PageIntro eyebrow="DIARY" title={title || "无标题"} copy={`${date} · ${time} · ${moodInfo?.label ?? ""}`} actions={<div className="page-action-group">{!editing && <button className="button button-soft" onClick={() => setEditing(true)}><PenLine size={16} /> 编辑</button>}<button className="button button-soft" onClick={onBack}><ChevronLeft size={16} /> 返回</button></div>} />{editing ? <form onSubmit={(event) => { event.preventDefault(); save(); }}><div className="form-grid"><FormField label="日期" name="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /><FormField label="时间" name="time" type="time" value={time} onChange={(event) => setTime(event.target.value)} required /><FormField label="标题" name="title" value={title} onChange={(event) => setTitle(event.target.value)} required /><label className="form-field"><span>心情</span><select value={mood} onChange={(event) => setMood(event.target.value as MoodId)}>{moods.map((m) => <option value={m.id} key={m.id}>{m.label}</option>)}</select></label><div className="form-field full-field"><span>正文</span><MdToolbar elRef={contentRef} set={setContent} /><textarea ref={contentRef} value={content} onChange={(event) => setContent(event.target.value)} rows={10} required /></div><FormField label="标签（逗号分隔）" name="tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="散步，小确幸" /></div><div className="modal-actions"><button type="button" className="button button-soft" onClick={() => { if (entryId) setEditing(false); else onBack(); }}>取消</button><button type="submit" className="button button-primary">保存</button></div></form> : <section className="panel diary-page-body"><div className="doc-view-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(entry?.content ?? "") }} />{(entry?.tags ?? []).length > 0 && <div className="entry-tags">{(entry?.tags ?? []).map((tag) => <span key={tag}>{tag}</span>)}</div>}</section>}{!editing && entryId && <div className="doc-page-footer"><button type="button" className="button button-soft" onClick={() => setConfirmingDelete(true)}><Trash2 size={16} /> 删除日记</button></div>}{confirmingDelete && <ConfirmDialog title="删除这篇日记？" copy="删除后无法恢复，且无法撤销。" onCancel={() => setConfirmingDelete(false)} onConfirm={removeEntry} />}</div>;
}
