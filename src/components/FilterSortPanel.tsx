// 首頁的篩選與排序面板(React island)
// 不負責渲染料理卡片本身(卡片仍由 Astro 的 DishCard 產生,才能吃到 astro:assets 的圖片最佳化)。
// 這裡只讀取 build 時產生的輕量索引,在瀏覽器端計算篩選/排序結果,
// 再直接操作 #dish-grid 底下的 DOM(依 data-slug 顯示/隱藏、重新排序)。
//
// 響應式布局:手機是底部彈出的 bottom sheet(lg:hidden),
// 桌面是常駐側欄(hidden lg:block)。兩者共用同一份 state,
// 篩選控制項的 JSX(filterControls)在兩邊各渲染一份,操作任一邊都會同步。
import { useEffect, useMemo, useState } from 'react';

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

type SortKey = 'date-desc' | 'date-asc' | 'stars-desc';

function readParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    tags: params.get('tags')?.split(',').filter(Boolean) ?? [],
    include: params.get('include') ?? '',
    exclude: params.get('exclude') ?? '',
    min: params.get('min'),
    max: params.get('max'),
    sort: (params.get('sort') as SortKey) || 'date-desc',
  };
}

function cookingTimeText(minutes: number) {
  return minutes >= 60 ? `${Math.round((minutes / 60) * 10) / 10}小時` : `${minutes}分鐘`;
}

export default function FilterSortPanel({ dishes }: Props) {
  const allTags = useMemo(() => Array.from(new Set(dishes.flatMap((d) => d.tags))).sort(), [dishes]);
  const allIngredients = useMemo(
    () => Array.from(new Set(dishes.flatMap((d) => d.ingredients))).sort(),
    [dishes],
  );
  const timeBounds = useMemo(() => {
    const times = dishes.map((d) => d.cookingTimeMinutes);
    return { min: Math.min(...times), max: Math.max(...times) };
  }, [dishes]);

  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [includeIngredient, setIncludeIngredient] = useState('');
  const [excludeIngredient, setExcludeIngredient] = useState('');
  const [timeRange, setTimeRange] = useState<[number, number]>([timeBounds.min, timeBounds.max]);
  const [sort, setSort] = useState<SortKey>('date-desc');

  // 初始化時讀取網址上的篩選條件(方便分享篩選結果連結)
  useEffect(() => {
    const p = readParams();
    setSelectedTags(p.tags);
    setIncludeIngredient(p.include);
    setExcludeIngredient(p.exclude);
    setTimeRange([
      p.min !== null ? Number(p.min) : timeBounds.min,
      p.max !== null ? Number(p.max) : timeBounds.max,
    ]);
    setSort(p.sort);
    setReady(true);
    // 只在掛載時讀取一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () =>
      dishes.filter((d) => {
        if (selectedTags.length > 0 && !selectedTags.every((t) => d.tags.includes(t))) return false;
        if (includeIngredient && !d.ingredients.includes(includeIngredient)) return false;
        if (excludeIngredient && d.ingredients.includes(excludeIngredient)) return false;
        if (d.cookingTimeMinutes < timeRange[0] || d.cookingTimeMinutes > timeRange[1]) return false;
        return true;
      }),
    [dishes, selectedTags, includeIngredient, excludeIngredient, timeRange],
  );

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sort === 'date-asc') return a.date - b.date;
      if (sort === 'stars-desc') return b.stars - a.stars || b.date - a.date;
      return b.date - a.date;
    });
    return copy;
  }, [filtered, sort]);

  // 篩選/排序條件變動時:同步網址 query string,並直接操作卡片 DOM
  useEffect(() => {
    if (!ready) return;

    const params = new URLSearchParams();
    if (selectedTags.length) params.set('tags', selectedTags.join(','));
    if (includeIngredient) params.set('include', includeIngredient);
    if (excludeIngredient) params.set('exclude', excludeIngredient);
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
  }, [ready, sorted, selectedTags, includeIngredient, excludeIngredient, timeRange, sort, timeBounds]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const resetFilters = () => {
    setSelectedTags([]);
    setIncludeIngredient('');
    setExcludeIngredient('');
    setTimeRange([timeBounds.min, timeBounds.max]);
  };

  const activeCount =
    selectedTags.length + (includeIngredient ? 1 : 0) + (excludeIngredient ? 1 : 0);

  const sortSelect = (
    <select
      value={sort}
      onChange={(e) => setSort(e.target.value as SortKey)}
      className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 shadow-sm"
    >
      <option value="date-desc">上架時間：新到舊</option>
      <option value="date-asc">上架時間：舊到新</option>
      <option value="stars-desc">星等：高到低</option>
    </select>
  );

  const filterControls = (
    <>
      <section className="mb-5">
        <h3 className="mb-2 text-sm font-medium text-stone-700">標籤</h3>
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`rounded-full px-3 py-1 text-xs transition ${
                selectedTags.includes(tag) ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-600'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-5">
        <h3 className="mb-2 text-sm font-medium text-stone-700">包含食材</h3>
        <select
          value={includeIngredient}
          onChange={(e) => setIncludeIngredient(e.target.value)}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        >
          <option value="">不限</option>
          {allIngredients.map((ing) => (
            <option key={ing} value={ing}>
              {ing}
            </option>
          ))}
        </select>
      </section>

      <section className="mb-5">
        <h3 className="mb-2 text-sm font-medium text-stone-700">排除食材</h3>
        <select
          value={excludeIngredient}
          onChange={(e) => setExcludeIngredient(e.target.value)}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        >
          <option value="">不限</option>
          {allIngredients.map((ing) => (
            <option key={ing} value={ing}>
              {ing}
            </option>
          ))}
        </select>
      </section>

      <section className="mb-2">
        <h3 className="mb-2 text-sm font-medium text-stone-700">
          烹調時間：{cookingTimeText(timeRange[0])} – {cookingTimeText(timeRange[1])}
        </h3>
        <div className="space-y-2">
          <input
            type="range"
            min={timeBounds.min}
            max={timeBounds.max}
            value={timeRange[0]}
            onChange={(e) => setTimeRange([Math.min(Number(e.target.value), timeRange[1]), timeRange[1]])}
            className="w-full accent-amber-500"
          />
          <input
            type="range"
            min={timeBounds.min}
            max={timeBounds.max}
            value={timeRange[1]}
            onChange={(e) => setTimeRange([timeRange[0], Math.max(Number(e.target.value), timeRange[0])])}
            className="w-full accent-amber-500"
          />
        </div>
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
            onClick={() => setOpen(true)}
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
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative z-10 max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">篩選條件</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
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
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full bg-amber-500 py-2 text-sm font-medium text-white"
              >
                套用（{sorted.length} 道料理）
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 桌面版:常駐側欄 */}
      <aside className="hidden lg:sticky lg:top-8 lg:block lg:w-72 lg:shrink-0 lg:self-start">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">篩選與排序</h2>
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-stone-500 underline underline-offset-2"
            >
              清除篩選
            </button>
          </div>

          <section className="mb-5">
            <h3 className="mb-2 text-sm font-medium text-stone-700">排序</h3>
            {sortSelect}
          </section>

          {filterControls}

          <p className="mt-4 text-xs text-stone-500">符合條件：{sorted.length} 道料理</p>
        </div>
      </aside>
    </>
  );
}
