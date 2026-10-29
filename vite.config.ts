import { readFileSync } from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
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
  plugins: [react()],
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
