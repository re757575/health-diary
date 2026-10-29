import { screen, within } from '@testing-library/react'
import { render } from '@/test/render'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('關於', () => {
  it('頁面最下方顯示目前的 App 版本號', async () => {
    render(<App />)

    const about = await screen.findByRole('region', { name: '關於' })
    const version = within(about).getByRole('definition', { name: '版本' })
    // 建置時由 vite.config.ts 從 package.json 的 version 注入
    expect(version.textContent).toBe(`v${__APP_VERSION__}`)
    expect(__APP_VERSION__).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('是頁面的最後一個區塊', async () => {
    render(<App />)

    await screen.findByRole('region', { name: '關於' })
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings.at(-1)).toBe('關於')
  })
})
