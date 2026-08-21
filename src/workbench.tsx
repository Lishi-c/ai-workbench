import { Bell, CheckCircle2, ChevronRight, Download, Menu, Search, Settings, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createDefaultWorkbenchData, dateKey, normalizeWorkbenchData, type WorkbenchData } from "./workbench-data";
import { bottomItems, navSections, type ModalState, type PageKey, type WorkbenchContextValue, WorkbenchContext } from "./workbench/context";
import { CommandPalette, EditorModal, ReminderPanel } from "./workbench/overlays";
import { DashboardPage, DiaryPage, EnglishPage, FinancePage, FocusPage, HealthPage, LibraryPage, NotesPage, RecipesPage, TasksPage } from "./workbench/pages";
import { fetchHolidays, loadLocalData, saveLocalData } from "./workbench/storage";
import type { HolidayMap } from "./workbench/calendar-festivals";
import { IconButton, WorkspaceTitle } from "./workbench/ui";

function renderPage(page: PageKey, deep: { noteId: string | null; bookId: string | null; onNoteHandled: () => void; onBookHandled: () => void }) {
  if (page === "dashboard") return <DashboardPage />;
  if (page === "tasks") return <TasksPage />;
  if (page === "finance") return <FinancePage />;
  if (page === "recipes") return <RecipesPage />;
  if (page === "health") return <HealthPage />;
  if (page === "diary") return <DiaryPage />;
  if (page === "focus") return <FocusPage />;
  if (page === "english") return <EnglishPage />;
  if (page === "notes") return <NotesPage openDocId={deep.noteId} onDocHandled={deep.onNoteHandled} />;
  return <LibraryPage openBookId={deep.bookId} onBookHandled={deep.onBookHandled} />;
}

type WorkbenchProps = {
  skinClassName?: string;
  skinLabel?: string;
};

export default function Workbench({ skinClassName = "", skinLabel }: WorkbenchProps) {
  const [activePage, setActivePage] = useState<PageKey>("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [openBookId, setOpenBookId] = useState<string | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const reminderRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<WorkbenchData>(() => createDefaultWorkbenchData());
  const [holidays, setHolidays] = useState<HolidayMap>({});
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"loading" | "saving" | "saved" | "offline">("loading");
  const navItems = useMemo(() => navSections.flatMap((section) => section.items), []);

  useEffect(() => {
    let active = true;
    void loadLocalData().then(({ data: saved, restored }) => {
      if (!active) return;
      if (saved) setData(normalizeWorkbenchData(saved));
      if (restored) setToast("检测到数据文件损坏，已自动从备份恢复");
      setHydrated(true);
      setSaveStatus("saved");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void fetchHolidays(new Date().getFullYear()).then((map) => { if (active) setHolidays(map); });
    return () => { active = false; };
  }, []);

  const loadHolidays = useCallback((year: number) => {
    void fetchHolidays(year).then((map) => setHolidays((prev) => ({ ...prev, ...map })));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setSaveStatus("saving");
    const timer = window.setTimeout(() => { void saveLocalData(data).then((ok) => setSaveStatus(ok ? "saved" : "offline")); }, 450);
    return () => window.clearTimeout(timer);
  }, [data, hydrated]);

  useEffect(() => {
    const syncPageFromHash = () => { const next = window.location.hash.replace("#", "") as PageKey; if (navItems.some((item) => item.key === next)) setActivePage(next); };
    syncPageFromHash(); window.addEventListener("hashchange", syncPageFromHash); return () => window.removeEventListener("hashchange", syncPageFromHash);
  }, [navItems]);

  useEffect(() => { document.body.style.overflow = drawerOpen || modal ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [drawerOpen, modal]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2600); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen((value) => !value); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!reminderOpen) return;
    const handle = (event: MouseEvent) => {
      if (reminderRef.current && !reminderRef.current.contains(event.target as Node)) setReminderOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [reminderOpen]);

  const navigate = (key: PageKey) => { setActivePage(key); setDrawerOpen(false); window.history.replaceState(null, "", `#${key}`); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openNote = (id: string) => { setOpenNoteId(id); navigate("notes"); setPaletteOpen(false); };
  const openBook = (id: string) => { setOpenBookId(id); navigate("library"); setPaletteOpen(false); };
  const context = useMemo<WorkbenchContextValue>(() => ({ data, updateData: setData, navigate, openModal: (kind, payload) => setModal({ kind, payload }), notify: setToast, holidays, loadHolidays }), [data, holidays, loadHolidays]);
  const isMoonblue = skinClassName.split(" ").includes("moonblue-glass");
  const activeItem = navItems.find((item) => item.key === activePage);
  const statusText = saveStatus === "loading" ? "正在读取数据…" : saveStatus === "saving" ? "正在保存…" : saveStatus === "saved" ? "所有更改已保存" : "暂时无法保存";
  const pendingCount = data.tasks.filter((task) => task.date === dateKey() && !task.done).length;

  return <WorkbenchContext.Provider value={context}>
    <div className={`workbench-app ${skinClassName} ${data.settings.theme === "dark" ? "dark" : ""}`.trim()} style={{ "--app-zoom": data.settings.fontScale } as React.CSSProperties}>
      <button type="button" aria-label="关闭菜单" className={`drawer-scrim ${drawerOpen ? "is-open" : ""}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`app-sidebar ${drawerOpen ? "is-open" : ""}`}>
        {isMoonblue ? <header className="moonblue-sidebar-head">
          <div className="moonblue-brand-mark" aria-hidden="true"><span /><span /><i /></div>
          <div><strong>MOONBLUE</strong><span>月蓝琉璃 · WORKSPACE</span></div>
          <IconButton label="关闭菜单" className="sidebar-close" onClick={() => setDrawerOpen(false)}><X size={18} /></IconButton>
        </header> : <div className="profile-card">
          <img src="/images/workbench-cover-flat.png" alt="" aria-hidden="true" />
          {skinLabel && <span className="skin-signature">{skinLabel}</span>}
          <IconButton label="关闭菜单" className="sidebar-close" onClick={() => setDrawerOpen(false)}><X size={18} /></IconButton>
          <div className="profile-card-copy"><strong><WorkspaceTitle title={data.settings.workspaceTitle} /></strong><span>{data.settings.workspaceSubtitle}</span></div>
        </div>}
        {isMoonblue && <div className="moonblue-workspace-label"><small>PERSONAL BOARD</small><strong>{data.settings.workspaceTitle}</strong><span>{data.settings.workspaceSubtitle}</span></div>}
        <nav className="side-nav" aria-label="主要导航">{navSections.map((section) => <div className="nav-section" key={section.label}>
          <span className="nav-label">{section.label}</span>
          {section.items.map((item) => { const Icon = item.icon; return <button type="button" className={activePage === item.key ? "active" : ""} onClick={() => navigate(item.key)} key={item.key}><span className="nav-icon"><Icon size={18} /></span><span><strong>{item.label}</strong><small>{item.caption}</small></span><ChevronRight className="nav-chevron" size={15} /></button>; })}
        </div>)}</nav>
        {isMoonblue ? <footer className="moonblue-sidebar-footer">
          <span className="moonblue-avatar">{data.settings.displayName.slice(0, 1)}</span>
          <div><strong>{data.settings.displayName}</strong><small>{statusText}</small></div>
          <IconButton label="偏好设置" onClick={() => setModal({ kind: "settings" })}><Settings size={16} /></IconButton>
          <IconButton label="清空所有记录" onClick={() => setModal({ kind: "clear" })}><Trash2 size={16} /></IconButton>
          <IconButton label="数据备份" onClick={() => setModal({ kind: "backup" })}><Download size={16} /></IconButton>
        </footer> : <div className="sidebar-footer"><button type="button" onClick={() => setModal({ kind: "settings" })}><Settings size={17} /><span>偏好设置</span></button><button type="button" onClick={() => setModal({ kind: "clear" })}><Trash2 size={17} /><span>清空记录</span></button><button type="button" onClick={() => setModal({ kind: "backup" })}><Download size={17} /><span>数据备份</span></button><p>{statusText}</p></div>}
      </aside>
      <IconButton label="打开菜单" className="floating-menu-button" onClick={() => setDrawerOpen(true)}><Menu size={20} /></IconButton>
      <div className="app-main">
        {isMoonblue && <header className="moonblue-topbar">
          <div><span>月蓝琉璃 /</span><strong>{activeItem?.label ?? "工作台"}</strong></div>
          <div className="moonblue-topbar-actions">
            <button type="button" className="moonblue-search-button" onClick={() => setPaletteOpen(true)}><Search size={15} /><span>快速查找</span><kbd>⌘ K</kbd></button>
            <div className="reminder-wrap" ref={reminderRef}><IconButton label="提醒" onClick={() => setReminderOpen((value) => !value)}><Bell size={17} /></IconButton>{pendingCount > 0 && <span className="reminder-badge">{pendingCount > 99 ? "99+" : pendingCount}</span>}{reminderOpen && <ReminderPanel data={data} navigate={navigate} onClose={() => setReminderOpen(false)} />}</div>
          </div>
        </header>}
        <main className="content-area" key={activePage}>{renderPage(activePage, { noteId: openNoteId, bookId: openBookId, onNoteHandled: () => setOpenNoteId(null), onBookHandled: () => setOpenBookId(null) })}</main>
      </div>
      <nav className="bottom-nav" aria-label="移动端导航">{bottomItems.map((item) => { const Icon = item.icon; return <button type="button" className={activePage === item.key ? "active" : ""} key={item.key} onClick={() => navigate(item.key)}><Icon size={19} /><span>{item.label}</span></button>; })}<button type="button" onClick={() => setDrawerOpen(true)}><Menu size={19} /><span>更多</span></button></nav>
      {modal && <EditorModal modal={modal} close={() => setModal(null)} />}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} navItems={navItems} data={data} navigate={navigate} openNote={openNote} openBook={openBook} />
      {toast && <div className="app-toast" role="status"><CheckCircle2 size={17} />{toast}</div>}
    </div>
  </WorkbenchContext.Provider>;
}
