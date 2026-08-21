import { Flame, Pause, Play, RotateCcw, TimerReset, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createId, dateKey, shiftedDateKey } from "../../workbench-data";
import { useWorkbench, weekdays } from "../context";
import { IconButton, MiniBars, PageIntro, SectionTitle } from "../ui";

export function FocusPage() {
  const { data, updateData, notify } = useWorkbench();
  const today = dateKey();
  const todayTasks = data.tasks.filter((task) => task.date === today && !task.done);
  const [duration, setDuration] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const selectedTask = data.tasks.find((task) => task.id === selectedTaskId);
  const todaySessions = data.focusSessions.filter((session) => session.date === today);
  const todayMinutes = todaySessions.reduce((sum, session) => sum + session.minutes, 0);
  const recentSessions = [...data.focusSessions].sort((a, b) => `${b.date}${b.startedAt}`.localeCompare(`${a.date}${a.startedAt}`)).slice(0, 6);
  const weekKeys = Array.from({ length: 7 }, (_, index) => shiftedDateKey(index - 6));
  const weekMinutes = weekKeys.map((key) => data.focusSessions.filter((session) => session.date === key).reduce((sum, session) => sum + session.minutes, 0));
  const timerProgress = Math.max(0, Math.min(100, ((duration * 60 - secondsLeft) / (duration * 60)) * 100));
  const saveSession = (minutes: number) => {
    const now = new Date();
    const label = selectedTask?.title ?? "自由专注";
    updateData((current) => ({ ...current, focusSessions: [{ id: createId("focus"), date: dateKey(now), startedAt: now.toTimeString().slice(0, 5), minutes, label, ...(selectedTask ? { taskId: selectedTask.id } : {}) }, ...current.focusSessions] }));
    notify(`已记录 ${minutes} 分钟专注；关联任务不会被自动完成`);
  };

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!running || secondsLeft > 0) return;
    setRunning(false);
    saveSession(duration);
    setSecondsLeft(duration * 60);
  // saveSession intentionally reads the task selected for this completed round.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, running]);

  const chooseDuration = (minutes: number) => { if (running) return; setDuration(minutes); setSecondsLeft(minutes * 60); };
  const completeEarly = () => {
    const elapsed = duration * 60 - secondsLeft;
    if (elapsed <= 0) { notify("请先开始一轮专注"); return; }
    const minutes = Math.max(1, Math.ceil(elapsed / 60));
    setRunning(false); saveSession(minutes); setSecondsLeft(duration * 60);
  };
  const resetTimer = () => { setRunning(false); setSecondsLeft(duration * 60); notify("计时器已重置，本轮未写入记录"); };
  const removeSession = (id: string) => { updateData((current) => ({ ...current, focusSessions: current.focusSessions.filter((session) => session.id !== id) })); notify("专注记录已删除"); };
  const clock = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return <div className="page-stack page-enter"><PageIntro eyebrow="FOCUS & GROW" title="投入一段时间，心无旁骛" copy="这里是独立的番茄学习模式。只有完成或主动结束一轮，才会产生专注记录；它可以关联任务，但不会代替任务的完成状态。" /><section className="focus-workspace"><article className="focus-timer-card panel-purple"><div className="focus-timer-head"><span><TimerReset size={18} /> {running ? "正在专注" : secondsLeft < duration * 60 ? "已暂停" : "准备开始"}</span><small>{selectedTask ? `关联：${selectedTask.title}` : "自由专注"}</small></div><div className="focus-clock" style={{ "--focus-progress": `${timerProgress * 3.6}deg` } as React.CSSProperties}><div><strong>{clock}</strong><span>{duration} 分钟模式</span></div></div><div className="focus-controls"><button type="button" className="button button-light focus-start" onClick={() => setRunning((value) => !value)}>{running ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}{running ? "暂停" : secondsLeft < duration * 60 ? "继续" : "开始专注"}</button><IconButton label="重置计时" className="focus-control-icon" onClick={resetTimer}><RotateCcw size={17} /></IconButton></div><button type="button" className="focus-finish-button" onClick={completeEarly}>提前结束并记录实际时长</button></article><aside className="focus-setup"><article className="panel focus-settings-card"><SectionTitle eyebrow="SESSION" title="设置这一轮" /><label className="focus-task-select"><span>关联任务（可选）</span><select value={selectedTaskId} onChange={(event) => setSelectedTaskId(event.target.value)} disabled={running}><option value="">自由专注，不关联任务</option>{todayTasks.map((task) => <option value={task.id} key={task.id}>{task.title}</option>)}</select><small>关联仅用于回顾，不会自动勾选任务。</small></label><div className="focus-presets"><span>专注模式</span><div>{[25, 45, 60].map((minutes) => <button type="button" key={minutes} className={duration === minutes ? "active" : ""} onClick={() => chooseDuration(minutes)} disabled={running}>{minutes}<small>min</small></button>)}</div></div></article><article className="focus-today-card panel"><span className="focus-today-icon"><Flame size={21} /></span><div><small>今日成长</small><strong>{todayMinutes} 分钟</strong><span>{todaySessions.length} 轮已保存</span></div><p>数据来自本页的专注记录，不再根据任务完成情况推算。</p></article></aside></section><section className="focus-review-grid"><article className="panel focus-week-card"><SectionTitle eyebrow="LAST 7 DAYS" title="近七天专注" action={<span className="status-pill"><TimerReset size={14} /> 真实记录</span>} /><MiniBars values={weekMinutes} labels={weekKeys.map((key) => weekdays[new Date(`${key}T12:00:00`).getDay()])} /><p>每天的柱高等于当日已保存的专注分钟总和。</p></article><article className="panel focus-history-card"><SectionTitle eyebrow="HISTORY" title="最近专注" /><div className="focus-session-list">{recentSessions.map((session) => <div className="focus-session-row" key={session.id}><span><TimerReset size={16} /></span><p><strong>{session.label}</strong><small>{session.date} · {session.startedAt}{session.taskId ? " · 已关联任务" : ""}</small></p><b>{session.minutes}m</b><IconButton label="删除专注记录" onClick={() => removeSession(session.id)}><Trash2 size={15} /></IconButton></div>)}{!recentSessions.length && <div className="empty-state compact-empty"><TimerReset size={30} /><strong>还没有专注记录</strong><span>完成第一轮后会出现在这里</span></div>}</div></article></section></div>;
}
