# CLAUDE.md — David's Cooking Portfolio(線上料理菜單網站)

## 專案概述

這是 David 的個人料理展示網站,用來呈現他做過的所有料理,讓朋友了解他擅長的菜色。純靜態網站、零維護成本、手機優先(mobile-first)。

- **內容管理方式**:所有料理以 Markdown 檔案存放在 repo 中。「後台」就是 VS Code + Claude Code——新增料理 = 新增檔案 + push。
- **規模**:初期 20–30 道料理,上限約 100 道。所有篩選、排序皆可在瀏覽器端完成。
- **語言**:繁體中文為主要語言,另提供英文、義大利文版本(由 Claude Code 協助翻譯)。
- **維護者背景**:David 是 MIS 學生但不打算深入學 coding,所有程式碼由 Claude Code 撰寫與維護。**因此:程式碼要清晰、註解充足、避免過度工程化;解釋事情時用白話。**

## 技術棧(已決策,勿更換)

| 項目 | 選擇 | 理由 |
|---|---|---|
| 框架 | **Astro**(最新穩定版) | 靜態內容網站的業界主流,預設零 JS,手機載入極快;Markdown content collections 對檔案式內容管理最友善 |
| 互動元件 | **React**(Astro islands) | 篩選/排序面板、密碼解鎖等互動功能;業界最主流 |
| 樣式 | **Tailwind CSS** | 主流、好維護、適合 mobile-first |
| 內容 | Markdown + Astro **Content Collections**(含 zod schema 驗證) | 型別安全,寫錯 frontmatter 會在 build 時報錯 |
| 圖片 | **astro:assets** 內建圖片最佳化 | 自動產生 WebP/AVIF 與多尺寸 responsive images |
| 部署 | **Cloudflare Pages**(免費方案) | 連接 GitHub repo,push 即自動部署;免費子網域 `*.pages.dev`,未來可隨時掛自訂網域 |
| 版本控制 | Git + GitHub | — |

**明確不使用**:任何線上資料庫(含免費方案)、任何需要伺服器的後端、任何付費服務。

## 資料模型

每道料理一個資料夾,放在 `src/content/dishes/{slug}/`,內含各語言的 Markdown 檔與照片:

```
src/content/dishes/
  lemon-butter-pasta/
    zh.md        ← David 手寫(唯一的真實來源 source of truth)
    en.md        ← Claude Code 從 zh.md 翻譯產生
    it.md        ← Claude Code 從 zh.md 翻譯產生
    cover.jpg    ← 清單頁封面照(每道菜 2–3 張照片,iPhone 拍攝,原檔約 3MB)
    photo-2.jpg
    photo-3.jpg
```

### Frontmatter schema(zh.md 範例)

```yaml
---
title: 檸檬奶油白酒義大利麵
date: 2026-07-15          # 上架日期,用於「最新」排序
stars: 5                  # 1–5,David 的個人喜好/推薦程度
tags: [義式, 主菜, 義大利麵]   # 多重標籤,自由輸入
cookingTimeMinutes: 30    # 預估烹調時間,用於時間範圍篩選
cover: ./cover.jpg
images: [./photo-2.jpg, ./photo-3.jpg]
ingredients:              # 完整食材清單(含份量),用於「包含/排除食材」篩選
  - name: 義大利麵
    amount: 200g
  - name: 檸檬
    amount: 1 顆
  - name: 洋蔥
    amount: 半顆
draft: false              # true 時不會出現在網站上
---

(Markdown 本文 = 完整食譜步驟。此區塊為「上鎖內容」,見下方密碼保護章節)
```

**規則:**
- `zh.md` 是唯一由 David 手動維護的檔案。`en.md`、`it.md` 由翻譯指令產生,結構相同,slug 與照片共用。
- 翻譯檔的 frontmatter 中,`title`、`tags`、`ingredients[].name`、`ingredients[].amount` 需翻譯;數值與日期不變。
- 完整食譜(Markdown 本文)**目前僅維護繁體中文**;en/it 版本的本文可先留空或放一行說明「Recipe available in Chinese」。未來可能擴充為三語。
- 使用 zod schema 嚴格驗證所有欄位,缺欄位或格式錯誤要在 build 時清楚報錯。

## 頁面結構與路由

```
/            → 繁中料理清單(首頁)
/en/         → 英文清單
/it/         → 義文清單
/dishes/{slug}/       → 繁中料理詳細頁
/en/dishes/{slug}/    → 英文詳細頁
/it/dishes/{slug}/    → 義文詳細頁
```

- 使用 Astro 內建 i18n routing,繁中為 default locale(不帶前綴)。
- 每頁提供語言切換器(切換時停留在同一道菜)。
- `hreflang` 與 canonical 標籤要正確。

### 清單頁(首頁)

每道料理以卡片呈現:**封面照、菜名、星等(視覺化五顆星)、hashtag 標籤**。

- 預設排序:最新在前(依 `date`)。
- 使用者可切換排序:上架時間(新→舊 / 舊→新)、星等(高→低)。
- 篩選面板(手機上為底部彈出式 bottom sheet,桌面為側欄或頂列):
  1. **標籤分類**:多選(chip 形式)
  2. **包含某食材**:輸入或選擇食材,只顯示含該食材的料理
  3. **排除某食材**:例如排除「洋蔥」
  4. **烹調時間範圍**:雙向拉桿(range slider,類似訂房網站的價格篩選),**拉動時即時顯示「符合條件:N 道料理」**
- 篩選與排序全部在瀏覽器端執行:build 時為每個語言產生一份輕量 JSON 索引(title、slug、stars、tags、cookingTimeMinutes、ingredients 名稱、封面圖路徑),React island 讀取此索引運算。100 道菜的資料量極小,不需要任何後端。
- 篩選狀態同步到 URL query string(方便分享「所有義式甜點」這種連結)。

### 詳細頁

由上而下:
1. 照片(第一張大圖 + 其餘照片,手機上可左右滑動的 gallery)
2. 菜名、星等、hashtags
3. 預估烹調時間
4. 食材清單(含份量)
5. 最下方:**「查看完整食譜」按鈕** → 觸發密碼輸入(見下節)

## 食譜密碼保護

需求:全站共用一組 4 位數字密碼;**每次查看任一食譜、或重新整理頁面,都需重新輸入**(不做任何記憶/localStorage/sessionStorage 儲存);安全等級要求低,「被破解也沒關係」,但**食譜內容不可以明文出現在頁面原始碼中**。

實作方式(build-time 加密,client-side 解密):

1. 密碼存放於環境變數(本機 `.env`,Cloudflare Pages 專案設定中設同一變數)。**絕不 commit 進 repo。**
2. Build 時:將每道菜的食譜本文渲染成 HTML 後,以 Web Crypto 相容的 **AES-GCM** 加密(金鑰由密碼經 PBKDF2 衍生),密文與 salt/iv 隨頁面輸出。
3. Client 端:使用者點「查看完整食譜」→ 彈出 4 位數字輸入框(手機上自動叫出數字鍵盤 `inputmode="numeric"`)→ 用 Web Crypto API 解密 → 成功則就地顯示食譜,失敗則顯示「密碼錯誤」。
4. 不儲存密碼、不設 cookie——符合「每次都要重新輸入」的需求。
5. 在程式註解中誠實註明:4 位數字密碼可被暴力破解,此機制僅為「防君子」,符合專案需求。

## 圖片處理原則

- David 會直接把 iPhone 照片(約 3MB)丟進料理資料夾。**若遇到 HEIC 檔,提醒 David 轉成 JPG**(或協助用工具轉檔),Astro 不吃 HEIC。
- 一律透過 `astro:assets` 的 `<Image />` / `<Picture />` 輸出:自動壓縮、產生 WebP/AVIF、多尺寸 srcset、lazy loading。
- 清單頁縮圖目標 < 100KB,詳細頁大圖目標 < 400KB。
- 所有圖片必須設定 `width`/`height` 避免版面跳動(CLS)。

## 設計原則

- **Mobile-first 是最高優先**:先設計手機版,再擴展到桌面。所有互動(篩選面板、照片滑動、密碼輸入)都以單手拇指操作為前提。
- 視覺風格:乾淨、以照片為主角,像精緻的餐廳菜單/美食作品集。留白多、字型清晰。
- 繁中字型建議使用系統字型堆疊或 Noto Sans TC(注意字型檔大小,可 subset)。
- 效能目標:Lighthouse mobile 分數 90+,首頁 LCP < 2.5s。
- 動畫:第一版保持克制(淡入、細微轉場即可)。架構上不要阻礙未來加入 scroll-driven 動畫(如 GSAP ScrollTrigger)——這是 David 明確表達的未來願望。

## 內容維護工作流程(David 的日常操作)

新增一道菜時,David 會這樣做,Claude Code 要支援這個流程:

1. 在 `src/content/dishes/` 新增資料夾,丟入照片。
2. 手寫或口述內容,請 Claude Code 建立/補完 `zh.md`。
3. 對 Claude Code 說「翻譯這道菜」→ Claude Code 讀取 `zh.md`,產生 `en.md` 與 `it.md`。翻譯時:菜名可意譯(讓外國人看得懂),食材用當地慣用說法,義大利菜名優先使用義大利文原名。
4. `git push` → Cloudflare Pages 自動部署。

**建議建立一個 `npm run new-dish` script(或 Claude Code slash command)**,互動式產生新料理的資料夾與 zh.md 模板,降低手動出錯。

## 開發階段

按順序執行,每個 Phase 結束時網站都要處於可運作、可部署的狀態:

- **Phase 0 — 地基**:Astro + React + Tailwind scaffold;建立 GitHub repo;第一時間接上 Cloudflare Pages 完成首次部署(先部署再開發,之後每次 push 都能在真實手機上驗證)。
- **Phase 1 — 內容與頁面(僅繁中)**:定義 content collection schema;建立 3 道範例料理;完成清單頁卡片與詳細頁(照片 gallery、食材清單);圖片最佳化管線。
- **Phase 2 — 篩選與排序**:React 篩選面板(標籤多選、包含/排除食材、時間範圍拉桿含即時數量)、排序切換、URL query 同步、build 時產生 JSON 索引。
- **Phase 3 — 食譜密碼鎖**:build-time AES 加密 + client 端解密流程 + 密碼輸入 UI。
- **Phase 4 — 多語系**:i18n routing、語言切換器、翻譯工作流程(含 en/it 檔案產生規則)、hreflang。
- **Phase 5 — 打磨**:效能調校(Lighthouse)、SEO/OG meta(分享到社群時顯示料理照片)、404 頁、細部動畫、`new-dish` 指令。

## 開發慣例

- Commit 訊息用英文、簡潔(conventional commits 風格,如 `feat: add time range filter`)。
- 每個 Phase 完成後執行 `npm run build` 確認無錯誤再 commit。
- 不引入非必要的套件;每加一個依賴都要能說出理由。
- 修改前先讀懂現有程式;保持結構一致。
- 對 David 解釋技術決策時使用繁體中文、白話、避免行話轟炸。

## 未來擴充備忘(現在不做)

- 自訂網域(約 US$10/年,Cloudflare 購買後直接掛上 Pages,無需改程式)
- 完整食譜的英文/義大利文版本
- Apple 風格的 scroll-driven 動畫
- 「我想吃這道」之類的訪客互動功能
