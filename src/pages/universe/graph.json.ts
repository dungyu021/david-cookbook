// 料理宇宙(3D 關係圖,見 universe-spec.md)的資料來源。
// build 時把所有已上架料理轉成節點(dish + 標籤/食材)與連線,輸出成靜態的 /universe/graph.json,
// 給之後 /universe/ 頁面的 3d-force-graph 讀取。
//
// 目前只做繁中版。en/it 版留到 Step 4「三語節點名稱」時,再依 universe-spec.md 的規則
// (以 zh 名稱為 canonical key,翻譯版仍用同一 key 對應)擴充,現在硬做沒有翻譯內容可以驗證。
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getImage } from 'astro:assets';
import { normalizeIngredientName } from '../../data/ingredientCategories';
import { GRAPH_EXCLUDE_INGREDIENTS } from '../../data/graphExclude';

type DishNode = {
  id: string;
  type: 'dish';
  name: string;
  slug: string;
  cover: string;
};

type AttrNode = {
  id: string;
  type: 'attr';
  subtype: 'tag' | 'ingredient';
  name: string;
};

type GraphNode = DishNode | AttrNode;

interface GraphLink {
  source: string;
  target: string;
}

export const GET: APIRoute = async () => {
  const dishes = await getCollection('dishes', (d) => d.id.endsWith('/zh') && !d.data.draft);

  // 用 Map 讓標籤/食材節點跨料理自動合併(同一個 key 只會有一個節點)
  const nodes = new Map<string, GraphNode>();
  const links: GraphLink[] = [];

  for (const dish of dishes) {
    const slug = dish.id.split('/')[0];
    const dishId = `dish:${slug}`;

    const cover = await getImage({ src: dish.data.cover, width: 160 });
    nodes.set(dishId, {
      id: dishId,
      type: 'dish',
      name: dish.data.title,
      slug,
      cover: cover.src,
    });

    for (const tag of dish.data.tags) {
      const tagId = `tag:${tag}`;
      if (!nodes.has(tagId)) {
        nodes.set(tagId, { id: tagId, type: 'attr', subtype: 'tag', name: tag });
      }
      links.push({ source: dishId, target: tagId });
    }

    for (const ingredient of dish.data.ingredients) {
      // 沿用食材篩選面板已有的正規化規則:調味料回傳 null(不產生節點),
      // 其餘食材統一寫法(例如「五花肉片」「豬絞肉」都合併成「豬肉」節點)
      const normalized = normalizeIngredientName(ingredient.name);
      if (!normalized || GRAPH_EXCLUDE_INGREDIENTS.includes(normalized)) continue;

      const ingredientId = `ingredient:${normalized}`;
      if (!nodes.has(ingredientId)) {
        nodes.set(ingredientId, {
          id: ingredientId,
          type: 'attr',
          subtype: 'ingredient',
          name: normalized,
        });
      }
      links.push({ source: dishId, target: ingredientId });
    }
  }

  const graph = { nodes: Array.from(nodes.values()), links };

  // Step 1 驗收用:build 時在終端機印出節點/連線數量,方便確認資料對不對
  const attrCount = graph.nodes.length - dishes.length;
  console.log(
    `[universe/graph.json] 節點 ${graph.nodes.length}(料理 ${dishes.length} + 標籤/食材 ${attrCount})、連線 ${graph.links.length}`,
  );

  return new Response(JSON.stringify(graph), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
