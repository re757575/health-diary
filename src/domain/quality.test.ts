import { describe, expect, it } from 'vitest'
import type { Entry } from './entry'
import { findLongSleeps, missingFields } from './quality'

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
