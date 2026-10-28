import { defineConfig, devices } from '@playwright/test'

// 多個 worktree 平行跑 E2E 時，用 E2E_PORT 指定不同的 port
const PORT = Number(process.env.E2E_PORT ?? 4173)
const BASE_PATH = '/health-diary/'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    // baseURL 帶有 base path，page.goto 要用相對路徑（例如 'settings'），不要以 / 開頭
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'Mobile Chrome', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
  },
})
