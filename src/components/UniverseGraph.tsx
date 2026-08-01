// 料理宇宙(3D 關係圖,見 universe-spec.md)的渲染元件。
// 用 client:only 掛載(見 universe/index.astro),Three.js 相關程式碼完全不會進到其他頁面的 bundle。
//
// Step 2:基本渲染(顏色、大小、透明度規則,可旋轉縮放)。
// Step 3:點擊高亮鄰居、鏡頭飛近、dish 小卡片與跳轉連結、名稱標籤(hover 桌面 / 點擊手機)。
// Step 3.5:部分食材節點換成 3D 模型(public/models/,對照表見 data/ingredientModels.ts),
//          其餘食材與所有標籤維持原本的紫色小球。
import { useEffect, useRef, useState } from 'react';
import type { Object3D } from 'three';
import { INGREDIENT_MODELS } from '../data/ingredientModels';

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
// 有節點被選中時,非高亮節點/連線只保留原本亮度的這個比例(0.3 = 變暗 70%)
const DIM_FACTOR = 0.3;
const LINK_BASE_OPACITY = 0.45;

// 3D 模型自動正規化後的目標最大邊長,對齊 attr 紫色球體的視覺大小(約 11.5,見下方 ATTR_SIZE 換算)
const MODEL_TARGET_SIZE = 12;

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
  // 目前選取的節點可以有多個(見下方 onNodeClick 的多選邏輯),dish/attr 分開存放給不同 UI 用
  const [selectedDishes, setSelectedDishes] = useState<SelectedDish[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [cardVisible, setCardVisible] = useState(false);
  const hasSelection = selectedDishes.length > 0 || selectedLabels.length > 0;
  // 讓 DOM 上的按鈕(關閉、迷路重置視角)可以呼叫到掛載在 3D 場景 closure 裡的邏輯
  const clearSelectionRef = useRef<() => void>(() => {});
  const resetViewRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (selectedDishes.length > 0) {
      const id = requestAnimationFrame(() => setCardVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setCardVisible(false);
  }, [selectedDishes.length]);

  useEffect(() => {
    if (!isWebGLSupported()) {
      setStatus('unsupported');
      return;
    }

    let destroyed = false;
    let graphInstance: { _destructor?: () => void } | null = null;

    (async () => {
      const [{ default: ForceGraph3D }, { GLTFLoader }, THREE, res] = await Promise.all([
        import('3d-force-graph'),
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three'),
        fetch('/universe/graph.json'),
      ]);
      if (destroyed) return;
      if (!res.ok) throw new Error(`graph.json 讀取失敗:${res.status}`);
      const data: GraphData = await res.json();
      if (destroyed || !containerRef.current) return;

      // 預先載入食材 3D 模型,並自動正規化尺寸(依模型實際包圍盒縮放到同一個目標大小,
      // 不用替每個模型手動調參數)、置中(避免模型本身的建模原點偏移,節點位置看起來會飄)。
      // nodeThreeObject 的 accessor 必須同步回傳,所以模型要在建圖之前就載入完成。
      const loader = new GLTFLoader();
      const modelTemplates = new Map<string, Object3D>();
      const uniqueModelFiles = Array.from(new Set(Object.values(INGREDIENT_MODELS)));
      await Promise.all(
        uniqueModelFiles.map(async (file) => {
          const gltf = await loader.loadAsync(`/models/${file}`);
          const scene = gltf.scene;
          const box = new THREE.Box3().setFromObject(scene);
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const scale = MODEL_TARGET_SIZE / maxDim;
          scene.scale.setScalar(scale);
          const center = new THREE.Vector3();
          box.getCenter(center).multiplyScalar(scale);
          scene.position.sub(center);
          modelTemplates.set(file, scene);
        }),
      );
      if (destroyed || !containerRef.current) return;

      // 依連線數計算每個 attr 節點的 degree,決定不透明度(連越多越明顯)
      const degree = new Map<string, number>();
      // 節點的鄰居 id、以及節點牽涉到的連線,給點擊高亮用
      const neighborsById = new Map<string, Set<string>>();
      const linksById = new Map<string, Set<GraphLink>>();
      const nodesById = new Map<string, GraphNode>();
      for (const node of data.nodes) {
        neighborsById.set(node.id, new Set());
        linksById.set(node.id, new Set());
        nodesById.set(node.id, node);
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

      // 目前高亮狀態(不用 React state,click 事件在 three.js 場景裡直接讀寫這幾個變數即可)。
      // selectedSeeds 是使用者實際點過的節點(可以有多個);highlightNodeIds/highlightLinks
      // 是所有 seed 的鄰居/連線聯集,每次 seed 變動就整個重算一次。
      const selectedSeeds = new Set<string>();
      let highlightNodeIds = new Set<string>();
      let highlightLinks = new Set<GraphLink>();

      const recomputeHighlight = () => {
        const nodes = new Set<string>();
        const links = new Set<GraphLink>();
        selectedSeeds.forEach((id) => {
          nodes.add(id);
          neighborsById.get(id)?.forEach((nb) => nodes.add(nb));
          linksById.get(id)?.forEach((l) => links.add(l));
        });
        highlightNodeIds = nodes;
        highlightLinks = links;
      };

      // 把目前的 seed 節點資料同步到 React state,驅動關閉按鈕/標籤/卡片 UI
      const syncSelectionUI = () => {
        const dishes: SelectedDish[] = [];
        const labels: string[] = [];
        selectedSeeds.forEach((id) => {
          const n = nodesById.get(id);
          if (!n) return;
          if (n.type === 'dish') dishes.push({ name: n.name, slug: n.slug!, cover: n.cover! });
          else labels.push(n.name);
        });
        setSelectedDishes(dishes);
        setSelectedLabels(labels);
      };

      const attrOpacity = (n: GraphNode) => {
        const d = degree.get(n.id) ?? 1;
        return ATTR_MIN_OPACITY + (ATTR_MAX_OPACITY - ATTR_MIN_OPACITY) * ((d - 1) / (maxDegree - 1 || 1));
      };

      const colorFor = (n: GraphNode) => {
        const rgb = n.type === 'dish' ? DISH_COLOR_RGB : ATTR_COLOR_RGB;
        const base = n.type === 'dish' ? 1 : attrOpacity(n);
        let alpha: number;
        if (highlightNodeIds.size === 0) {
          alpha = base;
        } else if (highlightNodeIds.has(n.id)) {
          alpha = 1;
        } else {
          alpha = base * DIM_FACTOR;
        }
        return `rgba(${rgb}, ${alpha})`;
      };

      const linkColorFor = (l: GraphLink) => {
        if (highlightLinks.size === 0) return `rgba(255, 255, 255, ${LINK_BASE_OPACITY})`;
        return highlightLinks.has(l)
          ? 'rgba(255, 255, 255, 0.9)'
          : `rgba(255, 255, 255, ${LINK_BASE_OPACITY * DIM_FACTOR})`;
      };

      const linkWidthFor = (l: GraphLink) => (highlightLinks.has(l) ? 2.2 : 1.4);

      // 3D 模型節點是「自訂物件」,不會被 nodeColor 套用(那只影響預設的球體),
      // 所以高亮/變暗要自己控制材質透明度,這裡記住每個模型節點的實體給 applyModelOpacity 用
      const modelNodeObjects = new Map<string, Object3D>();

      function cloneModel(template: Object3D): Object3D {
        const clone = template.clone(true);
        clone.traverse((obj) => {
          const mesh = obj as unknown as { isMesh?: boolean; material?: any };
          if (!mesh.isMesh || !mesh.material) return;
          // 每個節點要能各自控制透明度(高亮/變暗),材質不能跟其他節點共用同一份
          const cloneMat = (m: any) => {
            const c = m.clone();
            c.transparent = true;
            return c;
          };
          mesh.material = Array.isArray(mesh.material) ? mesh.material.map(cloneMat) : cloneMat(mesh.material);
        });
        return clone;
      }

      const threeObjectFor = (n: GraphNode) => {
        // 標籤(tag)剛好跟某個食材同名時(例如「義大利麵」既是食材也是分類標籤)
        // 也套用同一顆模型,不只限於食材節點,畫面上才不會出現「同名字卻長得不一樣」的兩顆球
        if (n.type !== 'attr') return undefined;
        const file = INGREDIENT_MODELS[n.name];
        const template = file && modelTemplates.get(file);
        if (!template) return undefined;

        const instance = cloneModel(template);
        modelNodeObjects.set(n.id, instance);
        const group = new THREE.Group();
        group.add(instance);
        return group;
      };

      const applyModelOpacity = () => {
        modelNodeObjects.forEach((obj, id) => {
          const alpha = highlightNodeIds.size === 0 || highlightNodeIds.has(id) ? 1 : DIM_FACTOR;
          obj.traverse((child) => {
            const mesh = child as unknown as { isMesh?: boolean; material?: unknown };
            if (mesh.isMesh && mesh.material) {
              const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              materials.forEach((m: any) => {
                m.opacity = alpha;
              });
            }
          });
        });
      };

      const graph = new ForceGraph3D(containerRef.current)
        .graphData(data)
        .backgroundColor('#05060f')
        .nodeVal((n: GraphNode) => (n.type === 'dish' ? DISH_SIZE : ATTR_SIZE))
        .nodeColor(colorFor)
        .nodeThreeObject(threeObjectFor)
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
      // (3D 模型節點不吃這招,另外呼叫 applyModelOpacity 直接改材質透明度)
      const refreshHighlight = () => {
        graph.nodeColor(colorFor).linkColor(linkColorFor).linkWidth(linkWidthFor);
        applyModelOpacity();
      };

      // 鏡頭平滑飛近被點擊的節點(維持原本看向節點的方向,只是拉近距離)
      const flyTo = (node: GraphNode) => {
        const { x = 0, y = 0, z = 0 } = node;
        const dist = Math.hypot(x, y, z);
        const distRatio = dist > 0.01 ? 1 + 120 / dist : 1;
        graph.cameraPosition({ x: x * distRatio, y: y * distRatio, z: z * distRatio }, { x, y, z }, 1000);
      };

      const clearSelection = () => {
        selectedSeeds.clear();
        highlightNodeIds = new Set();
        highlightLinks = new Set();
        refreshHighlight();
        syncSelectionUI();
      };
      clearSelectionRef.current = clearSelection;
      resetViewRef.current = () => graph.zoomToFit(800, 60);

      graph.onNodeClick((node: GraphNode) => {
        // 再點一次已選的節點 = 只取消那一個 seed(其他還留著);
        // 點新節點 = 加進去,可以同時多選,擴展出去或比較不同群集之間的連結
        const wasSelected = selectedSeeds.has(node.id);
        if (wasSelected) {
          selectedSeeds.delete(node.id);
        } else {
          selectedSeeds.add(node.id);
        }
        recomputeHighlight();
        refreshHighlight();
        syncSelectionUI();
        // 取消選取時鏡頭不用動,只有新加入選取才飛過去
        if (!wasSelected) flyTo(node);
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
    // select-none + webkit-touch-callout:none:手機長按容易誤觸文字反白、跳出「複製/剪下」選單,
    // 這個畫面沒有需要選取的文字,直接整頁禁用
    <div className="fixed inset-0 z-40 select-none bg-[#05060f] [-webkit-touch-callout:none]">
      <div ref={containerRef} className="h-full w-full" />

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-stone-400">
          領域展開中…
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

      {/* 有節點被選取時:左上角半透明關閉鈕,點下或點畫面空白處都會清空所有選取 */}
      {hasSelection && (
        <button
          type="button"
          onClick={() => clearSelectionRef.current()}
          aria-label="關閉"
          className="fixed left-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-lg text-white backdrop-blur-sm"
        >
          ✕
        </button>
      )}

      {/* 點擊紫色(標籤/食材)節點:顯示名稱小標籤,可以同時選好幾個節點 */}
      {selectedLabels.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-4 flex flex-wrap justify-center gap-2 px-16">
          {selectedLabels.map((label) => (
            <div
              key={label}
              className="rounded-full bg-white/90 px-4 py-1.5 text-sm font-medium text-stone-800 shadow"
            >
              {label}
            </div>
          ))}
        </div>
      )}

      {/* 點擊橘色(料理)節點:料理小卡片,可以同時選好幾道菜。手機從底部彈出、可上下滑動,桌面貼右下角 */}
      {selectedDishes.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-80">
          <div
            // 卡片高 h-16(4rem)+ 間距 space-y-3(0.75rem)+ 上方 padding(1rem),
            // 算出剛好露出「第 3(手機)/第 5(桌面)張卡片一半」的高度,提示使用者還能往下滑
            className={`max-h-[12.5rem] space-y-3 overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl transition-transform duration-400 ease-out lg:max-h-[22rem] lg:rounded-2xl ${
              cardVisible ? 'translate-y-0' : 'translate-y-full'
            }`}
          >
            {selectedDishes.map((dish) => (
              <div key={dish.slug} className="flex items-center gap-4">
                <img
                  src={dish.cover}
                  alt={dish.name}
                  className="h-16 w-16 shrink-0 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-stone-900">{dish.name}</p>
                  <a
                    href={`/dishes/${dish.slug}/`}
                    className="mt-1 inline-block text-sm text-amber-600 underline underline-offset-2"
                  >
                    查看這道菜 →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 沒有選取任何節點時:畫面下方半透明的「迷路了」按鈕,點下去鏡頭回到看得到完整關係網的視角 */}
      {status === 'ready' && !hasSelection && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center">
          <button
            type="button"
            onClick={() => resetViewRef.current()}
            className="pointer-events-auto rounded-full bg-amber-400/30 px-4 py-2 text-sm text-white backdrop-blur-sm"
          >
            迷路了？點擊這裡
          </button>
        </div>
      )}
    </div>
  );
}
