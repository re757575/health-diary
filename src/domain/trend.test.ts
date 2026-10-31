import { describe, expect, it } from 'vitest'
import type { Entry } from './entry'
import { buildSymptomTrend, buildTrends, summarizeSeries } from './trend'

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

  it('睡眠超過 12 小時多半是填錯，不畫進圖，日期另外列出；剛好 12 小時還是收', () => {
    const trends = buildTrends(
      [
        entry('2026-10-25', { sleep: { bedtime: '22:00', wakeTime: '10:00' } }),
        entry('2026-10-26', { sleep: { bedtime: '11:50', wakeTime: '07:40' } }),
        entry('2026-10-27', { sleep: { bedtime: '23:50', wakeTime: '07:40' } }),
        entry('2026-10-28', { sleep: { bedtime: '11:30', wakeTime: '07:10' } }),
      ],
      today,
    )
    expect(trends.sleepHours.map((p) => [p.date, p.value])).toEqual([
      ['2026-10-25', 12],
      ['2026-10-27', 7.8],
    ])
    expect(trends.suspectSleepDates).toEqual(['2026-10-26', '2026-10-28'])
  })

  it('區間外的疑似填錯不列入；沒有疑似填錯時是空陣列', () => {
    const trends = buildTrends(
      [
        entry('2026-09-01', { sleep: { bedtime: '11:50', wakeTime: '07:40' } }),
        entry('2026-10-28', { sleep: { bedtime: '23:00', wakeTime: '07:00' } }),
      ],
      today,
    )
    expect(trends.suspectSleepDates).toEqual([])
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

describe('buildSymptomTrend', () => {
  const withSymptoms = (date: string, ...items: [string, 1 | 2 | 3][]) =>
    entry(date, { symptomItems: items.map(([name, severity]) => ({ name, severity })) })

  it('沒有紀錄時是空的', () => {
    expect(buildSymptomTrend([], today)).toEqual({ recordedDays: 0, textOnlyDays: 0, items: [] })
  })

  it('每個症狀算出現的天數與輕／中／重各幾天，依天數由多到少', () => {
    const trend = buildSymptomTrend(
      [
        withSymptoms('2026-10-26', ['頭痛', 1], ['鼻塞', 2]),
        withSymptoms('2026-10-27', ['頭痛', 2]),
        withSymptoms('2026-10-28', ['頭痛', 3]),
        entry('2026-10-25', { weightKg: 70 }),
      ],
      today,
    )
    expect(trend.recordedDays).toBe(4)
    expect(trend.items).toEqual([
      { name: '頭痛', days: 3, bySeverity: { 1: 1, 2: 1, 3: 1 } },
      { name: '鼻塞', days: 1, bySeverity: { 1: 0, 2: 1, 3: 0 } },
    ])
  })

  it('天數相同時依名稱排序', () => {
    const names = buildSymptomTrend(
      [withSymptoms('2026-10-28', ['鼻塞', 1], ['頭痛', 1], ['腰痠', 1])],
      today,
    ).items.map((i) => i.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'zh-Hant')))
  })

  it('只統計區間內（含今天）的紀錄', () => {
    const trend = buildSymptomTrend(
      [withSymptoms('2026-09-28', ['頭痛', 1]), withSymptoms('2026-09-29', ['頭痛', 1])],
      today,
    )
    // 區間 30 天：2026-09-29 ～ 2026-10-28
    expect(trend.recordedDays).toBe(1)
    expect(trend.items).toEqual([{ name: '頭痛', days: 1, bySeverity: { 1: 1, 2: 0, 3: 0 } }])
  })

  it('同一天重複的症狀只算一天', () => {
    const trend = buildSymptomTrend([withSymptoms('2026-10-28', ['頭痛', 1], ['頭痛', 3])], today)
    expect(trend.items[0]).toMatchObject({ name: '頭痛', days: 1 })
  })

  it('只用文字寫症狀的天數另外計，不列入各症狀統計', () => {
    const trend = buildSymptomTrend(
      [
        entry('2026-10-27', { symptoms: '頭痛' }),
        entry('2026-10-28', { symptoms: '頭痛', symptomItems: [{ name: '頭痛', severity: 1 }] }),
      ],
      today,
    )
    expect(trend.textOnlyDays).toBe(1)
    expect(trend.items).toHaveLength(1)
  })
})
