import { ArrowRight, CalendarCheck2, CheckCircle2, ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import { dateKey } from "../../workbench-data";
import { formatMoney, moods, monthNames, safePercent, useWorkbench, weekdays } from "../context";
import { IconButton, SectionTitle, TaskRow } from "../ui";

export function DashboardPage() {
  const { data, navigate } = useWorkbench();
  const today = dateKey();
  const now = new Date();
  const tasks = data.tasks.filter((task) => task.date === today);
  const events = data.schedule.filter((item) => item.date === today).sort((a, b) => a.time.localeCompare(b.time));
  const completed = tasks.filter((task) => task.done).length;
  const monthLedger = data.ledger.filter((item) => item.date.slice(0, 7) === today.slice(0, 7));
  const income = monthLedger.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expense = monthLedger.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const todayFocusSessions = data.focusSessions.filter((session) => session.date === today);
  const focusMinutes = todayFocusSessions.reduce((sum, session) => sum + session.minutes, 0);
  const mondayOffset = now.getDay() === 0 ? -6 : 1 - now.getDay();
  const weekKeys = Array.from({ length: 7 }, (_, index) => { const date = new Date(now); date.setDate(now.getDate() + mondayOffset + index); return dateKey(date); });
  const weekValues = weekKeys.map((key) => data.focusSessions.filter((session) => session.date === key).reduce((sum, session) => sum + session.minutes, 0));
  const completion = safePercent(completed, tasks.length);
  const balance = income - expense;
  const mood = moods.find((item) => item.id === data.moodLogs[today]);

  return <div className="page-stack moonblue-dashboard page-enter">
    <header className="moonblue-dashboard-head">
      <div>
        <span className="section-eyebrow">DAILY OVERVIEW · {String(now.getMonth() + 1).padStart(2, "0")}.{String(now.getDate()).padStart(2, "0")}</span>
        <h1>今日工作台</h1>
        <p>{data.settings.displayName}，把注意力留给真正重要的事。</p>
      </div>
      <button className="moonblue-date-chip" type="button" onClick={() => navigate("tasks")}>
        <span>{monthNames[now.getMonth()]}</span>
        <strong>{String(now.getDate()).padStart(2, "0")}</strong>
        <small>星期{weekdays[now.getDay()]}</small>
      </button>
    </header>

    <section className="moonblue-overview-grid">
      <article className="panel moonblue-flow-card">
        <div className="moonblue-card-head">
          <div><span>WEEKLY FLOW</span><h2>本周生活节奏</h2></div>
          <button type="button" onClick={() => navigate("focus")}>查看专注记录 <ArrowRight size={15} /></button>
        </div>
        <div className="moonblue-stat-row">
          <div><span>任务完成</span><strong>{completion}%</strong><small>{completed} / {tasks.length} 项</small></div>
          <div><span>今日专注</span><strong>{focusMinutes}<em> min</em></strong><small>{todayFocusSessions.length} 个时段</small></div>
          <div><span>本月结余</span><strong>{formatMoney(balance)}</strong><small>{monthLedger.length} 笔记录</small></div>
          <div><span>今日安排</span><strong>{events.length}<em> 场</em></strong><small>按时间排序</small></div>
        </div>
        <div className="moonblue-flow-visual" aria-label={`本周专注数据：${weekValues.join("、")} 分钟`}>
          <div className="moonblue-chart-grid" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="moonblue-flow-bars" aria-hidden="true">{weekValues.map((value, index) => <div className="moonblue-flow-bar-col" key={index}><span className={`moonblue-flow-bar ${value === Math.max(...weekValues) && value > 0 ? "is-peak" : ""}`} style={{ height: `${Math.max(value ? 10 : 3, (value / Math.max(1, ...weekValues)) * 100)}%` }} /></div>)}</div>
          <div className="moonblue-chart-days">{["一", "二", "三", "四", "五", "六", "日"].map((day, index) => <span key={day} className={weekValues[index] === Math.max(...weekValues) && weekValues[index] > 0 ? "is-peak" : ""}>周{day}</span>)}</div>
        </div>
        <footer className="moonblue-insight-row">
          <div><span className="signal-dot pink" /><p><strong>{Math.max(...weekValues, 0)} 分钟</strong><small>本周单日最高专注</small></p></div>
          <div><span className="signal-dot blue" /><p><strong>{completion >= 60 ? "节奏稳定" : "留一点余量"}</strong><small>根据今日任务完成度</small></p></div>
          <div><span className="signal-dot neutral" /><p><strong>{balance >= 0 ? "收支平衡" : "关注支出"}</strong><small>来自本月实时账单</small></p></div>
        </footer>
      </article>

      <button className="moonblue-copilot" type="button" onClick={() => navigate("diary")}>
        <div className="moonblue-copilot-head"><span>MOOD SIGNAL</span><span className="moonblue-copilot-action">{mood ? "查看心情记录" : "记录此刻心情"}<ArrowRight size={15} /></span></div>
        <div className="moonblue-fluid-orb" aria-hidden="true"><i /><i /><i /></div>
        <div className="moonblue-copilot-copy">
          <span>{mood ? `今天是「${mood.label}」` : "此刻的内在天气"}</span>
          <h2>{mood ? "为今天留下一点感受" : "你现在感觉如何？"}</h2>
          <p>不急着定义情绪，先用几句话把它轻轻放在这里。</p>
        </div>
      </button>
    </section>

    <section className="moonblue-work-grid">
      <article className="panel moonblue-priority-panel">
        <SectionTitle eyebrow="PRIORITIES" title="今天的优先事项" action={<button className="text-button" type="button" onClick={() => navigate("tasks")}>管理全部 <ChevronRight size={15} /></button>} />
        <div className="moonblue-table-head"><span>任务</span><span>标签</span><span>时间</span></div>
        <div className="task-list">{tasks.slice(0, 5).map((task) => <TaskRow key={task.id} task={task} compact />)}{!tasks.length && <div className="empty-state compact-empty"><CheckCircle2 size={28} /><strong>今天还没有任务</strong></div>}</div>
        <button className="add-row" type="button" onClick={() => navigate("tasks")}><Plus size={17} /> 添加一项计划</button>
      </article>

      <article className="panel moonblue-agenda-panel">
        <SectionTitle eyebrow="AGENDA" title="接下来的安排" action={<IconButton label="前往时间计划" onClick={() => navigate("tasks")}><MoreHorizontal size={18} /></IconButton>} />
        <div className="moonblue-agenda-list">{events.slice(0, 4).map((item, index) => <button type="button" key={item.id} onClick={() => navigate("tasks")}><time>{item.time}</time><span className={`schedule-dot ${item.tone}`} /><p><strong>{item.title}</strong><small>{item.location} · {item.duration} min</small></p>{index === 0 && <em>下一项</em>}</button>)}{!events.length && <button type="button" className="moonblue-agenda-empty" onClick={() => navigate("tasks")}><CalendarCheck2 size={23} /><span>今天没有固定日程</span><small>给自己留一点自由时间</small></button>}</div>
      </article>
    </section>
  </div>;
}
