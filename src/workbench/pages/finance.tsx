import { ArrowDownRight, ArrowUpRight, ChevronRight, Coffee, HandCoins, Home, Plus, Settings, ShoppingBag, Sparkles, Upload, WalletCards } from "lucide-react";
import { useState } from "react";
import { createId, dateKey } from "../../workbench-data";
import { parseBillCSV } from "../bill-import";
import { formatMoney, safePercent, useWorkbench } from "../context";
import { readTextFile } from "../storage";
import { IconButton, PageIntro, ProgressRing, SectionTitle } from "../ui";

export function FinancePage() {
  const { data, updateData, openModal, notify } = useWorkbench();
  const [period, setPeriod] = useState<"月" | "年">("月");
  const [showAll, setShowAll] = useState(false);
  const today = dateKey();
  const entries = data.ledger.filter((item) => period === "年" ? item.date.slice(0, 4) === today.slice(0, 4) : item.date.slice(0, 7) === today.slice(0, 7));
  const income = entries.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expense = entries.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const expenseEntries = entries.filter((item) => item.type === "expense");
  const categories = ["居住", "餐饮", "购物", "其他"].map((name, index) => ({ name, value: expenseEntries.filter((item) => item.category === name).reduce((sum, item) => sum + item.amount, 0), tone: ["purple", "pink", "sand", "blue"][index] }));
  const categoryStops = categories.reduce<{ cursor: number; value: string[] }>((state, item, index) => { const next = state.cursor + safePercent(item.value, expense); state.value.push(`${["#5b9dc0", "#c07898", "#8ab8d0", "#b0cede"][index]} ${state.cursor}% ${next}%`); return { cursor: next, value: state.value }; }, { cursor: 0, value: [] }).value.join(", ");
  const bars = Array.from({ length: 12 }, (_, index) => { const bucket = entries.filter((item) => item.type === "expense" && (period === "月" ? Math.min(11, Math.floor((Number(item.date.slice(8, 10)) - 1) / 3)) === index : Number(item.date.slice(5, 7)) - 1 === index)); return bucket.reduce((sum, item) => sum + item.amount, 0); });
  const maxBar = Math.max(1, ...bars);
  const recent = [...data.ledger].sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  const monthKeys = Array.from({ length: 6 }, (_, i) => { const d = new Date(`${today}T12:00:00`); d.setMonth(d.getMonth() - (5 - i)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const monthlyTrend = monthKeys.map((key) => ({ key: `${Number(key.slice(5, 7))}月`, income: data.ledger.filter((item) => item.type === "income" && item.date.startsWith(key)).reduce((sum, item) => sum + item.amount, 0), expense: data.ledger.filter((item) => item.type === "expense" && item.date.startsWith(key)).reduce((sum, item) => sum + item.amount, 0) }));
  const importBill = async (file?: File) => {
    if (!file) return;
    try {
      const text = await readTextFile(file);
      const rows = parseBillCSV(text);
      if (!rows.length) { notify("没有识别到账单数据，请确认是微信/支付宝导出的 CSV 文件"); return; }
      const existing = new Set(data.ledger.map((entry) => entry.sourceId).filter((id): id is string => Boolean(id)));
      const fresh = rows.filter((row) => !existing.has(row.sourceId));
      if (!fresh.length) { notify("这些账单之前已经全部导入过了"); return; }
      updateData((current) => ({ ...current, ledger: [...fresh.map((row) => ({ id: createId("ledger"), type: row.type, amount: row.amount, category: row.category, note: row.note, date: row.date, time: row.time, sourceId: row.sourceId })), ...current.ledger] }));
      notify(fresh.length === rows.length ? `已导入 ${fresh.length} 条账单` : `已导入 ${fresh.length} 条账单（跳过 ${rows.length - fresh.length} 条重复）`);
    } catch { notify("导入失败，请检查文件格式"); }
  };
  return <div className="page-stack page-enter">
    <PageIntro eyebrow="MY LEDGER" title="每一笔，都心中有数" copy="收入、支出、预算和分类图表全部来自同一份账单数据。" actions={<div className="page-action-group"><label className="button button-soft" title="导入微信/支付宝账单 CSV"><Upload size={16} /> 导入账单<input type="file" accept=".csv,.txt,text/csv" style={{ display: "none" }} onChange={(event) => { void importBill(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label><button className="button button-primary" onClick={() => openModal("transaction")}><Plus size={17} /> 新记账单</button></div>} />
    <section className="finance-hero panel-purple"><div className="finance-balance"><span>可用结余 · {today.slice(5, 7)} 月</span><strong>{formatMoney(income - expense)}</strong><p><WalletCards size={15} /> 本月实时结余</p></div><div className="finance-summary"><div><span className="summary-icon income"><ArrowDownRight size={17} /></span><p><small>本月收入</small><strong>{formatMoney(income)}</strong></p></div><div><span className="summary-icon expense"><ArrowUpRight size={17} /></span><p><small>本月支出</small><strong>{formatMoney(expense)}</strong></p></div></div><div className="coin-art" aria-hidden="true"><span>¥</span><i /><i /><i /></div></section>
    <section className="finance-grid"><article className="panel spending-card"><SectionTitle eyebrow="OVERVIEW" title="收支趋势" action={<div className="segmented"><button className={period === "月" ? "active" : ""} onClick={() => setPeriod("月")}>月</button><button className={period === "年" ? "active" : ""} onClick={() => setPeriod("年")}>年</button></div>} /><div className="chart-summary"><div><span>总支出</span><strong>{formatMoney(expense)}</strong></div><span className="down-note"><ArrowDownRight size={14} /> {entries.length} 笔记录</span></div><div className="finance-chart">{bars.map((value, index) => <span key={index} style={{ height: `${Math.max(value ? 12 : 4, (value / maxBar) * 100)}%` }} className={value === maxBar ? "active" : ""} />)}</div><div className="chart-axis"><span>{period === "月" ? "01" : "1月"}</span><span>{period === "月" ? "08" : "4月"}</span><span>{period === "月" ? "15" : "7月"}</span><span>{period === "月" ? "22" : "10月"}</span><span>{period === "月" ? "31" : "12月"}</span></div></article><article className="panel budget-card"><SectionTitle eyebrow="BUDGET" title="本月预算" action={<IconButton label="预算设置" onClick={() => openModal("budget")}><Settings size={17} /></IconButton>} /><ProgressRing value={safePercent(expense, data.settings.monthlyBudget)} label="已使用" size="large" /><div className="budget-copy"><strong>{formatMoney(expense)}</strong><span> / {formatMoney(data.settings.monthlyBudget)}</span><small>剩余 {formatMoney(Math.max(0, data.settings.monthlyBudget - expense))}</small></div><div className="budget-tip"><Sparkles size={16} /> {expense <= data.settings.monthlyBudget ? "目前仍在预算范围内" : `已超出预算 ${formatMoney(expense - data.settings.monthlyBudget)}`}</div></article></section>
    <section className="finance-bottom-grid"><article className="panel category-card"><SectionTitle eyebrow="CATEGORIES" title="支出去向" /><div className="category-content"><div className="category-ring" style={{ background: expense ? `conic-gradient(${categoryStops})` : "#d8eaf5" }}><span><strong>{formatMoney(expense)}</strong><small>总支出</small></span></div><div className="category-list">{categories.map((item) => <div key={item.name}><i className={item.tone} /><span>{item.name}</span><strong>{safePercent(item.value, expense)}%</strong></div>)}</div></div></article><article className="panel transaction-card"><SectionTitle eyebrow="RECENT" title="最近记录" action={<button className="text-button" onClick={() => setShowAll((value) => !value)}>{showAll ? "收起" : "全部账单"} <ChevronRight size={15} /></button>} /><div className="transaction-list">{recent.slice(0, showAll ? recent.length : 4).map((item) => { const Icon = item.type === "income" ? HandCoins : item.category === "餐饮" ? Coffee : item.category === "购物" ? ShoppingBag : item.category === "居住" ? Home : WalletCards; return <div key={item.id} className="transaction-row"><span className={`transaction-icon tone-${item.type === "income" ? "purple" : item.category === "餐饮" ? "pink" : item.category === "购物" ? "blue" : "sand"}`}><Icon size={18} /></span><p><strong>{item.note}</strong><small>{item.category} · {item.date} {item.time}</small></p><b className={item.type === "income" ? "income-text" : ""}>{item.type === "income" ? "+ " : "- "}{formatMoney(item.amount)}</b></div>; })}</div></article></section>
    <section className="panel month-trend-card"><SectionTitle eyebrow="TREND" title="近 6 月收支趋势" action={<span className="month-trend-legend"><i className="income" /> 收入 <i className="expense" /> 支出</span>} /><div className="month-trend">{monthlyTrend.map((m) => { const max = Math.max(1, m.income, m.expense); return <div className="month-trend-item" key={m.key}><div className="month-trend-bars"><i className="income" style={{ height: `${Math.max(4, (m.income / max) * 100)}%` }} /><i className="expense" style={{ height: `${Math.max(4, (m.expense / max) * 100)}%` }} /></div><strong>{m.key}</strong><small>支 {formatMoney(m.expense)}</small></div>; })}</div></section>
  </div>;
}
