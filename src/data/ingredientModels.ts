// 料理宇宙(3D 關係圖)食材節點的 3D 模型對照表。
//
// key 是食材節點名稱,要跟 graph.json 裡食材節點的 name 完全一致
// (也就是 normalizeIngredientName() 正規化後的寫法,可以對照 ingredientCategories.ts)。
// value 是 public/models/ 底下的檔名。找不到對應模型的食材維持原本的紫色小球,不影響其他功能。
//
// 目前資料裡沒有單純叫「番茄」的節點(只有「牛番茄」「番茄罐頭」「番茄膏」各自獨立),
// David 說「番茄罐頭、番茄都算」,這裡把「牛番茄」視為他說的「番茄」對應到同一顆模型;
// 「番茄膏」是加工過的醬狀食材,外觀差太多,先不套用。
export const INGREDIENT_MODELS: Record<string, string> = {
  檸檬: 'lemon-half.glb',
  雞蛋: 'egg.glb',
  洋蔥: 'onion-half.glb',
  豬肉: 'meat-raw.glb',
  牛肉: 'meat-raw.glb',
  牛番茄: 'tomato.glb',
  番茄罐頭: 'tomato.glb',
};
