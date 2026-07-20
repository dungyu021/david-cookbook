---
description: 新增一道料理到網站（處理照片、撰寫 zh.md、build 驗證）
---

David 要新增一道料理到網站。他提供的資訊（可能不完整）：$ARGUMENTS

請依照以下流程處理：

1. **收集資訊**：需要菜名、slug（英文資料夾名，你可以代為發想）、日期（以「製作這道菜的日期」為準）、星等（1–5）、烹調時間（分鐘）、幾人份（servings）、食材清單、食譜步驟。缺少的資訊向 David 詢問；**食材份量缺少時由你合理估算**，完成後說明估算依據讓他確認。

2. **照片處理**（檢查 `src/content/dishes/{slug}/`）：
   - 用 `file` 指令確認格式；遇到 HEIC 要提醒轉檔
   - 一律用專案 node_modules 裡的 sharp 重新輸出以**清除 EXIF/GPS 隱私資訊**：`sharp(src).rotate().jpeg({ quality: 90 })`
   - 命名規則：封面 `cover.jpg`，其餘照片 `photo-2.jpg`、`photo-3.jpg`⋯（封面顯示在清單頁，其餘只在詳細頁 gallery）
   - **照片還沒放入時**：用 sharp 產生漸層佔位 `cover.jpg`，frontmatter 設 `draft: true`（不會上線）；照片到位後再清 GPS、覆蓋檔案、改回 `draft: false`

3. **撰寫 zh.md**：依 CLAUDE.md 的 frontmatter schema（所有欄位必填，缺欄位 build 會報錯）。慣例：
   - 食譜本文標題用「## 🍳 作法」（emoji 後有空格）
   - 若 David 有提供介紹文字，在「作法」之前加一段「## ✏️ 介紹」（格式相同）；沒有就不寫，不需要 schema 改動
   - 「番茄」不寫成「蕃茄」，全站統一用「番茄」
   - 中文一律全形標點（，。（）！：），唯 hashtag 的 # 維持半形
   - 依 `chinese-copywriting-guidelines.md`：中文與英文/數字之間加空格（例如「200 克」「3 瓣」）；`%`、`°` 前不加空格、後方接中文則要加空格；食材份量單位優先用中文（`g`→「克」、`mL`/`ml`→「毫升」）
   - 步驟盡量保留 David 的原文語氣（包括「出爐😋！」）
   - 步驟中有用到、但食材清單漏列的材料（鹽、油、胡椒等）要補進 `ingredients`

4. **驗證**：執行 `npm run build`，必須通過。若 build 異常變慢（超過 2 分鐘），先檢查 `sysctl vm.swapusage`——這台 8GB 的 Mac 記憶體不足時會拖垮 build，提醒 David 關閉 Chrome。

5. **收尾**：**不要自己 commit**。給 David commit & push 的指令（conventional commits 格式，例如 `feat: add porchetta dish`），由他自己執行。
