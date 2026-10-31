import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@/test/render'
import { MissingNotice } from './MissingNotice'

const days = [
  { date: '2026-10-30', empty: false, missing: ['飲水', '心情'] },
  { date: '2026-10-28', empty: true, missing: ['體重', '飲水', '睡眠時間', '心情'] },
]

describe('MissingNotice', () => {
  it('沒有漏填時什麼都不顯示', () => {
    render(<MissingNotice days={[]} currentDate="2026-10-31" onFill={vi.fn()} />)
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('列出每一天缺哪些欄位；整天沒紀錄的另外說明', () => {
    render(<MissingNotice days={days} currentDate="2026-10-31" onFill={vi.fn()} />)

    const region = screen.getByRole('region', { name: '未填完的紀錄' })
    expect(region).toHaveTextContent('最近有 2 天的紀錄沒填完')
    const rows = within(region).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('10/30 沒填：飲水、心情')
    expect(rows[1]).toHaveTextContent('10/28 整天沒有紀錄')
  })

  it('按「補填」帶出那一天的日期', async () => {
    const onFill = vi.fn()
    const user = userEvent.setup()
    render(<MissingNotice days={days} currentDate="2026-10-31" onFill={onFill} />)

    await user.click(screen.getByRole('button', { name: '補填 2026-10-28' }))
    expect(onFill).toHaveBeenCalledWith('2026-10-28')
  })

  it('正在編輯的那一天顯示「編輯中」，不提供補填', () => {
    render(<MissingNotice days={days} currentDate="2026-10-30" onFill={vi.fn()} />)

    expect(screen.queryByRole('button', { name: '補填 2026-10-30' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '補填 2026-10-28' })).toBeInTheDocument()
    expect(within(screen.getAllByRole('listitem')[0]!).getByText('編輯中')).toBeInTheDocument()
  })
})
