import { ChevronLeft, Download, GripVertical, PenLine, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createId, dateKey, type Document } from "../../workbench-data";
import { useWorkbench } from "../context";
import { renderMarkdown, MdToolbar } from "./md";
import { fetchContentText, readTextFile } from "../storage";
import { ConfirmDialog, IconButton, PageIntro, SectionTitle } from "../ui";

export function NotesPage({ openDocId, onDocHandled }: { openDocId?: string | null; onDocHandled?: () => void }) {
  const { data, updateData, notify } = useWorkbench();
  const removeDoc = (id: string) => { updateData((current) => ({ ...current, documents: current.documents.filter((d) => d.id !== id) })); notify("已删除笔记"); };
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState(false);
  useLayoutEffect(() => {
    if (openDocId && data.documents.some((d) => d.id === openDocId)) { setViewingDocId(openDocId); setNewNote(false); onDocHandled?.(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDocId]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const moveDoc = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    updateData((current) => {
      const docs = [...current.documents];
      const from = docs.findIndex((d) => d.id === fromId);
      const to = docs.findIndex((d) => d.id === toId);
      if (from < 0 || to < 0 || from === to) return current;
      const [moved] = docs.splice(from, 1);
      docs.splice(to, 0, moved);
      return { ...current, documents: docs };
    });
  };
  const exportMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!exportOpen) return;
    const handle = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [exportOpen]);
  const exportAsFile = (items: Array<{ title: string; content: string }>, format: "json" | "md" | "txt", name: string, label: string) => {
    const md = items.map((n) => `## ${n.title || "无标题"}\n\n${n.content}`).join("\n\n---\n\n");
    const txt = items.map((n) => `${n.title || "无标题"}\n\n${n.content}`).join("\n\n---\n\n");
    const content = format === "json" ? JSON.stringify(items, null, 2) : format === "md" ? md : txt;
    const ext = format === "json" ? "json" : format === "md" ? "md" : "txt";
    const mime = format === "json" ? "application/json" : format === "md" ? "text/markdown" : "text/plain";
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name}-${dateKey()}.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
    notify(`已导出 ${items.length} 条${label}`);
  };
  const exportDocs = async (format: "json" | "md" | "txt") => {
    const items = await Promise.all(data.documents.map(async (d) => ({ ...d, content: d.content || await fetchContentText("doc", d.id) })));
    exportAsFile(items, format, "笔记", "笔记");
  };
  const importDocs = async (file?: File) => {
    if (!file) return;
    try {
      const text = await readTextFile(file);
      const name = file.name.toLowerCase();
      const title = file.name.replace(/\.(txt|md|json)$/i, "");
      const format = name.endsWith(".json") ? "json" : name.endsWith(".md") ? "md" : "txt";
      const content = format === "json" ? (() => { try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text.trim(); } })() : text.trim();
      if (!content) { notify("文件内容为空"); return; }
      const docData: Document = { id: createId("doc"), title, content, format, createdAt: dateKey() };
      updateData((current) => ({ ...current, documents: [docData, ...current.documents] }));
      notify(`已导入「${title}」`);
    } catch { notify("导入失败，请检查文件格式"); }
  };
  const createDoc = () => setNewNote(true);
  const docActions = <div className="page-action-group"><label className="button button-soft" title="从 JSON / Markdown / TXT 文件导入笔记"><Upload size={16} /> 导入<input type="file" accept=".json,.md,.txt,application/json,text/markdown,text/plain" style={{ display: "none" }} onChange={(event) => { void importDocs(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label><div className="export-menu" ref={exportMenuRef}><button className="button button-soft" onClick={() => setExportOpen((v) => !v)}><Download size={16} /> 导出</button>{exportOpen && <div className="export-menu-pop"><button type="button" onClick={() => { exportDocs("json"); setExportOpen(false); }}>JSON<small>无损备份</small></button><button type="button" onClick={() => { exportDocs("md"); setExportOpen(false); }}>Markdown<small>便于阅读</small></button><button type="button" onClick={() => { exportDocs("txt"); setExportOpen(false); }}>TXT<small>纯文本</small></button></div>}</div><button className="button button-primary" onClick={createDoc}><Plus size={17} /> 新建笔记</button></div>;
  if (viewingDocId) return <DocPage docId={viewingDocId} onBack={() => setViewingDocId(null)} />;
  if (newNote) return <DocPage isNew onBack={() => setNewNote(false)} />;
  return <div className="page-stack page-enter"><PageIntro eyebrow="NOTES" title="便签笔记" copy="导入 TXT、Markdown 或 JSON 文件，拖拽卡片即可排序。" actions={docActions} /><div className="doc-list">{data.documents.map((doc) => <article className={`doc-card panel${dragId === doc.id ? " is-dragging" : ""}${overId === doc.id ? " is-drop-target" : ""}`} key={doc.id} onDragOver={(event) => { event.preventDefault(); if (dragId && dragId !== doc.id) setOverId(doc.id); }} onDragLeave={(event) => { if (event.currentTarget.contains(event.relatedTarget as Node)) return; setOverId((v) => (v === doc.id ? null : v)); }} onDrop={(event) => { event.preventDefault(); if (dragId && dragId !== doc.id) moveDoc(dragId, doc.id); setDragId(null); setOverId(null); }}><button type="button" className="doc-card-main" onClick={() => setViewingDocId(doc.id)}><h3>{doc.title || "无标题"}</h3><p>{doc.preview || doc.content}</p></button><div className="doc-card-foot"><small>{doc.format.toUpperCase()} · {doc.createdAt}</small><div className="doc-card-actions"><span className="doc-drag-handle" draggable title="拖拽排序" onDragStart={(event) => { setDragId(doc.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", doc.id); }} onDragEnd={() => { setDragId(null); setOverId(null); }}><GripVertical size={15} /></span><IconButton label="删除笔记" onClick={() => setConfirmDeleteId(doc.id)}><Trash2 size={15} /></IconButton></div></div></article>)}</div>{!data.documents.length && <div className="empty-state panel"><PenLine size={32} /><strong>还没有笔记</strong><span>点右上角「导入」或「新建笔记」添加第一篇</span></div>}{confirmDeleteId && <ConfirmDialog title="删除这篇笔记？" copy="删除后无法恢复，且无法撤销。" onCancel={() => setConfirmDeleteId(null)} onConfirm={() => { removeDoc(confirmDeleteId); setConfirmDeleteId(null); }} />}</div>;
}

export function DocPage({ docId, isNew, onBack }: { docId?: string; isNew?: boolean; onBack: () => void }) {
  const { data, updateData, notify } = useWorkbench();
  const doc = docId ? data.documents.find((d) => d.id === docId) : undefined;
  const [editing, setEditing] = useState(isNew);
  const [title, setTitle] = useState(doc?.title ?? "");
  const [content, setContent] = useState(doc?.content ?? "");
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    let active = true;
    setTitle(doc?.title ?? "");
    setEditing(isNew ?? false);
    if (!doc) { setContent(""); return; }
    if (doc.content) { setContent(doc.content); return; }
    setContent("");
    void fetchContentText("doc", doc.id).then((c) => { if (active) setContent(c); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, isNew]);

  if (!doc && !isNew) return <div className="page-stack page-enter"><PageIntro eyebrow="NOTE" title="笔记不存在" copy="这条笔记可能已被删除。" actions={<button className="button button-soft" onClick={onBack}><ChevronLeft size={16} /> 返回</button>} /></div>;

  const renderContent = () => {
    if (!doc) return null;
    if (doc.format === "md") return <div className="doc-view-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />;
    if (doc.format === "json") {
      let pretty = content;
      try { pretty = JSON.stringify(JSON.parse(content), null, 2); } catch { /* 保留原文 */ }
      return <pre className="doc-view-text">{pretty}</pre>;
    }
    return <pre className="doc-view-text">{content}</pre>;
  };

  const save = () => {
    if (docId) {
      updateData((current) => ({ ...current, documents: current.documents.map((d) => (d.id === docId ? { ...d, title: title.trim(), content } : d)) }));
      notify("笔记已保存");
      setEditing(false);
    } else {
      updateData((current) => ({ ...current, documents: [{ id: createId("doc"), title: title.trim(), content, format: "md", createdAt: dateKey() }, ...current.documents] }));
      notify("笔记已保存");
      onBack();
    }
  };

  const removeDoc = () => { updateData((current) => ({ ...current, documents: current.documents.filter((d) => d.id !== docId) })); notify("已删除笔记"); onBack(); };

  return <div className="page-stack page-enter doc-page"><PageIntro eyebrow={(doc?.format ?? "md").toUpperCase()} title={title || "无标题"} copy={doc ? `${doc.format} 文件 · ${doc.createdAt}` : "新建 Markdown 笔记"} actions={<div className="page-action-group">{!editing && <button className="button button-soft" onClick={() => setEditing(true)}><PenLine size={16} /> 编辑</button>}<button className="button button-soft" onClick={onBack}><ChevronLeft size={16} /> 返回</button></div>} />{editing ? <form onSubmit={(event) => { event.preventDefault(); save(); }}><div className="form-grid"><label className="form-field full-field"><span>标题</span><input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="笔记标题" /></label><div className="form-field full-field"><span>正文</span><MdToolbar elRef={contentRef} set={setContent} /><textarea ref={contentRef} value={content} onChange={(event) => setContent(event.target.value)} rows={18} required /></div></div><div className="modal-actions"><button type="button" className="button button-soft" onClick={() => { if (docId) setEditing(false); else onBack(); }}>取消</button><button type="submit" className="button button-primary">保存</button></div></form> : <section className="panel doc-page-body">{renderContent()}</section>}{!editing && docId && <div className="doc-page-footer"><button type="button" className="button button-soft" onClick={() => setConfirmingDelete(true)}><Trash2 size={16} /> 删除笔记</button></div>}{confirmingDelete && <ConfirmDialog title="删除这篇笔记？" copy="删除后无法恢复，且无法撤销。" onCancel={() => setConfirmingDelete(false)} onConfirm={removeDoc} />}</div>;
}
