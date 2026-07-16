// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Astro 設定檔
// - react():讓網站可以使用 React 互動元件(篩選面板、密碼輸入等)
// - tailwindcss():啟用 Tailwind CSS 樣式系統
// - i18n:多語系路由。繁中是預設語言(網址不帶前綴),英文/義文帶 /en/、/it/ 前綴
export default defineConfig({
  // 部署到 Cloudflare Pages 後,把這裡改成正式網址(影響 sitemap 與 canonical 標籤)
  site: 'https://david-cookbook.pages.dev',

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
  },

  i18n: {
    locales: ['zh-tw', 'en', 'it'],
    defaultLocale: 'zh-tw',
    routing: {
      // 繁中(預設語言)網址不帶 /zh-tw/ 前綴,其他語言帶前綴
      prefixDefaultLocale: false,
    },
  },
});
