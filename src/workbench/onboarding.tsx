import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PageKey } from "./context";
import { useWorkbench } from "./context";

type Step = { navKey?: PageKey; title: string; description: string };

const STEPS: Step[] = [
  { title: "欢迎使用月蓝琉璃工作台", description: "这是一个本地优先的个人工作台，数据只存在你自己的电脑上，无需联网。接下来带你认识每个板块。" },
  { navKey: "dashboard", title: "仪表盘", description: "今日概览：一屏看到任务进度、今日日程、收支结余、健康数据与专注时长，快速掌握今天的状态。" },
  { navKey: "tasks", title: "时间计划", description: "管理任务与日程：新建任务（可勾选完成、设置每天/每周/每月重复），也能添加固定时间的日程，规划你的一天。" },
  { navKey: "notes", title: "便签笔记", description: "导入 TXT / Markdown / JSON 文件，用文件夹把笔记整理成合集（支持多级嵌套），拖拽卡片即可排序归类，还能导出备份。" },
  { navKey: "diary", title: "心情日记", description: "写日记记录每天的片段：标题、正文、标签，右侧最近记录可滚动查看，还能按日期 / 标题 / 正文搜索回顾，左侧日历标出有记录的日子。" },
  { navKey: "health", title: "健康管理", description: "记录步数、睡眠时长与质量、静息心率、活跃分钟、消耗千卡和训练次数，仪表盘会帮你汇总展示。" },
  { navKey: "recipes", title: "美味食谱", description: "收藏灵感食谱（内置推荐 + 自定义 + 导入文件），规划一周餐桌，做菜时还能一键启动烹饪计时。" },
  { navKey: "finance", title: "收支记录", description: "记一笔收入或支出，按餐饮 / 购物 / 居住等分类，设置月预算后自动计算结余、趋势和分类占比。" },
  { navKey: "focus", title: "专注记录", description: "番茄钟式专注学习：设定时长、开始计时，专注时长会自动统计，还可以关联到具体任务。" },
  { navKey: "english", title: "英语学习", description: "词汇背诵与练习：收藏生词、标记已掌握，积累每日学习时长，坚持打卡提升词汇量。" },
  { navKey: "library", title: "图书库", description: "导入 TXT / Markdown / JSON 图书阅读，记录阅读进度，做笔记、划重点，标记想读或读完。" },
  { title: "准备就绪", description: "都看完了，开始使用吧！之后随时可以在「偏好设置」里重新打开这份引导。" },
];

export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const { navigate } = useWorkbench();
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [bubbleHeight, setBubbleHeight] = useState(240);

  const current = STEPS[step];

  // 切换到对应板块（导航按钮始终在侧栏，不受页面切换影响）
  useEffect(() => {
    if (current.navKey) navigate(current.navKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.navKey]);

  // 定位侧栏目标元素（用 getBoundingClientRect + fixed 定位，规避 zoom 下指针坐标偏差）
  useLayoutEffect(() => {
    if (!current.navKey) { setRect(null); return; }
    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-nav-key="${current.navKey}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else {
        setRect(null);
      }
    };
    const target = document.querySelector<HTMLElement>(`[data-nav-key="${current.navKey}"]`);
    target?.scrollIntoView({ block: "nearest" });
    measure();
    window.addEventListener("resize", measure);
    const timer = window.setInterval(measure, 350);
    return () => { window.removeEventListener("resize", measure); window.clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.navKey]);

  const prev = () => setStep((s) => Math.max(0, s - 1));
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));

  // 测量气泡实际高度，避免底部板块的气泡溢出屏幕被遮住
  useLayoutEffect(() => {
    const el = bubbleRef.current;
    if (el) setBubbleHeight(el.offsetHeight);
  }, [step]);

  const bubbleStyle: React.CSSProperties = rect
    ? (() => {
        const margin = 16;
        const top = Math.max(margin, Math.min(rect.top, window.innerHeight - bubbleHeight - margin));
        const left = Math.min(window.innerWidth - 460, rect.left + rect.width + 20);
        return { top, left };
      })()
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return createPortal(
    <div className="onboarding-root">
      {rect && <div className="onboarding-hole" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />}
      <div className="onboarding-bubble" style={bubbleStyle} ref={bubbleRef}>
        <div className="onboarding-progress"><span>新手引导</span><span>{step + 1} / {STEPS.length}</span></div>
        <h3>{current.title}</h3>
        <p>{current.description}</p>
        <div className="onboarding-actions">
          <button type="button" className="button button-soft" onClick={onFinish}>跳过</button>
          <div className="onboarding-nav">
            {step > 0 && <button type="button" className="button button-soft" onClick={prev}><ChevronLeft size={15} /> 上一步</button>}
            {step < STEPS.length - 1
              ? <button type="button" className="button button-primary" onClick={next}>下一步 <ChevronRight size={15} /></button>
              : <button type="button" className="button button-primary" onClick={onFinish}>开始使用</button>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
