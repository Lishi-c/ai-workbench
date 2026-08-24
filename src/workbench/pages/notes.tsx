import { ChevronLeft, ChevronRight, Download, Folder, FolderPlus, PenLine, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createId, dateKey, type Document, type NoteFolder, type Tone, type WorkbenchData } from "../../workbench-data";
import { useWorkbench } from "../context";
import { renderMarkdown, MdToolbar } from "./md";
import { fetchContentText, readTextFile } from "../storage";
import { ConfirmDialog, IconButton, PageIntro } from "../ui";

const ROOT_DROP = "__root__";

type ScopeItem = { kind: "folder"; folder: NoteFolder; order: number } | { kind: "doc"; doc: Document; order: number };

function scopeItems(data: WorkbenchData, folderId: string | null): ScopeItem[] {
  const folders: ScopeItem[] = data.noteFolders
    .filter((f) => (f.parentId ?? null) === folderId)
    .map((folder) => ({ kind: "folder", folder, order: folder.order }));
  const docs: ScopeItem[] = data.documents
    .filter((d) => (d.folderId ?? null) === folderId)
    .map((doc) => ({ kind: "doc", doc, order: doc.order ?? 0 }));
  return [...folders, ...docs].sort((a, b) => a.order - b.order);
}

function isDescendant(data: WorkbenchData, ancestorId: string, id: string): boolean {
  let cur: string | null = id;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    if (cur === ancestorId) return true;
    const f = data.noteFolders.find((x) => x.id === cur);
    cur = f ? f.parentId : null;
  }
  return false;
}

function folderPath(data: WorkbenchData, folderId: string | null): NoteFolder[] {
  const path: NoteFolder[] = [];
  let cur = folderId;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const f = data.noteFolders.find((x) => x.id === cur);
    if (!f) break;
    path.unshift(f);
    cur = f.parentId;
  }
  return path;
}

function folderOptions(data: WorkbenchData): { id: string; label: string; indent: string }[] {
  const out: { id: string; label: string; indent: string }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    data.noteFolders
      .filter((f) => (f.parentId ?? null) === parentId)
      .sort((a, b) => a.order - b.order)
      .forEach((f) => {
        out.push({ id: f.id, label: `${f.emoji} ${f.name}`, indent: "  ".repeat(depth) });
        walk(f.id, depth + 1);
      });
  };
  walk(null, 0);
  return out;
}

function folderStats(data: WorkbenchData, folderId: string): { subFolders: number; notes: number } {
  const set = new Set<string>();
  const stack = [folderId];
  while (stack.length) {
    const id = stack.pop()!;
    if (set.has(id)) continue;
    set.add(id);
    data.noteFolders.filter((f) => f.parentId === id).forEach((f) => stack.push(f.id));
  }
  const subFolders = data.noteFolders.filter((f) => f.parentId === folderId).length;
  const notes = data.documents.filter((d) => set.has(d.folderId ?? "")).length;
  return { subFolders, notes };
}

function collectNotes(data: WorkbenchData, folderId: string | null): Document[] {
  if (folderId == null) return data.documents;
  const set = new Set<string>();
  const stack = [folderId];
  while (stack.length) {
    const id = stack.pop()!;
    if (set.has(id)) continue;
    set.add(id);
    data.noteFolders.filter((f) => f.parentId === id).forEach((f) => stack.push(f.id));
  }
  return data.documents.filter((d) => set.has(d.folderId ?? ""));
}

function prependOrder(current: WorkbenchData, folderId: string | null): number {
  const orders = current.documents.filter((d) => (d.folderId ?? null) === folderId).map((d) => d.order ?? 0);
  return orders.length ? Math.min(...orders) - 1 : 0;
}

function reorderScope(current: WorkbenchData, folderId: string | null, kind: "folder" | "doc", id: string, insertIndex: number): WorkbenchData {
  const items = scopeItems(current, folderId);
  const from = items.findIndex((it) => it.kind === kind && (it.kind === "folder" ? it.folder.id === id : it.doc.id === id));
  if (from < 0) return current;
  const [moved] = items.splice(from, 1);
  let to = insertIndex;
  if (from < to) to -= 1;
  to = Math.max(0, Math.min(items.length, to));
  items.splice(to, 0, moved);
  const folderOrders = new Map<string, number>();
  const docOrders = new Map<string, number>();
  items.forEach((it, i) => {
    if (it.kind === "folder") folderOrders.set(it.folder.id, i);
    else docOrders.set(it.doc.id, i);
  });
  return {
    ...current,
    noteFolders: current.noteFolders.map((f) => (folderOrders.has(f.id) ? { ...f, order: folderOrders.get(f.id)! } : f)),
    documents: current.documents.map((d) => (docOrders.has(d.id) ? { ...d, order: docOrders.get(d.id)! } : d)),
  };
}

function moveDocInto(current: WorkbenchData, docId: string, folderId: string | null): WorkbenchData {
  const siblings = current.documents.filter((d) => (d.folderId ?? null) === folderId);
  const nextOrder = siblings.length ? Math.max(...siblings.map((d) => d.order ?? 0)) + 1 : 0;
  return { ...current, documents: current.documents.map((d) => (d.id === docId ? { ...d, folderId, order: nextOrder } : d)) };
}

function nestFolder(current: WorkbenchData, folderId: string, parentId: string | null): WorkbenchData {
  if (folderId === parentId || (parentId && isDescendant(current, folderId, parentId))) return current;
  const siblings = current.noteFolders.filter((f) => (f.parentId ?? null) === parentId);
  const nextOrder = siblings.length ? Math.max(...siblings.map((f) => f.order)) + 1 : 0;
  return { ...current, noteFolders: current.noteFolders.map((f) => (f.id === folderId ? { ...f, parentId, order: nextOrder } : f)) };
}

function deleteFolder(current: WorkbenchData, folderId: string, keepContent: boolean): WorkbenchData {
  if (keepContent) {
    // 仅删除该文件夹本身：直接的笔记移回未分类，直接的子文件夹升级为顶级（其内部笔记跟着走）
    const rootNoteMax = current.documents.filter((d) => (d.folderId ?? null) === null).reduce((m, d) => Math.max(m, d.order ?? 0), -1);
    let noteCursor = rootNoteMax;
    const documents = current.documents.map((d) => {
      if (d.folderId === folderId) { noteCursor += 1; return { ...d, folderId: null, order: noteCursor }; }
      return d;
    });
    const directSubs = current.noteFolders.filter((f) => f.parentId === folderId).sort((a, b) => a.order - b.order);
    const promotedIds = new Set(directSubs.map((f) => f.id));
    const rootFolderMax = current.noteFolders.filter((f) => (f.parentId ?? null) === null && f.id !== folderId).reduce((m, f) => Math.max(m, f.order), -1);
    let folderCursor = rootFolderMax;
    const noteFolders = current.noteFolders
      .filter((f) => f.id !== folderId)
      .map((f) => {
        if (promotedIds.has(f.id)) { folderCursor += 1; return { ...f, parentId: null, order: folderCursor }; }
        return f;
      });
    return { ...current, noteFolders, documents };
  }
  // 连同内容删除：删除整个子树及其下所有笔记
  const toRemove = new Set<string>();
  const stack = [folderId];
  while (stack.length) {
    const id = stack.pop()!;
    if (toRemove.has(id)) continue;
    toRemove.add(id);
    current.noteFolders.filter((f) => f.parentId === id).forEach((f) => stack.push(f.id));
  }
  const noteFolders = current.noteFolders.filter((f) => !toRemove.has(f.id));
  const documents = current.documents.filter((d) => !toRemove.has(d.folderId ?? ""));
  return { ...current, noteFolders, documents };
}

const folderTones: { id: Tone; label: string }[] = [
  { id: "purple", label: "紫" },
  { id: "pink", label: "粉" },
  { id: "sand", label: "沙" },
  { id: "blue", label: "蓝" },
];

const quickEmojis = ["📁", "📝", "📚", "💡", "🏷️", "⭐", "❤️", "🧠", "💰", "🍱"];

export function NotesPage({ openDocId, onDocHandled }: { openDocId?: string | null; onDocHandled?: () => void }) {
  const { data, updateData, notify } = useWorkbench();
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState(false);
  const [mode, setMode] = useState<"folders" | "all">("folders");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(null);
  const [folderModal, setFolderModal] = useState<{ folderId?: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [drag, setDrag] = useState<{ kind: "folder" | "doc"; id: string } | null>(null);
  const [dropInto, setDropInto] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // 拖拽实时值走 ref（供原生 window 监听器读取），state 仅用于渲染反馈
  const dataRef = useRef(data); dataRef.current = data;
  const folderIdRef = useRef(currentFolderId); folderIdRef.current = currentFolderId;
  const dragRef = useRef<{ kind: "folder" | "doc"; id: string } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);
  const suppressClickRef = useRef(false);
  const dropIntoRef = useRef<string | null>(null);
  const dropIndexRef = useRef<number | null>(null);
  const applyDrop = (into: string | null, index: number | null) => {
    if (dropIntoRef.current === into && dropIndexRef.current === index) return;
    dropIntoRef.current = into; dropIndexRef.current = index;
    setDropInto(into); setDropIndex(index);
  };

  useLayoutEffect(() => {
    if (openDocId && data.documents.some((d) => d.id === openDocId)) { setViewingDocId(openDocId); setNewNote(false); onDocHandled?.(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDocId]);

  const exportMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!exportOpen) return;
    const handle = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [exportOpen]);

  // 拖拽全走原生 window 监听器（不依赖 React 合成事件，WebView2 下可靠）
  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!dragStartRef.current) return;
      if (!didDragRef.current) {
        if (Math.hypot(event.clientX - dragStartRef.current.x, event.clientY - dragStartRef.current.y) < 6) return;
        didDragRef.current = true;
        setDrag(dragRef.current);
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
      }
      const info = dragRef.current;
      if (!info) return;
      const el = event.target as Element | null;
      const zone = el ? (el.closest(".drop-zone") as HTMLElement | null) : null;
      if (!zone) {
        const crumb = el ? (el.closest(".crumb-drop-target") as HTMLElement | null) : null;
        if (crumb) {
          const target = crumb.getAttribute("data-target-folder");
          if (target != null) { applyDrop(target, null); return; }
        }
        applyDrop(null, null);
        return;
      }
      const zoneType = zone.getAttribute("data-zone");
      const cardKind = zone.getAttribute("data-card-kind");
      const cardId = zone.getAttribute("data-card-id");
      const cardIndex = Number(zone.getAttribute("data-card-index") ?? "-1");
      if (!zoneType || !cardKind || !cardId || cardIndex < 0) { applyDrop(null, null); return; }
      if (cardKind === info.kind && cardId === info.id) { applyDrop(null, null); return; }
      if (zoneType === "into") {
        if (info.kind === "folder" && isDescendant(dataRef.current, info.id, cardId)) { applyDrop(null, cardIndex); return; }
        applyDrop(cardId, null);
      } else if (zoneType === "before") {
        applyDrop(null, cardIndex);
      } else if (zoneType === "after") {
        applyDrop(null, cardIndex + 1);
      } else {
        applyDrop(null, null);
      }
    };
    const onPointerUp = () => {
      const info = dragRef.current;
      const didDrag = didDragRef.current;
      const into = dropIntoRef.current;
      const index = dropIndexRef.current;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      dragStartRef.current = null;
      didDragRef.current = false;
      dragRef.current = null;
      applyDrop(null, null);
      setDrag(null);
      if (didDrag && info) {
        suppressClickRef.current = true;
        if (into) {
          const target = into === ROOT_DROP ? null : into;
          if (info.kind === "doc") updateData((cur) => moveDocInto(cur, info.id, target));
          else updateData((cur) => nestFolder(cur, info.id, target));
          notify(info.kind === "doc" ? (target == null ? "已移回未分类" : "已移入文件夹") : (target == null ? "已移回未分类" : "已移动为子文件夹"));
        } else if (index != null) {
          updateData((cur) => reorderScope(cur, folderIdRef.current, info.kind, info.id, index));
        }
      }
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeDoc = (id: string) => { updateData((current) => ({ ...current, documents: current.documents.filter((d) => d.id !== id) })); notify("已删除笔记"); };
  const removeFolder = (id: string, keepContent: boolean) => { updateData((current) => deleteFolder(current, id, keepContent)); notify(keepContent ? "已删除文件夹，内容移回未分类" : "已删除文件夹及其内容"); };

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
    const scope = mode === "folders" ? currentFolderId : null;
    const items = await Promise.all(collectNotes(data, scope).map(async (d) => ({ ...d, content: d.content || await fetchContentText("doc", d.id) })));
    exportAsFile(items, format, scope ? "文件夹笔记" : "全部笔记", "笔记");
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
      const targetFolder = mode === "folders" ? currentFolderId : null;
      updateData((current) => ({ ...current, documents: [...current.documents, { id: createId("doc"), title, content, format, createdAt: dateKey(), folderId: targetFolder, order: prependOrder(current, targetFolder) }] }));
      notify(targetFolder ? `已导入「${title}」到当前文件夹` : `已导入「${title}」`);
    } catch { notify("导入失败，请检查文件格式"); }
  };

  const startDrag = (event: React.PointerEvent, kind: "folder" | "doc", id: string) => {
    if ((event.target as Element).closest(".doc-card-actions, .icon-button")) return;
    suppressClickRef.current = false;
    dragRef.current = { kind, id };
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    didDragRef.current = false;
  };
  const openDoc = (id: string) => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    setViewingDocId(id);
  };
  const enterFolder = (id: string) => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    setCurrentFolderId(id);
  };

  const docActions = (
    <div className="page-action-stack">
      <div className="page-action-group">
        <label className="button button-soft" title="从 JSON / Markdown / TXT 文件导入笔记"><Upload size={16} /> 导入<input type="file" accept=".json,.md,.txt,application/json,text/markdown,text/plain" style={{ display: "none" }} onChange={(event) => { void importDocs(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
        <div className="export-menu" ref={exportMenuRef}><button className="button button-soft" onClick={() => setExportOpen((v) => !v)}><Download size={16} /> 导出</button>{exportOpen && <div className="export-menu-pop"><button type="button" onClick={() => { exportDocs("json"); setExportOpen(false); }}>JSON<small>无损备份</small></button><button type="button" onClick={() => { exportDocs("md"); setExportOpen(false); }}>Markdown<small>便于阅读</small></button><button type="button" onClick={() => { exportDocs("txt"); setExportOpen(false); }}>TXT<small>纯文本</small></button></div>}</div>
      </div>
      <div className="page-action-group">
        <button className="button button-soft" onClick={() => setFolderModal({})}><FolderPlus size={16} /> 新建文件夹</button>
        <button className="button button-primary" onClick={() => setNewNote(true)}><Plus size={17} /> 新建笔记</button>
      </div>
    </div>
  );

  if (viewingDocId) return <DocPage docId={viewingDocId} onBack={() => setViewingDocId(null)} />;
  if (newNote) return <DocPage isNew onBack={() => setNewNote(false)} />;

  const path = folderPath(data, currentFolderId);
  const items = scopeItems(data, currentFolderId);
  const allNotes = [...data.documents].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || (a.order ?? 0) - (b.order ?? 0));

  const dropHint = (index: number) => {
    if (dropInto || dropIndex == null) return "";
    if (dropIndex === index) return " is-drop-before";
    if (dropIndex === items.length && index === items.length - 1) return " is-drop-after";
    return "";
  };

  return (
    <div className="page-stack page-enter">
      <PageIntro eyebrow="NOTES" title="便签笔记" copy="拖拽卡片右侧手柄即可排序或归类：拖到文件夹上移入，拖到卡片边缘排序。" actions={docActions} />
      <div className="notes-toolbar">
        {mode === "folders" && (
          <nav className="note-breadcrumb" aria-label="文件夹路径">
            <button type="button" className={`${currentFolderId == null ? "is-current" : ""}${currentFolderId != null ? " crumb-drop-target" : ""}${dropInto === ROOT_DROP ? " is-drop-target" : ""}`} data-target-folder={ROOT_DROP} title={currentFolderId != null ? "拖拽到这里，移回未分类" : "全部笔记"} onClick={() => { if (suppressClickRef.current) { suppressClickRef.current = false; return; } setCurrentFolderId(null); }}>全部</button>
            {path.map((f) => {
              const isCurrent = currentFolderId === f.id;
              return (
                <Fragment key={f.id}>
                  <ChevronRight size={14} />
                  <button type="button" className={`${isCurrent ? "is-current" : ""}${!isCurrent ? " crumb-drop-target" : ""}${dropInto === f.id ? " is-drop-target" : ""}`} data-target-folder={f.id} title={!isCurrent ? `拖拽到这里，移入「${f.name}」` : undefined} onClick={() => { if (suppressClickRef.current) { suppressClickRef.current = false; return; } setCurrentFolderId(f.id); }}>{f.emoji} {f.name}</button>
                </Fragment>
              );
            })}
          </nav>
        )}
        <div className="segmented" role="tablist">
          <button type="button" className={mode === "folders" ? "active" : ""} onClick={() => setMode("folders")}>笔记</button>
          <button type="button" className={mode === "all" ? "active" : ""} onClick={() => setMode("all")}>展开</button>
        </div>
      </div>
      {mode === "folders" ? (
        <div className="doc-list is-draggable">
          {items.map((item, index) => {
            const isDraggingThis = drag?.kind === item.kind && drag.id === (item.kind === "folder" ? item.folder.id : item.doc.id);
            if (item.kind === "folder") {
              return (
                <article
                  className={`doc-card folder-card panel${isDraggingThis ? " is-dragging" : ""}${dropInto === item.folder.id ? " is-drop-into" : ""}${dropHint(index)}`}
                  key={item.folder.id}
                  onPointerDown={(event) => startDrag(event, "folder", item.folder.id)}
                >
                  <button type="button" className="doc-card-main folder-card-main" onClick={() => enterFolder(item.folder.id)}>
                    <h3>{item.folder.name || "未命名文件夹"}</h3>
                    <div className="folder-meta">
                      <span>{folderStats(data, item.folder.id).subFolders} 个子文件夹 · {folderStats(data, item.folder.id).notes} 篇笔记</span>
                      <span className={`folder-emoji tone-${item.folder.color}`}>{item.folder.emoji}</span>
                    </div>
                  </button>
                  <div className="doc-card-foot">
                    <small><Folder size={12} /> 文件夹</small>
                    <div className="doc-card-actions">
                      <IconButton label="重命名文件夹" onClick={() => setFolderModal({ folderId: item.folder.id })}><Pencil size={15} /></IconButton>
                      <IconButton label="删除文件夹" onClick={() => setConfirmDeleteFolderId(item.folder.id)}><Trash2 size={15} /></IconButton>
                    </div>
                  </div>
                  {drag && !isDraggingThis && (
                    <>
                      <div className="drop-zone drop-zone-before" data-zone="before" data-card-kind="folder" data-card-id={item.folder.id} data-card-index={index} />
                      <div className="drop-zone drop-zone-into" data-zone="into" data-card-kind="folder" data-card-id={item.folder.id} data-card-index={index} />
                      <div className="drop-zone drop-zone-after" data-zone="after" data-card-kind="folder" data-card-id={item.folder.id} data-card-index={index} />
                    </>
                  )}
                </article>
              );
            }
            return (
              <article
                className={`doc-card panel${isDraggingThis ? " is-dragging" : ""}${dropHint(index)}`}
                key={item.doc.id}
                onPointerDown={(event) => startDrag(event, "doc", item.doc.id)}
              >
                <button type="button" className="doc-card-main" onClick={() => openDoc(item.doc.id)}><h3>{item.doc.title || "无标题"}</h3><p>{item.doc.preview || item.doc.content}</p></button>
                <div className="doc-card-foot">
                  <small>{item.doc.format.toUpperCase()} · {item.doc.createdAt}</small>
                  <div className="doc-card-actions">
                    <IconButton label="删除笔记" onClick={() => setConfirmDeleteId(item.doc.id)}><Trash2 size={15} /></IconButton>
                  </div>
                </div>
                {drag && !isDraggingThis && (
                  <>
                    <div className="drop-zone drop-zone-before" data-zone="before" data-card-kind="doc" data-card-id={item.doc.id} data-card-index={index} />
                    <div className="drop-zone drop-zone-after" data-zone="after" data-card-kind="doc" data-card-id={item.doc.id} data-card-index={index} />
                  </>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="doc-list">
          {allNotes.map((doc) => (
            <article className="doc-card panel" key={doc.id}>
              <button type="button" className="doc-card-main" onClick={() => setViewingDocId(doc.id)}><h3>{doc.title || "无标题"}</h3><p>{doc.preview || doc.content}</p></button>
              <div className="doc-card-foot">
                <small>{doc.folderId ? `${data.noteFolders.find((f) => f.id === doc.folderId)?.emoji ?? "📁"} ${data.noteFolders.find((f) => f.id === doc.folderId)?.name ?? "文件夹"} · ` : ""}{doc.format.toUpperCase()} · {doc.createdAt}</small>
                <div className="doc-card-actions"><IconButton label="删除笔记" onClick={() => setConfirmDeleteId(doc.id)}><Trash2 size={15} /></IconButton></div>
              </div>
            </article>
          ))}
        </div>
      )}
      {mode === "folders" && items.length === 0 && <div className="empty-state panel"><Folder size={32} /><strong>这里是空的</strong><span>点右上角「新建文件夹」或「新建笔记」开始整理</span></div>}
      {mode === "all" && allNotes.length === 0 && <div className="empty-state panel"><PenLine size={32} /><strong>还没有笔记</strong><span>点右上角「导入」或「新建笔记」添加第一篇</span></div>}
      {confirmDeleteId && <ConfirmDialog title="删除这篇笔记？" copy="删除后无法恢复，且无法撤销。" onCancel={() => setConfirmDeleteId(null)} onConfirm={() => { removeDoc(confirmDeleteId); setConfirmDeleteId(null); }} />}
      {confirmDeleteFolderId && <FolderDeleteDialog folderId={confirmDeleteFolderId} onCancel={() => setConfirmDeleteFolderId(null)} onConfirm={(keepContent) => { removeFolder(confirmDeleteFolderId, keepContent); setConfirmDeleteFolderId(null); }} />}
      {folderModal && <FolderFormModal folderId={folderModal.folderId} parentId={currentFolderId} onClose={() => setFolderModal(null)} />}
    </div>
  );
}

function FolderDeleteDialog({ folderId, onCancel, onConfirm }: { folderId: string; onCancel: () => void; onConfirm: (keepContent: boolean) => void }) {
  const { data } = useWorkbench();
  const stats = folderStats(data, folderId);
  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);
  return (
    <div className="modal-backdrop confirm-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="editor-modal confirm-modal" role="alertdialog" aria-modal="true">
        <IconButton label="关闭" className="modal-close" onClick={onCancel}><X size={18} /></IconButton>
        <header className="modal-head"><span className="section-eyebrow">DELETE FOLDER</span><h2>删除这个文件夹？</h2><p>里面包含 {stats.subFolders} 个子文件夹、{stats.notes} 篇笔记。请选择如何处理这些内容。</p></header>
        <div className="folder-delete-actions">
          <button type="button" className="button button-soft" onClick={() => onConfirm(true)}>仅删文件夹<small>内容移回未分类，子文件夹保留为顶级</small></button>
          <button type="button" className="button danger-button" onClick={() => onConfirm(false)}><Trash2 size={15} /> 连同内容删除</button>
        </div>
      </section>
    </div>
  );
}

function FolderFormModal({ folderId, parentId, onClose }: { folderId?: string; parentId: string | null; onClose: () => void }) {
  const { data, updateData, notify } = useWorkbench();
  const existing = folderId ? data.noteFolders.find((f) => f.id === folderId) : undefined;
  const [name, setName] = useState(existing?.name ?? "");
  const [color, setColor] = useState<Tone>(existing?.color ?? "purple");
  const [emoji, setEmoji] = useState(existing?.emoji ?? "📁");
  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);
  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) { notify("请输入文件夹名称"); return; }
    if (existing) {
      updateData((current) => ({ ...current, noteFolders: current.noteFolders.map((f) => (f.id === folderId ? { ...f, name: trimmed, color, emoji } : f)) }));
      notify("文件夹已更新");
    } else {
      const siblings = data.noteFolders.filter((f) => (f.parentId ?? null) === parentId);
      const order = siblings.length ? Math.min(...siblings.map((f) => f.order)) - 1 : 0;
      updateData((current) => ({ ...current, noteFolders: [...current.noteFolders, { id: createId("folder"), name: trimmed, color, emoji, parentId, order }] }));
      notify("已新建文件夹");
    }
    onClose();
  };
  return (
    <div className="modal-backdrop confirm-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="editor-modal confirm-modal" role="dialog" aria-modal="true">
        <IconButton label="关闭" className="modal-close" onClick={onClose}><X size={18} /></IconButton>
        <header className="modal-head"><span className="section-eyebrow">FOLDER</span><h2>{existing ? "编辑文件夹" : "新建文件夹"}</h2><p>{existing ? "修改名称、颜色与图标。" : parentId ? "会在当前文件夹里新建一个子文件夹。" : "会在根目录新建一个文件夹。"}</p></header>
        <form onSubmit={(event) => { event.preventDefault(); save(); }}>
          <div className="form-grid">
            <label className="form-field full-field"><span>名称</span><input value={name} onChange={(event) => setName(event.target.value)} required placeholder="例如：读书笔记" autoFocus /></label>
            <div className="form-field full-field"><span>图标</span><div className="folder-emoji-picker"><div className="folder-emoji-quick">{quickEmojis.map((e) => <button type="button" className={emoji === e ? "is-active" : ""} onClick={() => setEmoji(e)} key={e}>{e}</button>)}</div><input value={emoji} onChange={(event) => setEmoji(event.target.value)} maxLength={4} placeholder="或输入 emoji" /></div></div>
            <div className="form-field full-field"><span>颜色</span><div className="folder-tone-row">{folderTones.map((t) => <button type="button" key={t.id} className={`folder-tone-dot tone-${t.id}${color === t.id ? " is-active" : ""}`} title={t.label} onClick={() => setColor(t.id)} />)}</div></div>
          </div>
          <div className="modal-actions"><button type="button" className="button button-soft" onClick={onClose}>取消</button><button type="submit" className="button button-primary">保存</button></div>
        </form>
      </section>
    </div>
  );
}

export function DocPage({ docId, isNew, onBack }: { docId?: string; isNew?: boolean; onBack: () => void }) {
  const { data, updateData, notify } = useWorkbench();
  const doc = docId ? data.documents.find((d) => d.id === docId) : undefined;
  const [editing, setEditing] = useState(isNew);
  const [title, setTitle] = useState(doc?.title ?? "");
  const [content, setContent] = useState(doc?.content ?? "");
  const [folderId, setFolderId] = useState<string | null>(doc?.folderId ?? null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    let active = true;
    setTitle(doc?.title ?? "");
    setEditing(isNew ?? false);
    setFolderId(doc?.folderId ?? null);
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
      updateData((current) => ({ ...current, documents: current.documents.map((d) => (d.id === docId ? { ...d, title: title.trim(), content, folderId } : d)) }));
      notify("笔记已保存");
      setEditing(false);
    } else {
      updateData((current) => ({ ...current, documents: [...current.documents, { id: createId("doc"), title: title.trim(), content, format: "md", createdAt: dateKey(), folderId, order: prependOrder(current, folderId) }] }));
      notify("笔记已保存");
      onBack();
    }
  };

  const removeDoc = () => { updateData((current) => ({ ...current, documents: current.documents.filter((d) => d.id !== docId) })); notify("已删除笔记"); onBack(); };

  return <div className="page-stack page-enter doc-page"><PageIntro eyebrow={(doc?.format ?? "md").toUpperCase()} title={title || "无标题"} copy={doc ? `${doc.format} 文件 · ${doc.createdAt}` : "新建 Markdown 笔记"} actions={<div className="page-action-group">{!editing && <button className="button button-soft" onClick={() => setEditing(true)}><PenLine size={16} /> 编辑</button>}<button className="button button-soft" onClick={onBack}><ChevronLeft size={16} /> 返回</button></div>} />{editing ? <form onSubmit={(event) => { event.preventDefault(); save(); }}><div className="form-grid"><label className="form-field full-field"><span>标题</span><input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="笔记标题" /></label><label className="form-field full-field"><span>所属文件夹</span><select value={folderId ?? ""} onChange={(event) => setFolderId(event.target.value || null)}><option value="">未分类</option>{folderOptions(data).map((o) => <option value={o.id} key={o.id}>{o.indent}{o.label}</option>)}</select></label><div className="form-field full-field"><span>正文</span><MdToolbar elRef={contentRef} set={setContent} /><textarea ref={contentRef} value={content} onChange={(event) => setContent(event.target.value)} rows={18} required /></div></div><div className="modal-actions"><button type="button" className="button button-soft" onClick={() => { if (docId) setEditing(false); else onBack(); }}>取消</button><button type="submit" className="button button-primary">保存</button></div></form> : <section className="panel doc-page-body">{renderContent()}</section>}{!editing && docId && <div className="doc-page-footer"><button type="button" className="button button-soft" onClick={() => setConfirmingDelete(true)}><Trash2 size={16} /> 删除笔记</button></div>}{confirmingDelete && <ConfirmDialog title="删除这篇笔记？" copy="删除后无法恢复，且无法撤销。" onCancel={() => setConfirmingDelete(false)} onConfirm={removeDoc} />}</div>;
}
