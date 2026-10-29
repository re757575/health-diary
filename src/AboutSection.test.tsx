import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { render } from '@/test/render'
import App from './App'

async function openSettings() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('tab', { name: '設定' }))
  return await screen.findByRole('region', { name: '關於' })
}

describe('關於', () => {
  it('設定頁顯示目前的 App 版本號', async () => {
    const about = await openSettings()

    const version = within(about).getByRole('definition', { name: '版本' })
    // 建置時由 vite.config.ts 從 package.json 的 version 注入
    expect(version.textContent).toBe(`v${__APP_VERSION__}`)
    expect(__APP_VERSION__).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('是設定頁的最後一個區塊', async () => {
    await openSettings()

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings.at(-1)).toBe('關於')
  })

  it('不在預設的「今天」分頁裡', () => {
    render(<App />)

    expect(screen.queryByRole('region', { name: '關於' })).not.toBeInTheDocument()
  })
})
