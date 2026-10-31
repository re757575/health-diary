import { screen, within } from '@testing-library/react'
import { render } from '@/test/render'
import { describe, expect, it } from 'vitest'
import type { Entry } from '@/domain/entry'
import { TrendCharts } from './TrendCharts'

const entry = (date: string, extra: Partial<Entry> = {}): Entry => ({
  date,
  meals: [],
  bowel: [],
  ...extra,
})

const today = new Date(2026, 9, 28)

describe('TrendCharts：有資料', () => {
  const entries = [
    entry('2026-10-10', { weightKg: 71.2, sleep: { bedtime: '23:00', wakeTime: '06:30' } }),
    entry('2026-10-28', { weightKg: 70, sleep: { bedtime: '00:00', wakeTime: '06:00' } }),
  ]

  // 以圖的名稱找到整張圖，再比對看得到的文字；不依賴摘要內部怎麼切元素（版面上每段不拆行）
  it('摘要：最新值與日期、首尾變化、平均', () => {
    render(<TrendCharts entries={entries} today={today} />)

    expect(screen.getByRole('figure', { name: '體重趨勢' })).toHaveTextContent(
      '最新 70 kg（10/28） · 區間變化 −1.2 kg · 平均 70.6 kg',
    )
    expect(screen.getByRole('figure', { name: '睡眠時數趨勢' })).toHaveTextContent(
      '最新 6 小時（10/28） · 區間變化 −1.5 小時 · 平均 6.8 小時',
    )
  })

  it('變化為正時標上 +', () => {
    render(
      <TrendCharts
        entries={[entry('2026-10-10', { weightKg: 70 }), entry('2026-10-28', { weightKg: 70.5 })]}
        today={today}
      />,
    )

    expect(screen.getByRole('figure', { name: '體重趨勢' })).toHaveTextContent('區間變化 +0.5 kg')
  })

  it('只有一筆：只顯示最新值，不顯示變化與平均', () => {
    render(<TrendCharts entries={[entry('2026-10-28', { weightKg: 70 })]} today={today} />)

    const figure = screen.getByRole('figure', { name: '體重趨勢' })
    expect(figure).toHaveTextContent('最新 70 kg（10/28）')
    expect(figure).not.toHaveTextContent('區間變化')
    expect(figure).not.toHaveTextContent('平均')
  })

  it('每張圖都有給輔助科技的文字名稱，不只靠顏色與形狀', () => {
    render(<TrendCharts entries={entries} today={today} />)

    expect(screen.getByRole('img', { name: '體重趨勢折線圖，共 2 筆紀錄' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '睡眠時數趨勢折線圖，共 2 筆紀錄' })).toBeInTheDocument()
  })

  it('提供資料表檢視：每個點一列，日期由舊到新', () => {
    render(<TrendCharts entries={entries} today={today} />)

    const rows = within(screen.getByRole('table', { name: '體重資料表' })).getAllByRole('row')
    expect(rows.map((row) => row.textContent)).toEqual([
      '日期體重',
      '2026-10-1071.2 kg',
      '2026-10-2870 kg',
    ])
    const sleepRows = within(screen.getByRole('table', { name: '睡眠時數資料表' })).getAllByRole(
      'row',
    )
    expect(sleepRows.map((row) => row.textContent)).toEqual([
      '日期睡眠時數',
      '2026-10-107.5 小時',
      '2026-10-286 小時',
    ])
  })
})

describe('TrendCharts：沒有資料', () => {
  it('兩張圖各自顯示空狀態，不畫圖', () => {
    render(<TrendCharts entries={[]} today={today} />)

    expect(screen.getByText('最近 30 天還沒有體重紀錄')).toBeInTheDocument()
    expect(screen.getByText('最近 30 天還沒有睡眠紀錄（需要填入睡與起床時間）')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('區間外的紀錄不算：只有 31 天前的體重仍顯示空狀態', () => {
    render(<TrendCharts entries={[entry('2026-09-28', { weightKg: 80 })]} today={today} />)

    expect(screen.getByText('最近 30 天還沒有體重紀錄')).toBeInTheDocument()
  })
})

describe('TrendCharts：症狀出現天數', () => {
  const withSymptoms = (date: string, ...items: [string, 1 | 2 | 3][]) =>
    entry(date, { symptomItems: items.map(([name, severity]) => ({ name, severity })) })

  it('列出各症狀的天數與輕／中／重分布，天數多的在前', () => {
    render(
      <TrendCharts
        entries={[
          withSymptoms('2026-10-26', ['頭痛', 1], ['鼻塞', 2]),
          withSymptoms('2026-10-27', ['頭痛', 2]),
          withSymptoms('2026-10-28', ['頭痛', 3]),
          entry('2026-10-25', { weightKg: 70 }),
        ]}
        today={today}
      />,
    )

    const figure = screen.getByRole('figure', { name: '症狀出現天數' })
    expect(figure).toHaveTextContent('最近 30 天有 4 天有紀錄')
    const rows = within(figure).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      '頭痛3 天（輕 1 · 中 1 · 重 1）',
      '鼻塞1 天（中 1）',
    ])
  })

  it('還沒有點選的症狀時顯示說明', () => {
    render(<TrendCharts entries={[entry('2026-10-28', { weightKg: 70 })]} today={today} />)

    expect(screen.getByRole('figure', { name: '症狀出現天數' })).toHaveTextContent(
      '最近 30 天還沒有點選記錄的症狀',
    )
  })

  it('有些天只用文字寫症狀時，說明那幾天沒有列入統計', () => {
    render(
      <TrendCharts
        entries={[
          entry('2026-10-27', { symptoms: '頭有點痛' }),
          withSymptoms('2026-10-28', ['頭痛', 1]),
        ]}
        today={today}
      />,
    )

    expect(screen.getByRole('figure', { name: '症狀出現天數' })).toHaveTextContent(
      '另有 1 天的症狀是用文字記錄，沒有列入統計',
    )
  })
})
