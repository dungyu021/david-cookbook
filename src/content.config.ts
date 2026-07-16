// 料理資料的格式定義(schema)
// 每道料理的 Markdown frontmatter 都會用這裡的規則驗證,
// 欄位缺漏或格式錯誤會在 build 時直接報錯,避免壞資料上線。
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const dishes = defineCollection({
  // 讀取 src/content/dishes/ 底下所有 Markdown 檔
  // 每道菜一個資料夾,例如 lemon-butter-pasta/zh.md → id 為 "lemon-butter-pasta/zh"
  loader: glob({ pattern: '**/*.md', base: './src/content/dishes' }),

  schema: ({ image }) =>
    z.object({
      /** 菜名 */
      title: z.string().min(1, '菜名不能空白'),
      /** 上架日期,用於「最新」排序 */
      date: z.coerce.date(),
      /** 星等 1–5,David 的個人推薦程度 */
      stars: z.number().int().min(1).max(5),
      /** 標籤,自由輸入,例如 [義式, 主菜] */
      tags: z.array(z.string()).default([]),
      /** 預估烹調時間(分鐘),用於時間範圍篩選 */
      cookingTimeMinutes: z.number().int().positive(),
      /** 清單頁封面照(相對路徑,例如 ./cover.jpg) */
      cover: image(),
      /** 其餘照片,詳細頁 gallery 用 */
      images: z.array(image()).default([]),
      /** 食材清單(含份量),用於包含/排除食材篩選 */
      ingredients: z.array(
        z.object({
          name: z.string(),
          amount: z.string(),
        }),
      ),
      /** true 時不會出現在網站上(草稿) */
      draft: z.boolean().default(false),
    }),
});

export const collections = { dishes };
