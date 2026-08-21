import { ArrowRight, Clock3, FileUp, Heart, PenLine, Play, Plus, Sparkles } from "lucide-react";
import { createId } from "../../workbench-data";
import { recipeCards, useWorkbench } from "../context";
import { readTextFile } from "../storage";
import { PageIntro, SectionTitle } from "../ui";

export function RecipesPage() {
  const { data, updateData, openModal, notify } = useWorkbench();
  const toggleLike = (title: string) => { updateData((current) => ({ ...current, likedRecipes: current.likedRecipes.includes(title) ? current.likedRecipes.filter((item) => item !== title) : [...current.likedRecipes, title] })); notify(data.likedRecipes.includes(title) ? "已取消收藏" : "食谱已收藏"); };
  const importRecipe = async (file?: File) => {
    if (!file) return;
    try {
      const raw = await readTextFile(file);
      let title = file.name.replace(/\.(md|txt|json)$/i, "");
      let content = raw.trim();
      if (file.name.endsWith(".json")) { const parsed = JSON.parse(raw) as { title?: string; content?: string; steps?: string[] }; title = parsed.title ?? title; content = parsed.content ?? parsed.steps?.join("\n") ?? raw; }
      else { title = raw.split("\n").find((line) => line.trim())?.replace(/^#+\s*/, "").slice(0, 40) || title; }
      updateData((current) => ({ ...current, importedRecipes: [{ id: createId("recipe"), title, content: content.slice(0, 12000), sourceName: file.name }, ...current.importedRecipes] }));
      notify(`已导入「${title}」`);
    } catch { notify("导入失败，请检查文件格式"); }
  };
  const allRecipes = [...recipeCards, ...data.customRecipes];
  const recipeLookup = new Map(allRecipes.map((r) => [r.title, r]));
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const featured = allRecipes[dayOfYear % allRecipes.length] ?? recipeCards[0];
  const MEAL_DEFAULTS: Record<string, { image: string; name: string }> = {
    "一": { image: "https://miaoda-site-img.cdn.bcebos.com/images/MiaoTu_55188e7e-3eeb-4530-aaa2-e2ef216379e2.jpg", name: "轻食" },
    "二": { image: "https://miaoda-site-img.cdn.bcebos.com/images/MiaoTu_6b4bf3b6-6600-4287-ad4b-66a4d450d7ca.jpg", name: "汤面" },
    "三": { image: "https://miaoda-site-img.cdn.bcebos.com/images/MiaoTu_d2a795cd-ab2d-4369-8373-3e40273425af.jpg", name: "三明治" },
    "四": { image: "https://miaoda-site-img.cdn.bcebos.com/images/MiaoTu_a9486a78-7e8e-4a9c-9913-93344e6ce29b.jpg", name: "咖喱" },
    "五": { image: "https://miaoda-site-img.cdn.bcebos.com/images/MiaoTu_020cbc37-5ef5-4abf-bfa9-df2520dadbb1.jpg", name: "奶油南瓜意面" },
    "六": { image: "https://miaoda-site-img.cdn.bcebos.com/images/MiaoTu_6b4bf3b6-6600-4287-ad4b-66a4d450d7ca.jpg", name: "炖菜" },
    "日": { image: "", name: "添加" },
  };
  const mealDays = (["一", "二", "三", "四", "五", "六", "日"] as const).map((d) => {
    const n = data.mealPlan[d] ?? MEAL_DEFAULTS[d].name;
    const image = recipeLookup.get(n)?.image ?? (MEAL_DEFAULTS[d].image || undefined);
    return { d, n, image };
  });
  const addMenuBtn = <button className="button button-primary" onClick={() => openModal("addRecipe")}><Plus size={17} /> 添加食谱</button>;
  return <div className="page-stack page-enter"><PageIntro eyebrow="MY KITCHEN" title="今天你想吃点什么？" copy="收藏、导入、添加与一周餐桌形成同一条可继续编辑的食谱链路。" actions={addMenuBtn} /><section className="recipe-feature panel-sand"><div className="recipe-feature-copy"><span className="pill recipe-feature-pill"><Sparkles size={13} /> 今日推荐</span><h2>{featured.title}</h2><p>{featured.content}</p><div className="recipe-meta"><span><Clock3 size={15} /> {featured.meta}</span></div><button className="button button-primary" onClick={() => openModal("recipe", featured.title)}><Play size={15} fill="currentColor" /> 开始烹饪</button></div><div className="recipe-feature-art" aria-hidden="true"><img src={featured.image} alt={featured.title} /></div></section><section className="meal-strip panel"><SectionTitle eyebrow="THIS WEEK" title="一周餐桌" action={<button className="text-button" onClick={() => openModal("meal", "五")}>编辑计划 <PenLine size={14} /></button>} /><div className="meal-days">{mealDays.map((item) => <button key={item.d} className={item.d === "五" ? "active" : ""} onClick={() => openModal("meal", item.d)}><small>周{item.d}</small><span className="meal-art">{item.image ? <img src={item.image} alt="" /> : <Plus size={18} />}</span><strong>{item.n}</strong></button>)}</div></section><section><SectionTitle eyebrow="COLLECTION" title="最近收藏与导入" /><div className="recipe-grid">{recipeCards.map((recipe) => <article className="recipe-card panel" key={recipe.title}><div className={`recipe-visual tone-${recipe.tone}`}><img src={recipe.image} alt={recipe.title} /><button type="button" aria-label={data.likedRecipes.includes(recipe.title) ? "取消收藏" : "收藏"} onClick={() => toggleLike(recipe.title)} className={data.likedRecipes.includes(recipe.title) ? "liked" : ""}><Heart size={17} fill={data.likedRecipes.includes(recipe.title) ? "currentColor" : "none"} /></button><small>{recipe.tag}</small></div><div className="recipe-info"><h3>{recipe.title}</h3><p>{recipe.meta}</p><button type="button" onClick={() => openModal("recipe", recipe.title)}>查看食谱 <ArrowRight size={14} /></button></div></article>)}{data.customRecipes.map((recipe) => <article className="recipe-card panel" key={recipe.id}><div className={`recipe-visual tone-${recipe.tone}`}><img src={recipe.image} alt={recipe.title} /><button type="button" aria-label={data.likedRecipes.includes(recipe.title) ? "取消收藏" : "收藏"} onClick={() => toggleLike(recipe.title)} className={data.likedRecipes.includes(recipe.title) ? "liked" : ""}><Heart size={17} fill={data.likedRecipes.includes(recipe.title) ? "currentColor" : "none"} /></button><small>{recipe.tag}</small></div><div className="recipe-info"><h3>{recipe.title}</h3><p>{recipe.meta}</p><button type="button" onClick={() => openModal("recipe", recipe.id)}>查看食谱 <ArrowRight size={14} /></button></div></article>)}{data.importedRecipes.slice(0, 3).map((recipe) => <article className="recipe-card imported-recipe-card panel" key={recipe.id}><div className="imported-recipe-visual"><FileUp size={28} /><small>已导入</small></div><div className="recipe-info"><h3>{recipe.title}</h3><p>{recipe.sourceName}</p><button type="button" onClick={() => openModal("recipe", recipe.id)}>查看食谱 <ArrowRight size={14} /></button></div></article>)}</div></section></div>;
}
