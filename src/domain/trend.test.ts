import { describe, expect, it } from 'vitest'
import type { Entry } from './entry'
import { buildTrends, summarizeSeries } from './trend'

const entry = (date: string, extra: Partial<Entry> = {}): Entry => ({
  date,
  meals: [],
  bowel: [],
  ...extra,
})

const today = new Date(2026, 9, 28)

describe('summarizeSeries', () => {
  const point = (dayIndex: number, value: number) => ({
    date: `2026-10-${String(dayIndex + 1).padStart(2, '0')}`,
    dayIndex,
    value,
  })

  it('沒有資料時只有筆數 0', () => {
    expect(summarizeSeries([])).toEqual({ count: 0 })
  })

  it('只有一筆：有最新值，但不算變化', () => {
    expect(summarizeSeries([point(3, 70)])).toEqual({
      count: 1,
      latest: point(3, 70),
      average: 70,
    })
  })

  it('多筆：最新值、首尾變化、平均都四捨五入到小數 1 位', () => {
    const summary = summarizeSeries([point(0, 71.2), point(5, 70.8), point(9, 70)])
    expect(summary).toEqual({
      count: 3,
      latest: point(9, 70),
      change: -1.2,
      average: 70.7,
    })
  })
})

describe('buildTrends：睡眠時數', () => {
  it('以入睡與起床時間算時數（跨午夜），缺任一時間的日子不收', () => {
    const trends = buildTrends(
      [
        entry('2026-10-26', { sleep: { bedtime: '23:30', wakeTime: '07:00' } }),
        entry('2026-10-27', { sleep: { bedtime: '23:00' } }),
        entry('2026-10-28', { sleep: { quality: 4 } }),
      ],
      today,
    )
    expect(trends.sleepHours).toEqual([{ date: '2026-10-26', dayIndex: 27, value: 7.5 }])
  })

  it('體重與睡眠各自獨立：只填睡眠的日子不會出現在體重', () => {
    const trends = buildTrends(
      [entry('2026-10-28', { sleep: { bedtime: '00:00', wakeTime: '06:00' } })],
      today,
    )
    expect(trends.weight).toEqual([])
    expect(trends.sleepHours).toHaveLength(1)
  })

  it('跨月時 dayIndex 仍是實際相隔天數', () => {
    const trends = buildTrends(
      [entry('2026-10-01', { weightKg: 70 }), entry('2026-09-30', { weightKg: 71 })],
      today,
    )
    expect(trends.weight.map((p) => p.dayIndex)).toEqual([1, 2])
  })
})

describe('buildTrends：區間與體重', () => {
  it('預設是含今天的最近 30 天', () => {
    expect(buildTrends([], today)).toMatchObject({
      startDate: '2026-09-29',
      endDate: '2026-10-28',
      days: 30,
    })
  })

  it('體重點只收有填體重的日子，由舊到新，dayIndex 是距離區間起點幾天', () => {
    const trends = buildTrends(
      [
        entry('2026-10-28', { weightKg: 70 }),
        entry('2026-10-27'),
        entry('2026-09-29', { weightKg: 71.2 }),
      ],
      today,
    )
    expect(trends.weight).toEqual([
      { date: '2026-09-29', dayIndex: 0, value: 71.2 },
      { date: '2026-10-28', dayIndex: 29, value: 70 },
    ])
  })

  it('區間外的紀錄不納入：起點前一天與未來的日期', () => {
    const trends = buildTrends(
      [
        entry('2026-09-28', { weightKg: 80 }),
        entry('2026-10-29', { weightKg: 81 }),
        entry('2026-10-01', { weightKg: 70 }),
      ],
      today,
    )
    expect(trends.weight.map((p) => p.date)).toEqual(['2026-10-01'])
  })
})
