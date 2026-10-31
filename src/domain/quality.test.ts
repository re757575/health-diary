import { describe, expect, it } from 'vitest'
import type { Entry } from './entry'
import { findIncompleteDays, findLongSleeps, missingFields } from './quality'

const entry = (date: string, extra: Partial<Entry> = {}): Entry => ({
  date,
  meals: [],
  bowel: [],
  ...extra,
})

describe('missingFields', () => {
  it('空白紀錄四個核心欄位都沒填', () => {
    expect(missingFields(entry('2026-10-28'))).toEqual(['體重', '飲水', '睡眠時間', '心情'])
  })

  it('都填了就沒有缺漏；0 也算填了', () => {
    const full = entry('2026-10-28', {
      weightKg: 68,
      waterMl: 0,
      sleep: { bedtime: '23:30', wakeTime: '07:00' },
      mood: 3,
    })
    expect(missingFields(full)).toEqual([])
  })

  it('睡眠時間要入睡與起床都有才算填；只有品質不算', () => {
    expect(missingFields(entry('d', { sleep: { bedtime: '23:30' } }))).toContain('睡眠時間')
    expect(missingFields(entry('d', { sleep: { quality: 3 } }))).toContain('睡眠時間')
  })

  it('餐點、症狀這類選填的不算缺漏', () => {
    const e = entry('2026-10-28', {
      weightKg: 1,
      waterMl: 1,
      mood: 1,
      sleep: { bedtime: '23:00', wakeTime: '07:00' },
    })
    expect(missingFields(e)).toEqual([])
  })
})

describe('findLongSleeps', () => {
  it('找出睡眠超過 12 小時的紀錄，剛好 12 小時不算', () => {
    const found = findLongSleeps([
      entry('2026-10-27', { sleep: { bedtime: '22:00', wakeTime: '10:00' } }),
      entry('2026-10-28', { sleep: { bedtime: '11:50', wakeTime: '07:40' } }),
      entry('2026-10-29', { sleep: { bedtime: '23:50', wakeTime: '07:40' } }),
      entry('2026-10-30'),
    ])
    expect(found).toEqual([
      { date: '2026-10-28', hours: 19.8, bedtime: '11:50', wakeTime: '07:40' },
    ])
  })
})

describe('findIncompleteDays', () => {
  const today = new Date(2026, 9, 31)
  const complete = {
    weightKg: 68,
    waterMl: 2000,
    mood: 3,
    sleep: { bedtime: '23:30', wakeTime: '07:00' },
  }

  it('沒有任何紀錄時不提示（還沒開始記錄）', () => {
    expect(findIncompleteDays([], today)).toEqual([])
  })

  it('由近到遠列出沒填完的日子與缺哪些欄位，填完的不列', () => {
    const days = findIncompleteDays(
      [
        entry('2026-10-28', { ...complete, mood: undefined }),
        entry('2026-10-29', complete),
        entry('2026-10-30', { weightKg: 68 }),
      ],
      today,
    )
    expect(days).toEqual([
      { date: '2026-10-30', empty: false, missing: ['飲水', '睡眠時間', '心情'] },
      { date: '2026-10-28', empty: false, missing: ['心情'] },
    ])
  })

  it('中間整天沒記錄的日子標為 empty，缺全部欄位', () => {
    const days = findIncompleteDays(
      [entry('2026-10-28', complete), entry('2026-10-30', complete)],
      today,
    )
    expect(days).toEqual([
      { date: '2026-10-29', empty: true, missing: ['體重', '飲水', '睡眠時間', '心情'] },
    ])
  })

  it('今天還在填，不列入；第一筆紀錄之前的日子也不算漏填', () => {
    const days = findIncompleteDays([entry('2026-10-30', complete), entry('2026-10-31')], today)
    expect(days).toEqual([])
  })

  it('只看今天之前 7 天，更早的不提示', () => {
    // 10/31 往前 7 天是 10/24～10/30；10/20 沒填完但太久以前
    const days = findIncompleteDays(
      [
        entry('2026-10-20'),
        ...['24', '25', '26', '27', '28', '29', '30'].map((d) => entry(`2026-10-${d}`, complete)),
      ],
      today,
    )
    expect(days).toEqual([])
  })
})
