import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({ breaks: true });

export function renderMarkdown(md: string): string {
  return DOMPurify.sanitize(marked.parse(md) as string);
}

export function insertMd(el: { current: HTMLTextAreaElement | null }, set: (v: string) => void, before: string, after = "", placeholder = "") {
  const ta = el.current;
  if (!ta) return;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const selected = ta.value.slice(start, end) || placeholder;
  const next = ta.value.slice(0, start) + before + selected + after + ta.value.slice(end);
  set(next);
  requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + before.length, start + before.length + selected.length); });
}

export function MdToolbar({ elRef, set }: { elRef: { current: HTMLTextAreaElement | null }; set: (v: string) => void }) {
  const divider = () => {
    const ta = elRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const next = ta.value.slice(0, start) + "\n\n---\n\n" + ta.value.slice(start);
    set(next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + 7, start + 7); });
  };
  return <div className="md-toolbar">
    <button type="button" title="加粗" onClick={() => insertMd(elRef, set, "**", "**", "加粗文本")}><b>B</b></button>
    <button type="button" title="斜体" onClick={() => insertMd(elRef, set, "*", "*", "斜体文本")}><i>I</i></button>
    <button type="button" title="二级标题" onClick={() => insertMd(elRef, set, "## ", "", "标题")}>H2</button>
    <button type="button" title="分割线" onClick={divider}>—</button>
    <button type="button" title="引用" onClick={() => insertMd(elRef, set, "> ", "", "引用内容")}>❝</button>
    <button type="button" title="无序列表" onClick={() => insertMd(elRef, set, "- ", "", "列表项")}>•</button>
    <button type="button" title="行内代码" onClick={() => insertMd(elRef, set, "`", "`", "代码")}>{"</>"}</button>
  </div>;
}
