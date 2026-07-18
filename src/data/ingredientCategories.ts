// 食材篩選用的分類設定。
//
// David 新增料理時,若出現這份清單沒看過的新食材,Claude Code 要判斷:
// 1. 是不是調味料(油、鹽、香料粉、醬料包等)→ 加進 SEASONING_EXCLUDE,不會出現在篩選清單。
// 2. 是不是既有食材的另一種寫法(例如「五花肉片」其實就是「豬肉」)→ 加進 INGREDIENT_ALIASES。
// 3. 屬於哪個大類別 → 加進 INGREDIENT_CATEGORY(找不到對應大類別就自動歸類為「其他」,不用特別加)。

export const CATEGORY_LABELS = {
  protein: '蛋白質',
  vegetable: '蔬菜',
  dairy: '奶類',
  nuts: '堅果',
  gluten: '麩質',
  fruit: '水果',
  other: '其他',
} as const;

export type CategoryKey = keyof typeof CATEGORY_LABELS;

// 大類別顯示順序
export const CATEGORY_ORDER: CategoryKey[] = [
  'protein',
  'vegetable',
  'dairy',
  'nuts',
  'gluten',
  'fruit',
  'other',
];

// 調味料、香料、醬料包:不出現在食材篩選清單中(去括號後的名稱要完全相符)
const SEASONING_EXCLUDE = new Set([
  '食用油',
  '橄欖油',
  '鹽',
  '黑胡椒',
  '白胡椒',
  '砂糖',
  '醬油',
  '蠔油',
  '醋',
  '味醂',
  '米酒',
  '泡打粉',
  '辣椒粉',
  '紅辣椒粉',
  '煙燻紅椒粉',
  '肉桂粉',
  '肉桂棒',
  '月桂葉',
  '百里香',
  '迷迭香',
  '蔥花',
  '咖哩粉',
  '咖哩塊',
  '番茄醬',
  '第戎芥末醬',
]);

// 同義詞合併:原始食材名稱(去括號後)→ 篩選清單上顯示的統一名稱
const INGREDIENT_ALIASES: Record<string, string> = {
  五花肉片: '豬肉',
  帶皮豬五花肉: '豬肉',
  豬絞肉: '豬肉',
  牛絞肉: '牛肉',
  無骨雞腿排: '雞肉',
  雞腿排肉: '雞肉',
  全蛋液: '雞蛋',
  蛋黃液: '雞蛋',
  起司片: '起司',
  起司絲: '起司',
  大蒜: '蒜頭',
  無鹽奶油: '奶油',
  動物性鮮奶油: '鮮奶油',
  低筋麵粉: '麵粉',
  全脂牛奶: '牛奶',
};

// 統一名稱 → 所屬大類別(沒列在這裡的一律視為「其他」)
const INGREDIENT_CATEGORY: Record<string, CategoryKey> = {
  // 蛋白質
  豬肉: 'protein',
  牛肉: 'protein',
  雞肉: 'protein',
  雞蛋: 'protein',
  培根: 'protein',
  // 蔬菜(菇類也算蔬菜)
  洋蔥: 'vegetable',
  紅蘿蔔: 'vegetable',
  櫛瓜: 'vegetable',
  青江菜: 'vegetable',
  蒜頭: 'vegetable',
  牛番茄: 'vegetable',
  馬鈴薯: 'vegetable',
  蘑菇: 'vegetable',
  香菇: 'vegetable',
  // 奶類
  奶油: 'dairy',
  鮮奶油: 'dairy',
  牛奶: 'dairy',
  起司: 'dairy',
  希臘式優格: 'dairy',
  // 堅果
  堅果: 'nuts',
  // 麩質
  麵粉: 'gluten',
  白吐司: 'gluten',
  麵包粉: 'gluten',
  // 水果
  富士蘋果: 'fruit',
  橘子: 'fruit',
  檸檬: 'fruit',
  甜橙: 'fruit',
};

function stripParens(raw: string): string {
  return raw.replace(/[(（][^)）]*[)）]/g, '').trim();
}

// 把食材原始名稱正規化成篩選用名稱;調味料回傳 null(代表不列入篩選)
export function normalizeIngredientName(raw: string): string | null {
  const stripped = stripParens(raw);
  if (!stripped || SEASONING_EXCLUDE.has(stripped)) return null;
  return INGREDIENT_ALIASES[stripped] ?? stripped;
}

export function categoryOf(name: string): CategoryKey {
  return INGREDIENT_CATEGORY[name] ?? 'other';
}
