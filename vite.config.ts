import { readFileSync } from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// GitHub Pages 專案網站的路徑：https://<user>.github.io/health-diary/
const BASE = '/health-diary/'

/** 頁面顯示的 App 版本號：來自 package.json 的 version，由 `npm run release` 更新 */
const { version } = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, 'package.json'), 'utf8'),
) as { version: string }

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  base: BASE,
  plugins: [
    react(),
    // 可安裝到主畫面、離線也能開。新版的 service worker 裝好後直接接手，但不重新整理頁面
    // （正在填的表單不會被洗掉），下次開啟才是新版
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      // 圖示由 pwa-assets.config.ts 產生；theme-color 已寫在 index.html（分淺色／深色），不要再注入
      pwaAssets: { config: true, injectThemeColor: false },
      manifest: {
        name: '健康日記',
        short_name: '健康日記',
        description: '每日記錄飲食與健康狀況，資料只存在這台裝置',
        lang: 'zh-Hant-TW',
        display: 'standalone',
        theme_color: '#ffffff',
        background_color: '#ffffff',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        // 第一次開啟就接手目前的頁面，不用重新整理一次才能離線使用
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        // 依套件拆成 vendor chunk：單一 chunk 不會超過 500 kB，
        // 而且只改 App 程式碼的版本不會讓使用者重新下載這些套件
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 40,
            },
            {
              name: 'mantine',
              test: /node_modules[\\/](@mantine|@floating-ui)[\\/]/,
              priority: 30,
            },
            {
              name: 'data',
              test: /node_modules[\\/](dexie|dexie-react-hooks|zod)[\\/]/,
              priority: 20,
            },
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts'],
      exclude: ['src/domain/**/*.test.ts'],
    },
  },
})
