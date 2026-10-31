import { describe, expect, it } from 'vitest'
import {
  buildDaily,
  compareBySleep,
  moodIntensity,
  sleepIntensity,
  symptomIntensity,
  type DailyCell,
} from './daily'
import type { Entry } from './entry'

const entry = (date: string, extra: Partial<Entry> = {}): Entry => ({
  date,
  meals: [],
  bowel: [],
  ...extra,
})

const today = new Date(2026, 9, 28)

describe('buildDaily', () => {
  it('每天一格：睡眠時數、心情、當天最嚴重的症狀，並帶著距離區間起點的天數', () => {
    const { cells, startDate, days } = buildDaily(
      [
        entry('2026-10-28', {
          sleep: { bedtime: '23:00', wakeTime: '06:30' },
          mood: 4,
          symptomItems: [
            { name: '頭痛', severity: 1 },
            { name: '鼻塞', severity: 3 },
          ],
        }),
      ],
      today,
    )
    expect(startDate).toBe('2026-09-29')
    expect(days).toBe(30)
    expect(cells).toEqual([
      { date: '2026-10-28', dayIndex: 29, sleepHours: 7.5, mood: 4, symptomLevel: 3 },
    ])
  })

  it('填了睡眠或心情卻沒點症狀是 0；只填體重、只用文字寫症狀的是 undefined；文字加點選以點選為準', () => {
    const { cells } = buildDaily(
      [
        entry('2026-10-24', { mood: 3 }),
        entry('2026-10-25', { sleep: { bedtime: '23:00', wakeTime: '07:00' } }),
        entry('2026-10-26', { weightKg: 70 }),
        entry('2026-10-27', { mood: 3, symptoms: '頭有點痛' }),
        entry('2026-10-28', { symptoms: '補充', symptomItems: [{ name: '頭痛', severity: 2 }] }),
      ],
      today,
    )
    expect(cells.map((c) => c.symptomLevel)).toEqual([0, 0, undefined, undefined, 2])
  })

  it('睡眠超過 12 小時多半是填錯，不放進一覽；缺入睡或起床時間也沒有', () => {
    const { cells } = buildDaily(
      [
        entry('2026-10-26', { sleep: { bedtime: '11:50', wakeTime: '07:40' } }),
        entry('2026-10-27', { sleep: { bedtime: '23:00' } }),
      ],
      today,
    )
    expect(cells.map((c) => c.sleepHours)).toEqual([undefined, undefined])
  })

  it('只看區間內的紀錄，由舊到新', () => {
    const { cells } = buildDaily(
      [entry('2026-10-28'), entry('2026-09-01'), entry('2026-10-20')],
      today,
    )
    expect(cells.map((c) => c.date)).toEqual(['2026-10-20', '2026-10-28'])
  })
})

describe('顏色深淺', () => {
  it('睡眠 4 小時以下最淡、8 小時以上最深，中間線性', () => {
    expect(sleepIntensity(3)).toBeCloseTo(0.2)
    expect(sleepIntensity(6)).toBeCloseTo(0.6)
    expect(sleepIntensity(10)).toBeCloseTo(1)
  })

  it('心情 1 最淡、5 最深', () => {
    expect(moodIntensity(1)).toBeCloseTo(0.2)
    expect(moodIntensity(3)).toBeCloseTo(0.6)
    expect(moodIntensity(5)).toBeCloseTo(1)
  })

  it('症狀輕中重是 0.4、0.7、1', () => {
    expect([1, 2, 3].map((l) => symptomIntensity(l as 1 | 2 | 3))).toEqual([0.4, 0.7, 1])
  })
})

describe('compareBySleep', () => {
  const cell = (
    date: string,
    sleepHours: number | undefined,
    mood?: number,
    symptomLevel?: DailyCell['symptomLevel'],
  ): DailyCell => ({ date, dayIndex: 0, sleepHours, mood, symptomLevel })

  it('以 6.5 小時分組：剛好 6.5 算睡得夠；各組平均心情與有症狀的天數', () => {
    const { short, enough } = compareBySleep([
      cell('a', 5, 2, 2),
      cell('b', 6, 3, 1),
      cell('c', 6.5, 4, 0),
      cell('d', 8, 5, 0),
    ])
    expect(short).toEqual({ days: 2, moodAvg: 2.5, symptomDays: 2, symptomBase: 2 })
    expect(enough).toEqual({ days: 2, moodAvg: 4.5, symptomDays: 0, symptomBase: 2 })
  })

  it('沒有睡眠時數的日子不參與；沒人填心情時沒有平均；只有文字症狀的不算進比例', () => {
    const { short, enough } = compareBySleep([
      cell('a', undefined, 1, 3),
      cell('b', 5, undefined, undefined),
      cell('c', 7, undefined, 1),
    ])
    expect(short).toEqual({ days: 1, symptomDays: 0, symptomBase: 0 })
    expect(enough).toEqual({ days: 1, symptomDays: 1, symptomBase: 1 })
    expect(short.moodAvg).toBeUndefined()
  })

  it('沒有資料時兩組都是 0 天', () => {
    expect(compareBySleep([])).toEqual({
      short: { days: 0, symptomDays: 0, symptomBase: 0 },
      enough: { days: 0, symptomDays: 0, symptomBase: 0 },
    })
  })
})
