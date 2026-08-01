// 料理宇宙(3D 關係圖,見 universe-spec.md)專用的食材排除清單。
//
// 這些食材幾乎每道菜都會用到,列進圖裡只會變成擁擠、沒有辨識度的大節點,所以不產生節點。
// 大部分調味料已經在 ingredientCategories.ts 的 SEASONING_EXCLUDE 裡被排除了(例如「橄欖油」「醬油」),
// 這份清單只補「水」「鹽」「糖」「油」這類最基礎、單獨出現時不會被上面規則擋掉的食材。
// 名稱要用 normalizeIngredientName() 正規化後的寫法。David 之後想調整就直接改這個陣列。
export const GRAPH_EXCLUDE_INGREDIENTS = ['水', '鹽', '糖', '油'];

// 排除的標籤:這裡的標籤不會在圖裡產生節點,只影響料理宇宙的視覺呈現,
// 首頁的標籤篩選、料理卡片上的 hashtag 完全不受影響,標籤本身還是照常存在。
// 「義大利麵」跟同名的食材節點重複、多此一舉,只留食材那顆就好。
export const GRAPH_EXCLUDE_TAGS = ['義大利麵'];
