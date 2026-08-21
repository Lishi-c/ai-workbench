import { Award, Bell, Bookmark, Check, CheckSquare2, ChevronRight, Eye, Flame, Languages, Play, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";
import { dateKey, shiftedDateKey, type CustomWord } from "../../workbench-data";
import { safePercent, useWorkbench, words } from "../context";
import { readTextFile } from "../storage";
import { IconButton, MiniBars, PageIntro, SectionTitle } from "../ui";

export function EnglishPage() {
  const { data, updateData, notify } = useWorkbench();
  const [wordIndex, setWordIndex] = useState(0);
  const [revealed, setRevealed] = useState(true);
  const wordList: CustomWord[] = data.learning.customWords.length ? data.learning.customWords : words;
  const word = wordList[wordIndex] ?? wordList[0];
  const mastered = data.learning.masteredWords;
  const nextWord = () => { setWordIndex((current) => (current + 1) % Math.max(1, wordList.length)); setRevealed(false); };
  const remember = () => { updateData((current) => ({ ...current, learning: { ...current.learning, masteredWords: current.learning.masteredWords.includes(word.word) ? current.learning.masteredWords : [...current.learning.masteredWords, word.word], studyMinutes: current.learning.studyMinutes + 2, wordReviews: { ...(current.learning.wordReviews ?? {}), [word.word]: current.learning.wordReviews?.[word.word] ?? { due: shiftedDateKey(1), interval: 1 } } } })); notify(`「${word.word}」已计入学习进度`); nextWord(); };
  const today = dateKey();
  const dueWords = wordList.filter((w) => (data.learning.wordReviews?.[w.word]?.due ?? "9999") <= today);
  const reviewWord = (target: CustomWord, known: boolean) => {
    const prev = data.learning.wordReviews?.[target.word];
    const interval = known ? (prev ? Math.min((prev.interval || 1) * 2, 60) : 1) : 1;
    const d = new Date();
    d.setDate(d.getDate() + interval);
    const due = dateKey(d);
    updateData((current) => ({ ...current, learning: { ...current.learning, wordReviews: { ...(current.learning.wordReviews ?? {}), [target.word]: { due, interval } } } }));
    notify(known ? `「${target.word}」已记住，${interval >= 60 ? "两个月" : `${interval} 天`}后再复习` : `「${target.word}」明天再复习`);
  };
  const bookmark = () => { updateData((current) => ({ ...current, learning: { ...current.learning, bookmarkedWords: current.learning.bookmarkedWords.includes(word.word) ? current.learning.bookmarkedWords.filter((item) => item !== word.word) : [...current.learning.bookmarkedWords, word.word] } })); notify("单词收藏已更新"); };
  const speak = () => { if ("speechSynthesis" in window) { window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(word.word); utterance.lang = "en-US"; window.speechSynthesis.speak(utterance); } else notify("当前浏览器不支持语音播放"); };
  const importVocab = async (file?: File) => {
    if (!file) return;
    try {
      const text = await readTextFile(file);
      const parsed: unknown = JSON.parse(text);
      if (Array.isArray(parsed)) {
        const valid: CustomWord[] = (parsed as Array<Record<string, string>>)
          .filter((w) => w && w.word && w.cn)
          .map((w) => ({
            word: String(w.word).slice(0, 60),
            phonetic: String(w.phonetic ?? "").slice(0, 60),
            cn: String(w.cn).slice(0, 120),
            example: String(w.example ?? "").slice(0, 300),
            exampleCn: String(w.exampleCn ?? "").slice(0, 300),
          }));
        if (valid.length) {
          updateData((current) => ({ ...current, learning: { ...current.learning, customWords: valid } }));
          setWordIndex(0);
          setRevealed(false);
          notify(`已导入 ${valid.length} 个单词，词库已更新`);
        } else { notify("词表为空或格式有误"); }
      } else { notify("请使用 JSON 数组格式"); }
    } catch { notify("文件解析失败，请检查格式"); }
  };
  const progress = safePercent(mastered.length, wordList.length);
  return <div className="page-stack page-enter"><PageIntro eyebrow="KEEP LEARNING" title="每天进步一点点" copy="“换一个”只切换单词，“记住了”才会写入学习进度，两个入口各司其职。" actions={<label className="button button-primary" title="支持 JSON 格式词表"><Plus size={17} /> 导入词表<input type="file" accept=".json,.txt" onChange={(event) => { void importVocab(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>} /><section className="learning-hero panel-purple"><div className="learning-copy"><span className="pill pill-translucent"><Flame size={14} /> 今日已学习 {data.learning.studyMinutes} 分钟</span><h2>今日学习计划</h2><p>掌握当前词库中的 {wordList.length} 个单词，就能完成这一轮。</p><div className="learning-progress"><i style={{ width: `${progress}%` }} /></div><div className="learning-stats"><span><strong>{mastered.length}</strong> / {wordList.length} 单词</span><span><strong>{data.learning.studyMinutes}</strong> 分钟</span></div></div><div className="learning-badge"><Award size={40} /><strong>LEVEL 01</strong><span>Starter</span><i>{progress}%</i></div></section><section className="english-grid"><article className="word-card panel"><SectionTitle eyebrow="WORD OF THE DAY" title="今日单词" action={<IconButton label="收藏单词" className={data.learning.bookmarkedWords.includes(word.word) ? "is-active" : ""} onClick={bookmark}><Bookmark size={18} fill={data.learning.bookmarkedWords.includes(word.word) ? "currentColor" : "none"} /></IconButton>} /><div className="word-main"><div><h2>{word.word}</h2><p>{word.phonetic}</p></div><IconButton label="播放发音" className="sound-button" onClick={speak}><span><Bell className="hidden-icon" /><Languages size={20} /></span></IconButton></div>{revealed ? <div className="word-reveal"><strong>{word.cn}</strong><p>{word.example}</p><span>{word.exampleCn}</span></div> : <button className="reveal-button" type="button" onClick={() => setRevealed(true)}><Eye size={17} /> 点击查看释义</button>}<div className="word-actions"><button type="button" className="button button-soft" onClick={nextWord}><RotateCcw size={15} /> 换一个</button><button type="button" className="button button-primary" onClick={remember}>记住了 <Check size={15} /></button></div></article><aside className="english-side"><article className="panel daily-lessons"><SectionTitle eyebrow="TODAY" title="今日小课" /><div className="lesson-list"><button onClick={() => document.querySelector(".word-card")?.scrollIntoView({ behavior: "smooth" })}><span className="lesson-icon tone-purple"><Languages size={18} /></span><p><strong>新词学习</strong><small>{mastered.length} / {wordList.length} 个</small></p><div className="tiny-progress"><i style={{ width: `${progress}%` }} /></div></button><button onClick={() => { setWordIndex(0); setRevealed(false); }}><span className="lesson-icon tone-pink"><CheckSquare2 size={18} /></span><p><strong>词汇复习</strong><small>{mastered.length} 个已掌握</small></p><ChevronRight size={17} /></button><button onClick={speak}><span className="lesson-icon tone-blue"><Play size={18} /></span><p><strong>发音训练</strong><small>播放当前单词</small></p><ChevronRight size={17} /></button></div></article></aside></section><section className="panel study-week"><SectionTitle eyebrow="THIS WEEK" title="本周学习节奏" action={<span className="streak-note"><Flame size={14} /> 数据随学习累计</span>} /><div className="study-week-content"><div className="study-chart"><MiniBars values={[0, 0, 0, 0, data.learning.studyMinutes, 0, 0]} tone="pink" labels={["一", "二", "三", "四", "五", "六", "日"]} /></div><div className="study-summary"><div><strong>{mastered.length}</strong><span>掌握单词</span></div><div><strong>{data.learning.studyMinutes}m</strong><span>学习时长</span></div><div><strong>{progress}%</strong><span>当前进度</span></div></div></div></section><section className="panel review-card"><SectionTitle eyebrow="SPACED REPETITION" title="今日复习" action={<span className="status-pill"><RotateCcw size={14} /> {dueWords.length} 个待复习</span>} />{dueWords.length ? <div className="review-list">{dueWords.map((w) => <div className="review-row" key={w.word}><div className="review-word"><strong>{w.word}</strong><span>{w.cn}</span></div><div className="review-actions"><button type="button" className="button button-soft" onClick={() => reviewWord(w, false)}>不认识</button><button type="button" className="button button-primary" onClick={() => reviewWord(w, true)}>认识</button></div></div>)}</div> : <div className="empty-state compact-empty"><Award size={28} /><strong>今天没有需要复习的单词</strong><span>在「今日单词」里点「记住了」会把单词加入复习计划</span></div>}</section></div>;
}
