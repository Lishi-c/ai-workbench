import { CalendarCheck2, CheckCircle2, CheckSquare2, ChevronLeft, ChevronRight, Plus, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { dateKey } from "../../workbench-data";
import { safePercent, useWorkbench, weekdays } from "../context";
import { getDateLabel } from "../calendar-festivals";
import { IconButton, PageIntro, ProgressRing, SectionTitle, TaskRow } from "../ui";

export function TasksPage() {
  const { data, openModal, holidays, loadHolidays } = useWorkbench();
  const [filter, setFilter] = useState<"全部" | "待完成" | "已完成">("全部");
  const [selectedDate, setSelectedDate] = useState(dateKey());
  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${selectedDate}T12:00:00`);
    const mondayOffset = date.getDay() === 0 ? -6 : 1 - date.getDay();
    date.setDate(date.getDate() + mondayOffset + index);
    return { key: dateKey(date), day: weekdays[date.getDay()], number: String(date.getDate()).padStart(2, "0") };
  }), [selectedDate]);
  const dayTasks = data.tasks.filter((task) => task.date === selectedDate);
  const dayEvents = data.schedule.filter((item) => item.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time));
  const filtered = dayTasks.filter((task) => filter === "全部" || (filter === "已完成" ? task.done : !task.done));
  const completedThisWeek = data.tasks.filter((task) => week.some((day) => day.key === task.date) && task.done).length;
  const shiftWeek = (days: number) => { const next = new Date(`${selectedDate}T12:00:00`); next.setDate(next.getDate() + days); setSelectedDate(dateKey(next)); };
  const selectedYear = Number(selectedDate.slice(0, 4));
  useEffect(() => { loadHolidays(selectedYear); }, [selectedYear, loadHolidays]);
  return <div className="page-stack page-enter">
    <PageIntro eyebrow="TIME PLANNER" title="把时间放进计划里" copy="任务用来追踪要完成的结果；日程用来占住确定的时间、地点与时长，两者可以关联，但不会互相冒充。" actions={<button className="button button-primary" onClick={() => openModal("plan", selectedDate)}><Plus size={17} /> 新建计划</button>} />
    <section className="planner-guide" aria-label="任务与日程使用说明"><article><span className="planner-guide-icon task-guide-icon"><CheckSquare2 size={19} /></span><div><strong>任务 · 要完成什么</strong><p>有待完成与已完成状态，可设置日期和预计投入；适合报告、练习、整理等有结果的事项。</p></div></article><article><span className="planner-guide-icon schedule-guide-icon"><CalendarCheck2 size={19} /></span><div><strong>日程 · 什么时候发生</strong><p>记录固定时间、地点和时长；适合会议、课程、预约等，不需要再勾选“完成”。</p></div></article></section>
    <section className="week-card panel"><div className="week-head"><IconButton label="上周" onClick={() => shiftWeek(-7)}><ChevronLeft size={18} /></IconButton><div><strong>{new Date(`${selectedDate}T12:00:00`).getFullYear()} 年 {new Date(`${selectedDate}T12:00:00`).getMonth() + 1} 月</strong><span>选择日期，同时查看任务与日程</span></div><IconButton label="下周" onClick={() => shiftWeek(7)}><ChevronRight size={18} /></IconButton></div><div className="week-days">{week.map((day) => { const taskCount = data.tasks.filter((task) => task.date === day.key).length; const eventCount = data.schedule.filter((item) => item.date === day.key).length; const label = getDateLabel(holidays, day.key); return <button type="button" className={selectedDate === day.key ? "active" : ""} key={day.key} onClick={() => setSelectedDate(day.key)}><small>{day.day}</small><strong>{day.number}</strong>{label && <small className={`festival-label${label.workday ? " is-workday" : ""}`}>{label.text}</small>}<span>{taskCount} 任务 · {eventCount} 日程</span></button>; })}</div></section>
    <section className="planner-grid"><article className="panel tasks-main"><SectionTitle eyebrow={`${dayTasks.length} TASKS`} title="任务清单" /><div className="planner-control planner-task-filter">{(["全部", "待完成", "已完成"] as const).map((item) => <button type="button" key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="task-list task-list-large planner-detail-list">{filtered.length ? filtered.map((task) => <TaskRow key={task.id} task={task} />) : <div className="empty-state"><CheckCircle2 size={32} /><strong>这一天暂时没有对应任务</strong><span>新建后可在这里勾选完成</span></div>}</div><button className="add-row" type="button" onClick={() => openModal("task", selectedDate)}><Plus size={17} /> 添加任务</button></article><article className="panel planner-schedule"><SectionTitle eyebrow={`${dayEvents.length} EVENTS`} title="日程安排" /><div className="planner-control planner-date-label"><CalendarCheck2 size={18} /><span>{new Date(`${selectedDate}T12:00:00`).getMonth() + 1} 月 {new Date(`${selectedDate}T12:00:00`).getDate()} 日</span><small>按开始时间排序</small></div><div className="planner-schedule-list planner-detail-list">{dayEvents.map((item) => <button type="button" key={item.id} onClick={() => openModal("schedule", selectedDate)}><time>{item.time}</time><span className={`schedule-dot ${item.tone}`} /><p><strong>{item.title}</strong><small>{item.location} · {item.duration} 分钟{item.sourceTaskId ? " · 关联任务" : ""}</small></p></button>)}{!dayEvents.length && <button type="button" className="planner-empty" onClick={() => openModal("schedule", selectedDate)}><CalendarCheck2 size={28} /><strong>这一天还没有日程</strong><span>添加会议、课程或预约</span></button>}</div><button className="add-row" type="button" onClick={() => openModal("schedule", selectedDate)}><Plus size={17} /> 添加日程</button></article></section>
    <section className="planner-summary-grid"><article className="panel progress-panel"><span className="section-eyebrow">DAY PROGRESS</span><h2>任务完成度</h2><ProgressRing value={safePercent(dayTasks.filter((task) => task.done).length, dayTasks.length)} label="已完成" size="large" /><div className="progress-pairs"><span><strong>{dayTasks.filter((task) => task.done).length}</strong> 已完成</span><span><strong>{dayTasks.filter((task) => !task.done).length}</strong> 待处理</span></div></article><article className="panel goal-card"><div className="goal-icon"><Target size={20} /></div><div><span>本周任务目标</span><strong>完成 {data.settings.weeklyTaskGoal} 项任务</strong><small>{Math.max(0, data.settings.weeklyTaskGoal - completedThisWeek)} 项待完成；日程不计入任务目标</small></div><div className="flat-progress"><i style={{ width: `${Math.min(100, safePercent(completedThisWeek, data.settings.weeklyTaskGoal))}%` }} /></div></article></section>
  </div>;
}
