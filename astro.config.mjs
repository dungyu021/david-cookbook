// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Astro 設定檔
// - react():讓網站可以使用 React 互動元件(篩選面板、密碼輸入等)
// - sitemap():build 時自動產生 sitemap-index.xml,幫助 Google 收錄所有料理頁面
// - tailwindcss():啟用 Tailwind CSS 樣式系統
// - i18n:多語系路由。繁中是預設語言(網址不帶前綴),英文/義文帶 /en/、/it/ 前綴
export default defineConfig({
  site: 'https://david-cookbook.pages.dev',

  integrations: [react(), sitemap()],

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
