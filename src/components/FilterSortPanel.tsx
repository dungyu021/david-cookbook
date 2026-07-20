// 首頁的篩選與排序面板(React island)
// 不負責渲染料理卡片本身(卡片仍由 Astro 的 DishCard 產生,才能吃到 astro:assets 的圖片最佳化)。
// 這裡只讀取 build 時產生的輕量索引,在瀏覽器端計算篩選/排序結果,
// 再直接操作 #dish-grid 底下的 DOM(依 data-slug 顯示/隱藏、重新排序)。
//
// 響應式布局:手機是底部彈出的 bottom sheet(lg:hidden),
// 桌面是常駐側欄(hidden lg:block)。兩者共用同一份 state,
// 篩選控制項的 JSX(filterControls)在兩邊各渲染一份,操作任一邊都會同步。
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  categoryOf,
  normalizeIngredientName,
  type CategoryKey,
} from '../data/ingredientCategories';

interface DishIndexItem {
  slug: string;
  stars: number;
  tags: string[];
  cookingTimeMinutes: number;
  ingredients: string[];
  date: number;
}

interface Props {
  dishes: DishIndexItem[];
}

type SortKey = 'date-desc' | 'date-asc' | 'stars-desc' | 'stars-asc';

const TIME_STEP = 5;
const TIME_MIN_GAP = 10;

function readParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    tags: params.get('tags')?.split(',').filter(Boolean) ?? [],
    include: params.get('include')?.split(',').filter(Boolean) ?? [],
    exclude: params.get('exclude')?.split(',').filter(Boolean) ?? [],
    min: params.get('min'),
    max: params.get('max'),
    sort: (params.get('sort') as SortKey) || 'date-desc',
  };
}

function cookingTimeText(minutes: number) {
  return minutes >= 60 ? `${Math.round((minutes / 60) * 10) / 10}小時` : `${minutes}分鐘`;
}

// 依大類別分組的食材選單(包含食材/排除食材共用同一份分組資料)
function groupIngredients(names: string[]) {
  const byCategory = new Map<CategoryKey, string[]>();
  for (const name of names) {
    const cat = categoryOf(name);
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(name);
  }
  return CATEGORY_ORDER.filter((cat) => byCategory.has(cat)).map((cat) => ({
    key: cat,
    label: CATEGORY_LABELS[cat],
    items: byCategory.get(cat)!.sort(),
  }));
}

// 「想吃/不吃」整區塊的下拉開關:按下標題才展開所有大類別
// 展開/收合動畫速度與手機版篩選面板(bottom sheet)一致:duration-400 ease-out
function CollapsibleSection({
  heading,
  title,
  count,
  children,
}: {
  heading: string;
  title: string;
  count: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-sm font-bold text-stone-700">{heading}</h3>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700"
      >
        <span>
          {title}
          {count > 0 ? `（已選 ${count}）` : ''}
        </span>
        <span
          className={`text-stone-400 transition-transform duration-400 ease-out ${open ? 'rotate-180' : ''}`}
        >
          ⌄
        </span>
      </button>
      {/* grid-rows 0fr→1fr 是不需量測高度就能做「展開到內容高度」動畫的寫法 */}
      <div
        className={`grid transition-[grid-template-rows] duration-400 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </section>
  );
}

// 大類別本身也是下拉式:按類別旁的箭頭才展開細項,
// 按類別名稱本身則是「一次勾選/取消整個大類別」。
function IngredientGroupPicker({
  groups,
  selected,
  onToggleItem,
  onToggleCategory,
}: {
  groups: { key: CategoryKey; label: string; items: string[] }[];
  selected: string[];
  onToggleItem: (item: string) => void;
  onToggleCategory: (items: string[]) => void;
}) {
  const [expanded, setExpanded] = useState<Set<CategoryKey>>(new Set());
  const toggleExpanded = (key: CategoryKey) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const allSelected = group.items.every((item) => selected.includes(item));
        const someSelected = !allSelected && group.items.some((item) => selected.includes(item));
        const isExpanded = expanded.has(group.key);
        return (
          <div key={group.key}>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onToggleCategory(group.items)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                  allSelected
                    ? 'bg-stone-700 text-white'
                    : someSelected
                      ? 'bg-stone-400 text-white'
                      : 'bg-stone-200 text-stone-700'
                }`}
              >
                {group.label}
              </button>
              <button
                type="button"
                onClick={() => toggleExpanded(group.key)}
                aria-label={isExpanded ? `收合${group.label}細項` : `展開${group.label}細項`}
                className="px-1 text-xs text-stone-400"
              >
                <span
                  className={`inline-block transition-transform duration-400 ease-out ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                >
                  ⌄
                </span>
              </button>
            </div>
            <div
              className={`grid transition-[grid-template-rows] duration-400 ease-out ${
                isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <div className="mt-1.5 flex flex-wrap gap-1.5 pl-1">
                  {group.items.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => onToggleItem(item)}
                      className={`rounded-full px-2.5 py-1 text-xs transition ${
                        selected.includes(item)
                          ? 'bg-amber-500 text-white'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 標籤預設只顯示前 TAG_PREVIEW_COUNT 個(約兩排),其餘收在「顯示更多」後面
const TAG_PREVIEW_COUNT = 8;

function TagPicker({
  tags,
  selected,
  onToggle,
}: {
  tags: string[];
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const previewTags = tags.slice(0, TAG_PREVIEW_COUNT);
  const restTags = tags.slice(TAG_PREVIEW_COUNT);
  const hasMore = restTags.length > 0;

  const renderTag = (tag: string) => (
    <button
      key={tag}
      type="button"
      onClick={() => onToggle(tag)}
      className={`rounded-full px-3 py-1 text-xs transition ${
        selected.includes(tag) ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-600'
      }`}
    >
      #{tag}
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap gap-2">{previewTags.map(renderTag)}</div>
      {hasMore && (
        <>
          {/* 其餘標籤收在這裡,展開時把下方的「顯示更多」按鈕往下推,收合時再把它推回去 */}
          <div
            className={`grid transition-[grid-template-rows] duration-400 ease-out ${
              showAll ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            }`}
          >
            <div className="overflow-hidden">
              <div className="mt-2 flex flex-wrap gap-2">{restTags.map(renderTag)}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-2 w-full rounded-full bg-stone-100 py-1.5 text-xs font-medium text-stone-600 transition"
          >
            {showAll ? '收合' : `顯示更多（${restTags.length}）`}
          </button>
        </>
      )}
    </div>
  );
}

// 烹調時間雙向滑桿:同一條軌道、兩個把手,把手間至少間隔 TIME_MIN_GAP 分鐘
function TimeRangeSlider({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: [number, number];
  onChange: (next: [number, number]) => void;
}) {
  const [lo, hi] = value;
  const percent = (v: number) => ((v - min) / (max - min || 1)) * 100;

  return (
    <div className="relative h-5">
      <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-stone-200" />
      <div
        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-amber-500"
        style={{ left: `${percent(lo)}%`, right: `${100 - percent(hi)}%` }}
      />
      <input
        type="range"
        aria-label="最短烹調時間"
        min={min}
        max={max}
        step={TIME_STEP}
        value={lo}
        onChange={(e) => {
          const next = Math.min(Number(e.target.value), hi - TIME_MIN_GAP);
          onChange([Math.max(min, next), hi]);
        }}
        className="range-thumb absolute inset-0 z-20 w-full cursor-pointer appearance-none bg-transparent"
      />
      <input
        type="range"
        aria-label="最長烹調時間"
        min={min}
        max={max}
        step={TIME_STEP}
        value={hi}
        onChange={(e) => {
          const next = Math.max(Number(e.target.value), lo + TIME_MIN_GAP);
          onChange([lo, Math.min(max, next)]);
        }}
        className="range-thumb absolute inset-0 z-10 w-full cursor-pointer appearance-none bg-transparent"
      />
    </div>
  );
}

export default function FilterSortPanel({ dishes }: Props) {
  // 把每道菜的食材正規化(去括號、合併同義詞、排除調味料),供篩選使用
  const normalizedDishes = useMemo(
    () =>
      dishes.map((d) => ({
        ...d,
        ingredients: Array.from(
          new Set(
            d.ingredients
              .map((name) => normalizeIngredientName(name))
              .filter((name): name is string => name !== null),
          ),
        ),
      })),
    [dishes],
  );

  const allIngredients = useMemo(
    () => Array.from(new Set(normalizedDishes.flatMap((d) => d.ingredients))),
    [normalizedDishes],
  );
  const ingredientGroups = useMemo(() => groupIngredients(allIngredients), [allIngredients]);

  const allTags = useMemo(() => Array.from(new Set(dishes.flatMap((d) => d.tags))).sort(), [dishes]);
  const timeBounds = useMemo(() => {
    const times = dishes.map((d) => d.cookingTimeMinutes);
    return { min: Math.min(...times), max: Math.max(...times) };
  }, [dishes]);

  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [ready, setReady] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [includeIngredients, setIncludeIngredients] = useState<string[]>([]);
  const [excludeIngredients, setExcludeIngredients] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<[number, number]>([timeBounds.min, timeBounds.max]);
  const [sort, setSort] = useState<SortKey>('date-desc');

  // 初始化時讀取網址上的篩選條件(方便分享篩選結果連結)
  useEffect(() => {
    const p = readParams();
    setSelectedTags(p.tags);
    setIncludeIngredients(p.include);
    setExcludeIngredients(p.exclude);
    setTimeRange([
      p.min !== null ? Number(p.min) : timeBounds.min,
      p.max !== null ? Number(p.max) : timeBounds.max,
    ]);
    setSort(p.sort);
    setReady(true);
    // 只在掛載時讀取一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 打開 bottom sheet 時,下一個 frame 才加上動畫 class,才能觸發「從下滑上來」的 CSS transition
  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const openSheet = () => setOpen(true);
  const closeSheet = () => {
    setShown(false);
    window.setTimeout(() => setOpen(false), 400);
  };

  const filtered = useMemo(
    () =>
      normalizedDishes.filter((d) => {
        if (selectedTags.length > 0 && !selectedTags.every((t) => d.tags.includes(t))) return false;
        if (includeIngredients.length > 0 && !includeIngredients.some((ing) => d.ingredients.includes(ing)))
          return false;
        if (excludeIngredients.length > 0 && excludeIngredients.some((ing) => d.ingredients.includes(ing)))
          return false;
        if (d.cookingTimeMinutes < timeRange[0] || d.cookingTimeMinutes > timeRange[1]) return false;
        return true;
      }),
    [normalizedDishes, selectedTags, includeIngredients, excludeIngredients, timeRange],
  );

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sort === 'date-asc') return a.date - b.date;
      if (sort === 'stars-desc') return b.stars - a.stars || b.date - a.date;
      if (sort === 'stars-asc') return a.stars - b.stars || b.date - a.date;
      return b.date - a.date;
    });
    return copy;
  }, [filtered, sort]);

  // 篩選/排序條件變動時:同步網址 query string,並直接操作卡片 DOM
  useEffect(() => {
    if (!ready) return;

    const params = new URLSearchParams();
    if (selectedTags.length) params.set('tags', selectedTags.join(','));
    if (includeIngredients.length) params.set('include', includeIngredients.join(','));
    if (excludeIngredients.length) params.set('exclude', excludeIngredients.join(','));
    if (timeRange[0] !== timeBounds.min) params.set('min', String(timeRange[0]));
    if (timeRange[1] !== timeBounds.max) params.set('max', String(timeRange[1]));
    if (sort !== 'date-desc') params.set('sort', sort);
    const query = params.toString();
    window.history.replaceState({}, '', query ? `?${query}` : window.location.pathname);

    const grid = document.getElementById('dish-grid');
    if (!grid) return;

    const visibleSlugs = new Set(sorted.map((d) => d.slug));
    sorted.forEach((d) => {
      const el = grid.querySelector<HTMLElement>(`[data-slug="${d.slug}"]`);
      if (el) grid.appendChild(el);
    });
    grid.querySelectorAll<HTMLElement>('[data-slug]').forEach((el) => {
      el.classList.toggle('hidden', !visibleSlugs.has(el.dataset.slug!));
    });
  }, [ready, sorted, selectedTags, includeIngredients, excludeIngredients, timeRange, sort, timeBounds]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const makeToggleItem = (setter: (fn: (prev: string[]) => string[]) => void) => (item: string) =>
    setter((prev) => (prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]));

  const makeToggleCategory = (setter: (fn: (prev: string[]) => string[]) => void) => (items: string[]) =>
    setter((prev) => {
      const allSelected = items.every((i) => prev.includes(i));
      if (allSelected) return prev.filter((i) => !items.includes(i));
      return Array.from(new Set([...prev, ...items]));
    });

  const toggleIncludeItem = makeToggleItem(setIncludeIngredients);
  const toggleIncludeCategory = makeToggleCategory(setIncludeIngredients);
  const toggleExcludeItem = makeToggleItem(setExcludeIngredients);
  const toggleExcludeCategory = makeToggleCategory(setExcludeIngredients);

  const resetFilters = () => {
    setSelectedTags([]);
    setIncludeIngredients([]);
    setExcludeIngredients([]);
    setTimeRange([timeBounds.min, timeBounds.max]);
  };

  const activeCount =
    selectedTags.length + includeIngredients.length + excludeIngredients.length;

  const sortSelect = (
    <select
      value={sort}
      onChange={(e) => setSort(e.target.value as SortKey)}
      className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 shadow-sm"
    >
      <option value="date-desc">上架時間：新到舊</option>
      <option value="date-asc">上架時間：舊到新</option>
      <option value="stars-desc">星等：高到低</option>
      <option value="stars-asc">星等：低到高</option>
    </select>
  );

  const filterControls = (
    <>
      <section className="mb-5">
        <h3 className="mb-2 text-sm font-bold text-stone-700">標籤</h3>
        <TagPicker tags={allTags} selected={selectedTags} onToggle={toggleTag} />
      </section>

      <CollapsibleSection heading="包含食材" title="想吃..." count={includeIngredients.length}>
        <IngredientGroupPicker
          groups={ingredientGroups}
          selected={includeIngredients}
          onToggleItem={toggleIncludeItem}
          onToggleCategory={toggleIncludeCategory}
        />
      </CollapsibleSection>

      <CollapsibleSection heading="排除食材" title="不吃..." count={excludeIngredients.length}>
        <IngredientGroupPicker
          groups={ingredientGroups}
          selected={excludeIngredients}
          onToggleItem={toggleExcludeItem}
          onToggleCategory={toggleExcludeCategory}
        />
      </CollapsibleSection>

      <section className="mb-2">
        <h3 className="mb-3 text-sm font-medium text-stone-700">
          烹調時間：{cookingTimeText(timeRange[0])} – {cookingTimeText(timeRange[1])}
        </h3>
        <TimeRangeSlider min={timeBounds.min} max={timeBounds.max} value={timeRange} onChange={setTimeRange} />
      </section>
    </>
  );

  return (
    <>
      {/* 手機版:頂部的篩選按鈕 + 排序下拉選單 */}
      <div className="mb-6 lg:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={openSheet}
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm"
          >
            🔍 篩選{activeCount > 0 ? `（${activeCount}）` : ''}
          </button>
          {sortSelect}
        </div>
        <p className="mt-2 text-xs text-stone-500">符合條件：{sorted.length} 道料理</p>
      </div>

      {/* 手機版:從下滑出的篩選面板(bottom sheet) */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:hidden">
          <div
            onClick={closeSheet}
            className={`absolute inset-0 bg-black/40 transition-opacity duration-400 ease-out ${
              shown ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div
            className={`relative z-10 max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl transition-transform duration-400 ease-out ${
              shown ? 'translate-y-0' : 'translate-y-full'
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">篩選條件</h2>
              <button
                type="button"
                onClick={closeSheet}
                aria-label="關閉篩選面板"
                className="text-xl leading-none text-stone-400"
              >
                ✕
              </button>
            </div>

            {filterControls}

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={resetFilters}
                className="flex-1 rounded-full border border-stone-300 py-2 text-sm text-stone-600"
              >
                清除篩選
              </button>
              <button
                type="button"
                onClick={closeSheet}
                className="flex-1 rounded-full bg-amber-500 py-2 text-sm font-medium text-white"
              >
                套用（{sorted.length} 道料理）
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 桌面版:常駐側欄,排序與篩選分成兩個獨立格子 */}
      <aside className="hidden lg:sticky lg:top-8 lg:block lg:w-72 lg:shrink-0 lg:self-start lg:space-y-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold">排序</h2>
          {sortSelect}
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">篩選</h2>
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-stone-500 underline underline-offset-2"
            >
              清除篩選
            </button>
          </div>

          {filterControls}

          <p className="mt-4 text-xs text-stone-500">符合條件：{sorted.length} 道料理</p>
        </div>
      </aside>
    </>
  );
}
