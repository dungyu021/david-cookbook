// 料理宇宙(3D 關係圖,見 universe-spec.md)的渲染元件。
// 用 client:only 掛載(見 universe/index.astro),Three.js 相關程式碼完全不會進到其他頁面的 bundle。
//
// Step 2:基本渲染(顏色、大小、透明度規則,可旋轉縮放)。
// Step 3:點擊高亮鄰居、鏡頭飛近、dish 小卡片與跳轉連結、名稱標籤(hover 桌面 / 點擊手機)。
import { useEffect, useRef, useState } from 'react';

interface GraphNode {
  id: string;
  type: 'dish' | 'attr';
  name: string;
  subtype?: 'tag' | 'ingredient';
  slug?: string;
  cover?: string;
  x?: number;
  y?: number;
  z?: number;
}

interface GraphLink {
  source: string;
  target: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const DISH_COLOR_RGB = '249, 115, 22'; // 橘色 f97316
const ATTR_COLOR_RGB = '158, 92, 247'; // 紫色
const DISH_SIZE = 10;
const ATTR_SIZE = 3;

// attr 節點的不透明度依連線數(degree)決定:先給一個區間,由 David 看實機效果調整
const ATTR_MIN_OPACITY = 0.35;
const ATTR_MAX_OPACITY = 1;
// 有節點被選中時,非高亮節點/連線變暗的程度
const DIM_OPACITY = 0.06;
const DIM_LINK_OPACITY = 0.03;

type SelectedDish = { name: string; slug: string; cover: string };

function isWebGLSupported() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function UniverseGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'unsupported' | 'error' | 'ready'>('loading');
  const [selectedDish, setSelectedDish] = useState<SelectedDish | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [cardVisible, setCardVisible] = useState(false);
  // 讓卡片的關閉按鈕(DOM)可以呼叫到掛載在 3D 場景 closure 裡的取消高亮邏輯
  const clearSelectionRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (selectedDish) {
      const id = requestAnimationFrame(() => setCardVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setCardVisible(false);
  }, [selectedDish]);

  useEffect(() => {
    if (!isWebGLSupported()) {
      setStatus('unsupported');
      return;
    }

    let destroyed = false;
    let graphInstance: { _destructor?: () => void } | null = null;

    (async () => {
      const [{ default: ForceGraph3D }, res] = await Promise.all([
        import('3d-force-graph'),
        fetch('/universe/graph.json'),
      ]);
      if (destroyed) return;
      if (!res.ok) throw new Error(`graph.json 讀取失敗:${res.status}`);
      const data: GraphData = await res.json();
      if (destroyed || !containerRef.current) return;

      // 依連線數計算每個 attr 節點的 degree,決定不透明度(連越多越明顯)
      const degree = new Map<string, number>();
      // 節點的鄰居 id、以及節點牽涉到的連線,給點擊高亮用
      const neighborsById = new Map<string, Set<string>>();
      const linksById = new Map<string, Set<GraphLink>>();
      for (const node of data.nodes) {
        neighborsById.set(node.id, new Set());
        linksById.set(node.id, new Set());
      }
      for (const link of data.links) {
        degree.set(link.source, (degree.get(link.source) ?? 0) + 1);
        degree.set(link.target, (degree.get(link.target) ?? 0) + 1);
        neighborsById.get(link.source)?.add(link.target);
        neighborsById.get(link.target)?.add(link.source);
        linksById.get(link.source)?.add(link);
        linksById.get(link.target)?.add(link);
      }
      const maxDegree = Math.max(1, ...data.nodes.map((n) => degree.get(n.id) ?? 0));

      // 目前高亮狀態(不用 React state,click 事件在 three.js 場景裡直接讀寫這幾個變數即可)
      let selectedId: string | null = null;
      let highlightNodeIds = new Set<string>();
      let highlightLinks = new Set<GraphLink>();

      const attrOpacity = (n: GraphNode) => {
        const d = degree.get(n.id) ?? 1;
        return ATTR_MIN_OPACITY + (ATTR_MAX_OPACITY - ATTR_MIN_OPACITY) * ((d - 1) / (maxDegree - 1 || 1));
      };

      const colorFor = (n: GraphNode) => {
        const rgb = n.type === 'dish' ? DISH_COLOR_RGB : ATTR_COLOR_RGB;
        let alpha: number;
        if (highlightNodeIds.size === 0) {
          alpha = n.type === 'dish' ? 1 : attrOpacity(n);
        } else if (highlightNodeIds.has(n.id)) {
          alpha = 1;
        } else {
          alpha = DIM_OPACITY;
        }
        return `rgba(${rgb}, ${alpha})`;
      };

      const linkColorFor = (l: GraphLink) => {
        if (highlightLinks.size === 0) return 'rgba(255, 255, 255, 0.45)';
        return highlightLinks.has(l) ? 'rgba(255, 255, 255, 0.9)' : `rgba(255, 255, 255, ${DIM_LINK_OPACITY})`;
      };

      const linkWidthFor = (l: GraphLink) => (highlightLinks.has(l) ? 2.2 : 1.4);

      const graph = new ForceGraph3D(containerRef.current)
        .graphData(data)
        .backgroundColor('#05060f')
        .nodeVal((n: GraphNode) => (n.type === 'dish' ? DISH_SIZE : ATTR_SIZE))
        .nodeColor(colorFor)
        .nodeLabel((n: GraphNode) => n.name)
        .linkColor(linkColorFor)
        .linkWidth(linkWidthFor)
        .showNavInfo(false)
        // 手機上單指觸碰節點預設會觸發拖曳(移動節點),很容易跟「單指旋轉鏡頭」的手勢打架,
        // 這個功能沒有實際用途,關掉後手機操作才會跟滑鼠一致、順手
        .enableNodeDrag(false);

      // 高 DPI 手機(devicePixelRatio 3 以上)全速渲染很吃 GPU,容易掉幀;上限抓 2 對畫質影響不大
      graph.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      // 重新指派同一個 accessor 是 3d-force-graph 官方建議的「強制重繪」寫法
      const refreshHighlight = () => {
        graph.nodeColor(colorFor).linkColor(linkColorFor).linkWidth(linkWidthFor);
      };

      // 鏡頭平滑飛近被點擊的節點(維持原本看向節點的方向,只是拉近距離)
      const flyTo = (node: GraphNode) => {
        const { x = 0, y = 0, z = 0 } = node;
        const dist = Math.hypot(x, y, z);
        const distRatio = dist > 0.01 ? 1 + 120 / dist : 1;
        graph.cameraPosition({ x: x * distRatio, y: y * distRatio, z: z * distRatio }, { x, y, z }, 1000);
      };

      const clearSelection = () => {
        selectedId = null;
        highlightNodeIds = new Set();
        highlightLinks = new Set();
        refreshHighlight();
        setSelectedDish(null);
        setSelectedLabel(null);
      };
      clearSelectionRef.current = clearSelection;

      graph.onNodeClick((node: GraphNode) => {
        if (selectedId === node.id) {
          clearSelection();
          return;
        }
        selectedId = node.id;
        highlightNodeIds = new Set([node.id, ...(neighborsById.get(node.id) ?? [])]);
        highlightLinks = linksById.get(node.id) ?? new Set();
        refreshHighlight();
        flyTo(node);

        if (node.type === 'dish') {
          setSelectedDish({ name: node.name, slug: node.slug!, cover: node.cover! });
          setSelectedLabel(null);
        } else {
          setSelectedLabel(node.name);
          setSelectedDish(null);
        }
      });

      graph.onBackgroundClick(() => clearSelection());

      graphInstance = graph;
      setStatus('ready');
    })().catch((err) => {
      console.error('[universe] 載入失敗', err);
      if (!destroyed) setStatus('error');
    });

    return () => {
      destroyed = true;
      graphInstance?._destructor?.();
    };
  }, []);

  return (
    // fixed 蓋滿全螢幕:蓋住 BaseLayout 共用的頁尾,3D 場景才不會被拉出額外的捲動空間
    <div className="fixed inset-0 z-40 bg-[#05060f]">
      <div ref={containerRef} className="h-full w-full" />

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-stone-400">
          載入料理宇宙中…
        </div>
      )}

      {status === 'unsupported' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center text-stone-300">
          <p className="text-sm">這個裝置的瀏覽器不支援 3D 顯示,暫時無法呈現料理宇宙。</p>
          <a href="/" className="rounded-full bg-amber-500 px-5 py-2 text-sm font-medium text-white">
            返回首頁
          </a>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center text-stone-300">
          <p className="text-sm">料理宇宙載入失敗,請稍後再試一次。</p>
          <a href="/" className="rounded-full bg-amber-500 px-5 py-2 text-sm font-medium text-white">
            返回首頁
          </a>
        </div>
      )}

      {/* 點擊紫色(標籤/食材)節點:只顯示名稱的小標籤 */}
      {selectedLabel && (
        <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center px-6">
          <div className="rounded-full bg-white/90 px-4 py-1.5 text-sm font-medium text-stone-800 shadow">
            {selectedLabel}
          </div>
        </div>
      )}

      {/* 點擊橘色(料理)節點:料理小卡片。手機從底部彈出,桌面貼右下角 */}
      {selectedDish && (
        <div className="fixed inset-x-0 bottom-0 z-50 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-80">
          <div
            className={`flex items-center gap-4 rounded-t-2xl bg-white p-4 shadow-xl transition-transform duration-400 ease-out lg:rounded-2xl ${
              cardVisible ? 'translate-y-0' : 'translate-y-full'
            }`}
          >
            <img
              src={selectedDish.cover}
              alt={selectedDish.name}
              className="h-16 w-16 shrink-0 rounded-xl object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-stone-900">{selectedDish.name}</p>
              <a
                href={`/dishes/${selectedDish.slug}/`}
                className="mt-1 inline-block text-sm text-amber-600 underline underline-offset-2"
              >
                查看這道菜 →
              </a>
            </div>
            <button
              type="button"
              onClick={() => clearSelectionRef.current()}
              aria-label="關閉"
              className="shrink-0 text-xl leading-none text-stone-400"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
