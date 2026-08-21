import { Check, Trash2, X } from "lucide-react";
import { useEffect } from "react";
import { createId, dateKey, type WorkbenchTask } from "../workbench-data";
import { useWorkbench } from "./context";

export function WorkspaceTitle({ title }: { title: string }) {
  const breakAt = title.indexOf("的");
  if (breakAt < 0 || breakAt === title.length - 1) return <>{title}</>;
  return <>{title.slice(0, breakAt + 1)}<br />{title.slice(breakAt + 1)}</>;
}

export function IconButton({ label, children, onClick, className = "" }: { label: string; children: React.ReactNode; onClick?: () => void; className?: string }) {
  return <button type="button" className={`icon-button ${className}`} aria-label={label} onClick={onClick}>{children}</button>;
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return <div className="section-heading"><div>{eyebrow && <span className="section-eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{action}</div>;
}

export function MiniBars({ values, tone = "purple", labels }: { values: number[]; tone?: "purple" | "pink" | "sand"; labels?: string[] }) {
  const max = Math.max(1, ...values);
  return <div className={`mini-bars bars-${tone}`}>{values.map((value, index) => <div className="mini-bar-column" key={`${value}-${index}`}><span className="mini-bar" style={{ height: value > 0 ? `${Math.max(12, (value / max) * 100)}%` : "0%" }} />{labels && <small>{labels[index]}</small>}</div>)}</div>;
}

export function ProgressRing({ value, label, size = "medium" }: { value: number; label?: string; size?: "small" | "medium" | "large" }) {
  const clamped = Math.max(0, Math.min(100, value));
  return <div className={`progress-ring ring-${size}`} style={{ "--progress": `${clamped * 3.6}deg` } as React.CSSProperties}><div><strong>{clamped}%</strong>{label && <span>{label}</span>}</div></div>;
}

export function PageIntro({ eyebrow, title, copy, actions }: { eyebrow: string; title: string; copy: string; actions?: React.ReactNode }) {
  return <div className="page-intro"><div><span className="page-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div>{actions && <div className="page-actions">{actions}</div>}</div>;
}

export function TaskRow({ task, compact = false }: { task: WorkbenchTask; compact?: boolean }) {
  const { updateData, notify } = useWorkbench();
  const toggle = () => {
    updateData((current) => {
      let tasks = current.tasks.map((item) => item.id === task.id ? { ...item, done: !item.done } : item);
      if (!task.done && task.repeat) {
        const offset = task.repeat === "daily" ? 1 : task.repeat === "weekly" ? 7 : 30;
        const d = new Date(`${task.date}T12:00:00`);
        d.setDate(d.getDate() + offset);
        tasks = [...tasks, { ...task, id: createId("task"), date: dateKey(d), done: false }];
      }
      return { ...current, tasks };
    });
    notify(task.done ? "任务已恢复为待完成" : task.repeat ? "任务已完成，已自动生成下一次" : "任务已完成，仪表盘进度已同步");
  };
  return <button type="button" className={`task-row ${task.done ? "is-done" : ""} ${compact ? "is-compact" : ""}`} onClick={toggle}><span className={`task-check tone-${task.tone}`}>{task.done && <Check size={14} strokeWidth={3} />}</span><span className="task-copy"><strong>{task.title}</strong><small>{task.meta}</small></span><span className={`task-tag tone-${task.tone}`}>{task.repeat ? `${task.tag} · ${task.repeat === "daily" ? "每天" : task.repeat === "weekly" ? "每周" : "每月"}` : task.tag}</span><time>{task.time}</time></button>;
}

export function ModalHead({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) { return <header className="modal-head"><span className="section-eyebrow">{eyebrow}</span><h2 id="modal-title">{title}</h2><p>{copy}</p></header>; }

export function FormField({ label, name, ...props }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) { return <label className="form-field"><span>{label}</span><input name={name} {...props} /></label>; }

export function FormSelect({ label, name, options, defaultValue }: { label: string; name: string; options: string[][]; defaultValue?: string }) { return <label className="form-field"><span>{label}</span><select name={name} defaultValue={defaultValue}>{options.map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></label>; }

export function ModalActions({ close, label }: { close: () => void; label: string }) { return <div className="modal-actions"><button type="button" className="button button-soft" onClick={close}>取消</button><button type="submit" className="button button-primary">{label}</button></div>; }

export function ConfirmDialog({ title, copy, confirmLabel = "删除", onCancel, onConfirm }: { title: string; copy: string; confirmLabel?: string; onCancel: () => void; onConfirm: () => void }) { useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []); return <div className="modal-backdrop confirm-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}><section className="editor-modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><IconButton label="关闭" className="modal-close" onClick={onCancel}><X size={18} /></IconButton><header className="modal-head"><span className="section-eyebrow">CONFIRM</span><h2 id="confirm-title">{title}</h2><p>{copy}</p></header><div className="modal-actions"><button type="button" className="button button-soft" onClick={onCancel}>取消</button><button type="button" className="button danger-button" onClick={onConfirm}><Trash2 size={15} /> {confirmLabel}</button></div></section></div>; }
