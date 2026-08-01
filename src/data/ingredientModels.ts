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
  牛肉: 'steak.glb', // 換成牛排造型,才能跟豬肉的生肉模型視覺區分開
  牛番茄: 'tomato.glb',
  番茄罐頭: 'tomato.glb',
  培根: 'bacon-raw.glb',
  起司: 'cheese.glb',
  紅蘿蔔: 'carrot.glb',
  蘑菇: 'mushroom-sliced.glb',
  香菇: 'mushroom-sliced.glb', // 套件沒有分香菇/蘑菇,共用同一顆模型
  橘子: 'orange.glb',
  甜橙: 'orange.glb', // 柑橘類共用同一顆模型
  蘋果: 'apple.glb', // 富士蘋果、青蘋果已在 ingredientCategories.ts 合併為「蘋果」
  紅酒: 'wine-red.glb',
  白酒: 'wine-white.glb',
  蜂蜜: 'honey.glb',
  鮮奶油: 'whipped-cream.glb', // 套件沒有「未打發鮮奶油」,用這個最接近
  白吐司: 'bread-slice.glb', // 吐司本來就是切片的,比一整條麵包更準確
  牛奶: 'carton.glb', // 用牛奶紙盒代表
  黑巧克力: 'chocolate.glb',
  濃縮咖啡: 'cup-coffee.glb', // 用一杯咖啡代表,不是生豆
  雞肉: 'chicken-leg.glb',
  蒜頭: 'garlic.glb',
  堅果: 'nut.glb',
  奶油: 'butter.glb',
  巴西里: 'rosemary.glb', // David 找不到巴西里模型,先用迷迭香代替
  義大利麵: 'spaghetti.glb',
  'Carnaroli 燉飯米': 'rice.glb', // 跟白米共用同一顆飯碗模型
  白米: 'rice.glb',
  麵粉: 'flour.glb',
  櫛瓜: 'cucumber.glb',
  小黃瓜: 'cucumber.glb', // 目前還沒有料理用到,先接好等以後用
  番茄膏: 'ketchup.glb',
};
