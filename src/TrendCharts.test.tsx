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

describe('TrendCharts：睡眠、心情與症狀對照', () => {
  const day = (n: number, hours: 5 | 8, mood: number, level: 0 | 2) =>
    entry(`2026-10-${String(n).padStart(2, '0')}`, {
      sleep:
        hours === 5
          ? { bedtime: '01:00', wakeTime: '06:00' }
          : { bedtime: '23:00', wakeTime: '07:00' },
      mood,
      symptomItems: level === 0 ? [] : [{ name: '頭痛', severity: level }],
    })

  it('沒有睡眠、心情、症狀的紀錄時顯示說明', () => {
    render(<TrendCharts entries={[entry('2026-10-28', { weightKg: 70 })]} today={today} />)

    expect(screen.getByRole('figure', { name: '睡眠、心情與症狀對照' })).toHaveTextContent(
      '最近 30 天還沒有睡眠、心情或症狀的紀錄',
    )
  })

  it('兩組各累積 3 天以上，顯示睡不夠與睡得夠的平均心情與有症狀的天數', () => {
    render(
      <TrendCharts
        entries={[
          day(20, 5, 2, 2),
          day(21, 5, 3, 2),
          day(22, 5, 2, 0),
          day(23, 8, 4, 0),
          day(24, 8, 4, 0),
          day(25, 8, 5, 2),
        ]}
        today={today}
      />,
    )

    const figure = screen.getByRole('figure', { name: '睡眠、心情與症狀對照' })
    const rows = within(within(figure).getByRole('table', { name: '睡眠對照表' })).getAllByRole(
      'row',
    )
    expect(rows.slice(1).map((r) => r.textContent)).toEqual([
      '睡不到 6.5 小時3 天2.32／3 天',
      '睡 6.5 小時以上3 天4.31／3 天',
    ])
  })

  it('任一組不到 3 天時不顯示對照表，說明還差多少', () => {
    render(
      <TrendCharts
        entries={[day(20, 5, 2, 2), day(21, 8, 4, 0), day(22, 8, 4, 0), day(23, 8, 4, 0)]}
        today={today}
      />,
    )

    const figure = screen.getByRole('figure', { name: '睡眠、心情與症狀對照' })
    expect(within(figure).queryByRole('table', { name: '睡眠對照表' })).not.toBeInTheDocument()
    expect(figure).toHaveTextContent(
      '睡不到 6.5 小時（1 天）與睡 6.5 小時以上（3 天）各累積 3 天後',
    )
  })

  it('一覽圖有名稱與天數，資料表列出每天的睡眠、心情與症狀', async () => {
    render(
      <TrendCharts entries={[day(27, 8, 4, 2), entry('2026-10-28', { mood: 3 })]} today={today} />,
    )

    const figure = screen.getByRole('figure', { name: '睡眠、心情與症狀對照' })
    expect(
      within(figure).getByRole('img', { name: '最近 30 天睡眠、心情與症狀一覽，共 2 天有紀錄' }),
    ).toBeInTheDocument()
    const table = within(figure).getByRole('table', { name: '睡眠、心情與症狀資料表' })
    expect(
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map((r) => r.textContent),
    ).toEqual(['2026-10-278 小時4/5最重中', '2026-10-28—3/5沒有症狀'])
  })
})

describe('TrendCharts：睡眠超過 12 小時', () => {
  const suspect = (date: string) => entry(date, { sleep: { bedtime: '11:50', wakeTime: '07:40' } })
  const normal = (date: string) => entry(date, { sleep: { bedtime: '23:00', wakeTime: '07:00' } })

  it('疑似填錯的日子不畫進折線圖，也不影響最新值與平均，並說明沒列入的日期', () => {
    render(
      <TrendCharts
        entries={[normal('2026-10-26'), suspect('2026-10-27'), normal('2026-10-28')]}
        today={today}
      />,
    )

    const figure = screen.getByRole('figure', { name: '睡眠時數趨勢' })
    expect(
      within(figure).getByRole('img', { name: '睡眠時數趨勢折線圖，共 2 筆紀錄' }),
    ).toBeInTheDocument()
    expect(figure).toHaveTextContent('最新 8 小時（10/28） · 區間變化 ±0 小時 · 平均 8 小時')
    expect(figure).toHaveTextContent(
      '1 天的睡眠時數超過 12 小時，可能是入睡或起床時間填錯，未列入圖表（10/27）',
    )
    expect(within(figure).queryByText(/19\.8/)).not.toBeInTheDocument()
  })

  it('全部都是疑似填錯時，顯示沒有睡眠紀錄，仍說明沒列入的原因', () => {
    render(<TrendCharts entries={[suspect('2026-10-28')]} today={today} />)

    const figure = screen.getByRole('figure', { name: '睡眠時數趨勢' })
    expect(within(figure).queryByRole('img')).not.toBeInTheDocument()
    expect(figure).toHaveTextContent('最近 30 天還沒有睡眠紀錄')
    expect(figure).toHaveTextContent('1 天的睡眠時數超過 12 小時')
  })

  it('超過 3 天時只列最近 3 天，其餘用「等」帶過', () => {
    render(
      <TrendCharts
        entries={['20', '21', '22', '23'].map((d) => suspect(`2026-10-${d}`))}
        today={today}
      />,
    )

    expect(screen.getByRole('figure', { name: '睡眠時數趨勢' })).toHaveTextContent(
      '4 天的睡眠時數超過 12 小時，可能是入睡或起床時間填錯，未列入圖表（10/21、10/22、10/23 等）',
    )
  })

  it('沒有疑似填錯的日子就不顯示說明', () => {
    render(<TrendCharts entries={[normal('2026-10-28')]} today={today} />)

    expect(screen.getByRole('figure', { name: '睡眠時數趨勢' })).not.toHaveTextContent(
      '超過 12 小時',
    )
  })
})
