// 料理宇宙(3D 關係圖,見 universe-spec.md)的渲染元件。
// 用 client:only 掛載(見 universe/index.astro),Three.js 相關程式碼完全不會進到其他頁面的 bundle。
//
// Step 2 只做基本渲染:讀 /universe/graph.json、畫出節點與連線、顏色大小規則、可旋轉縮放。
// 點擊高亮、鏡頭飛行、料理卡片、hover 顯示名稱留到 Step 3。
import { useEffect, useRef, useState } from 'react';

interface GraphNode {
  id: string;
  type: 'dish' | 'attr';
  name: string;
  subtype?: 'tag' | 'ingredient';
  slug?: string;
  cover?: string;
}

interface GraphLink {
  source: string;
  target: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const DISH_COLOR = '#f97316'; // 橘色
const ATTR_COLOR = '158, 92, 247'; // 紫色(rgb 分量,透明度依連線數決定)
const DISH_SIZE = 10;
const ATTR_SIZE = 3;

// attr 節點的不透明度依連線數(degree)決定:先給一個區間,由 David 看實機效果調整
const ATTR_MIN_OPACITY = 0.35;
const ATTR_MAX_OPACITY = 1;

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
      for (const link of data.links) {
        degree.set(link.source, (degree.get(link.source) ?? 0) + 1);
        degree.set(link.target, (degree.get(link.target) ?? 0) + 1);
      }
      const maxDegree = Math.max(1, ...data.nodes.map((n) => degree.get(n.id) ?? 0));

      const graph = new ForceGraph3D(containerRef.current)
        .graphData(data)
        .backgroundColor('#05060f')
        .nodeVal((n: GraphNode) => (n.type === 'dish' ? DISH_SIZE : ATTR_SIZE))
        .nodeColor((n: GraphNode) => {
          if (n.type === 'dish') return DISH_COLOR;
          const d = degree.get(n.id) ?? 1;
          const opacity =
            ATTR_MIN_OPACITY + (ATTR_MAX_OPACITY - ATTR_MIN_OPACITY) * ((d - 1) / (maxDegree - 1 || 1));
          return `rgba(${ATTR_COLOR}, ${opacity})`;
        })
        .linkColor(() => 'rgba(255, 255, 255, 0.15)')
        .linkWidth(0.4)
        .showNavInfo(false);

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
    </div>
  );
}
