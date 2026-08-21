import { ArrowRight, BookOpen, Bookmark, ChevronLeft, ChevronRight, ListFilter, PenLine, Plus, Quote, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createId, dateKey, type Book } from "../../workbench-data";
import { safePercent, useWorkbench } from "../context";
import { renderMarkdown } from "./md";
import { fetchContentText, readTextFile } from "../storage";
import { IconButton, PageIntro, ProgressRing, SectionTitle } from "../ui";

export function LibraryPage({ openBookId, onBookHandled }: { openBookId?: string | null; onBookHandled?: () => void }) {
  const { data, updateData, notify } = useWorkbench();
  const [filter, setFilter] = useState<"全部" | "在读" | "已读完" | "已收藏">("全部");
  const [viewingBookId, setViewingBookId] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (openBookId && data.books.some((b) => b.id === openBookId)) { setViewingBookId(openBookId); onBookHandled?.(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openBookId]);

  const importBook = async (file?: File) => {
    if (!file) return;
    try {
      const raw = await readTextFile(file);
      let title = file.name.replace(/\.(md|txt)$/i, "");
      let author = "";
      let content = raw.trim();
      if (file.name.endsWith(".md")) {
        const firstLine = raw.split("\n").find((line) => line.trim());
        if (firstLine?.startsWith("# ")) title = firstLine.slice(2).trim();
      }
      const authorMatch = raw.match(/(?:作者|Author)[:：]\s*(.+)/);
      if (authorMatch) author = authorMatch[1].trim();
      const format = file.name.toLowerCase().endsWith(".md") ? "md" : "txt";
      const book: Book = { id: createId("book"), title, author, content, format, progress: 0, status: "reading", favorite: false, addedAt: dateKey() };
      updateData((current) => ({ ...current, books: [book, ...current.books] }));
      notify(`已导入「${title}」`);
    } catch { notify("导入失败，请检查文件格式"); }
  };

  const books = data.books;
  const list = books.filter((book) => {
    if (filter === "在读") return book.status === "reading";
    if (filter === "已读完") return book.status === "finished";
    if (filter === "已收藏") return book.favorite;
    return true;
  });

  const toggleFavorite = (id: string) => { updateData((current) => ({ ...current, books: current.books.map((b) => (b.id === id ? { ...b, favorite: !b.favorite } : b)) })); };
  const removeBook = (id: string) => { updateData((current) => ({ ...current, books: current.books.filter((b) => b.id !== id) })); notify("已删除图书"); };

  const readingCount = books.filter((b) => b.status === "reading").length;
  const finishedCount = books.filter((b) => b.status === "finished").length;
  const finishRate = books.length ? safePercent(finishedCount, books.length) : 0;
  const filters = ["全部", "在读", "已读完", "已收藏"] as const;
  const thumbTones = ["purple", "pink", "sand", "blue"];

  const importBtn = <label className="button button-primary" title="支持 TXT / Markdown 格式"><Plus size={17} /> 导入图书<input type="file" accept=".txt,.md,text/plain,text/markdown" style={{ display: "none" }} onChange={(event) => { void importBook(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>;

  if (viewingBookId) return <BookPage bookId={viewingBookId} onBack={() => setViewingBookId(null)} />;
  return <div className="page-stack page-enter"><PageIntro eyebrow="MY LIBRARY" title="我的图书库" copy="导入 TXT 或 Markdown 图书，随时阅读并记录进度。" actions={importBtn} /><div className="topic-tabs">{filters.map((item) => <button type="button" key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><section className="library-layout"><div className="library-main"><SectionTitle eyebrow="COLLECTION" title={filter === "全部" ? "全部图书" : filter} action={<span className="filter-button"><ListFilter size={14} /> {list.length} 本</span>} /><div className="library-list">{list.map((book, index) => <article className={`library-row panel ${book.status === "finished" ? "is-read" : ""}`} key={book.id}><div className={`library-thumbnail tone-${thumbTones[index % 4]}`}><span>{book.title.slice(0, 1)}</span><i /><i /></div><button type="button" className="library-copy" onClick={() => setViewingBookId(book.id)}><span>{book.author || "未知作者"}{book.status === "finished" ? " · 已读完" : ` · ${book.progress}%`}</span><h3>{book.title}</h3><p>{(book.preview || book.content).slice(0, 80)}{(book.preview || book.content).length > 80 ? "…" : ""}</p><small>导入于 {book.addedAt}</small></button><div className="library-actions"><IconButton label="收藏" className={book.favorite ? "is-active" : ""} onClick={() => toggleFavorite(book.id)}><Bookmark size={17} fill={book.favorite ? "currentColor" : "none"} /></IconButton><IconButton label="删除" onClick={() => removeBook(book.id)}><Trash2 size={17} /></IconButton></div></article>)}</div>{!list.length && <div className="empty-state panel"><BookOpen size={30} /><strong>{filter === "全部" ? "还没有图书" : `没有${filter}的图书`}</strong><span>{filter === "全部" ? "点击右上角「导入图书」添加第一本书" : "换个分类看看"}</span></div>}</div><aside className="library-side"><article className="panel library-summary"><span className="library-summary-icon"><BookOpen size={21} /></span><h3>我的书架</h3><p>共 {books.length} 本，在读 {readingCount} 本，已读完 {finishedCount} 本。</p><button className="button button-soft" type="button" onClick={() => setFilter("已收藏")}>查看收藏 <ArrowRight size={14} /></button></article><article className="panel reading-card"><SectionTitle eyebrow="READING" title="阅读统计" /><ProgressRing value={finishRate} label="读完率" size="medium" /><div><strong>{finishedCount} 本</strong><span>已读完 · 共 {books.length} 本</span></div></article></aside></section></div>;
}

export function BookPage({ bookId, onBack }: { bookId: string; onBack: () => void }) {
  const { data, updateData, notify } = useWorkbench();
  const book = data.books.find((b) => b.id === bookId);
  const [page, setPage] = useState(0);
  const [content, setContent] = useState("");
  const [noteText, setNoteText] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);
  const readerRef = useRef<HTMLElement>(null);

  useEffect(() => { setPage(0); }, [bookId]);
  useEffect(() => {
    let active = true;
    if (!book) { setContent(""); return; }
    if (book.content) { setContent(book.content); return; }
    setContent("");
    void fetchContentText("book", book.id).then((c) => { if (active) setContent(c); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);
  useEffect(() => { window.scrollTo(0, 0); }, [page]);

  if (!book) return <div className="page-stack page-enter"><PageIntro eyebrow="LIBRARY" title="图书不存在" copy="这本书可能已被删除。" actions={<button className="button button-soft" onClick={onBack}><ChevronLeft size={16} /> 返回</button>} /></div>;

  const CHUNK_SIZE = 1000;
  const chunks = useMemo(() => {
    const text = content;
    if (!text) return [""];
    const result: string[] = [];
    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + CHUNK_SIZE, text.length);
      if (end < text.length) {
        const nl = text.lastIndexOf("\n", end);
        if (nl > start + CHUNK_SIZE / 2) end = nl;
      }
      result.push(text.slice(start, end));
      start = end;
    }
    return result;
  }, [content]);
  const totalPages = chunks.length;
  const current = chunks[page] ?? "";

  const renderChunk = (chunk: string) => {
    if (book.format === "md") return <div className="doc-view-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(chunk) }} />;
    return <pre className="doc-view-text">{chunk}</pre>;
  };

  const commit = (opts?: { finished?: boolean }) => {
    const progress = opts?.finished ? 100 : totalPages > 1 ? Math.round(((page + 1) / totalPages) * 100) : (book.progress || 0);
    updateData((current) => ({
      ...current,
      books: current.books.map((b) => {
        if (b.id !== bookId) return b;
        const status = opts?.finished || progress >= 100 ? "finished" : "reading";
        return { ...b, progress, status };
      }),
    }));
  };

  // 离开阅读页时自动保存当前进度
  useEffect(() => () => { commit(); }, [page, bookId]);

  const removeBook = () => { updateData((current) => ({ ...current, books: current.books.filter((b) => b.id !== bookId) })); notify("已删除图书"); onBack(); };
  const notes = book.notes ?? [];
  const addNote = () => {
    const text = noteText.trim();
    if (!text) return;
    updateData((current) => ({ ...current, books: current.books.map((b) => b.id === bookId ? { ...b, notes: [...(b.notes ?? []), { id: createId("note"), text, createdAt: dateKey() }] } : b) }));
    setNoteText("");
    notify("笔记已添加");
  };
  const removeNote = (noteId: string) => { updateData((current) => ({ ...current, books: current.books.map((b) => b.id === bookId ? { ...b, notes: (b.notes ?? []).filter((n) => n.id !== noteId) } : b) })); notify("笔记已删除"); };
  const highlights = book.highlights ?? [];
  const removeHighlight = (highlightId: string) => { updateData((current) => ({ ...current, books: current.books.map((b) => b.id === bookId ? { ...b, highlights: (b.highlights ?? []).filter((h) => h.id !== highlightId) } : b) })); notify("划线已删除"); };
  const handleMouseUp = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (!text || !sel || !readerRef.current?.contains(sel.anchorNode)) { setSelection(null); return; }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setSelection({ text, x: rect.left, y: Math.max(8, rect.top - 40) });
  };
  const addHighlight = () => {
    if (!selection) return;
    updateData((current) => ({ ...current, books: current.books.map((b) => b.id === bookId ? { ...b, highlights: [...(b.highlights ?? []), { id: createId("hl"), text: selection.text, page: page + 1, createdAt: dateKey() }] } : b) }));
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    setNotesOpen(true);
    notify("划线已保存");
  };

  return <div className="page-stack page-enter doc-page"><PageIntro eyebrow={book.status === "finished" ? "FINISHED" : "READING"} title={book.title} copy={`${book.author || "未知作者"} · 第 ${page + 1} / ${totalPages} 页`} actions={<div className="page-action-group"><button className="button button-soft" onClick={() => setNotesOpen((v) => !v)}><PenLine size={16} /> 笔记·划线{notes.length + highlights.length > 0 ? ` (${notes.length + highlights.length})` : ""}</button><button className="button button-soft" onClick={onBack}><ChevronLeft size={16} /> 返回</button><button className="button button-soft" onClick={() => { commit({ finished: true }); notify("已标记为读完"); }}>标记读完</button><button className="button button-soft" onClick={removeBook}><Trash2 size={16} /> 删除</button></div>} /><section className="panel book-reader" ref={readerRef} onMouseUp={handleMouseUp}>{renderChunk(current)}</section>{selection && <button type="button" className="highlight-pop" style={{ left: selection.x, top: selection.y }} onClick={addHighlight}><PenLine size={14} /> 划线</button>}{notesOpen && <section className="panel book-notes-card"><SectionTitle eyebrow="ANNOTATIONS" title="读书笔记与划线" action={<span className="status-pill">{highlights.length} 条划线 · {notes.length} 条笔记</span>} />{highlights.length > 0 && <div className="book-highlight-list">{highlights.map((h) => <div className="book-highlight" key={h.id}><Quote size={14} /><div><p>{h.text}</p><small>第 {h.page} 页 · {h.createdAt}</small></div><IconButton label="删除划线" onClick={() => removeHighlight(h.id)}><Trash2 size={14} /></IconButton></div>)}</div>}<form className="book-note-input" onSubmit={(event) => { event.preventDefault(); addNote(); }}><input value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="记一句读书心得…" /><button type="submit" className="button button-primary">添加</button></form><div className="book-note-list">{notes.map((n) => <div className="book-note" key={n.id}><p>{n.text}</p><small>{n.createdAt}</small><IconButton label="删除笔记" onClick={() => removeNote(n.id)}><Trash2 size={14} /></IconButton></div>)}{!notes.length && !highlights.length && <div className="empty-state compact-empty"><PenLine size={26} /><strong>还没有笔记或划线</strong><span>选中正文文字可以划线，下方可以写心得</span></div>}</div></section>}<div className="book-pager"><button className="button button-soft" type="button" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}><ChevronLeft size={15} /> 上一页</button><span>第 {page + 1} / {totalPages} 页</span><button className="button button-soft" type="button" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>下一页 <ChevronRight size={15} /></button></div></div>;
}
