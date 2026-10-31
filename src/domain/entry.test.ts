import { describe, expect, it } from 'vitest'
import {
  BRISTOL_DESCRIPTIONS,
  MOOD_DESCRIPTIONS,
  SLEEP_QUALITY_DESCRIPTIONS,
  entrySchema,
  sleepHours,
} from './entry'

describe('sleepHours', () => {
  it('跨午夜時加一天計算', () => {
    expect(sleepHours({ bedtime: '23:30', wakeTime: '07:00' })).toBe(7.5)
  })

  it('同一天內入睡（例如午睡）', () => {
    expect(sleepHours({ bedtime: '13:00', wakeTime: '14:30' })).toBe(1.5)
  })

  it('入睡時間誤填成上午時會算出超過半天，由表單負責提示', () => {
    expect(sleepHours({ bedtime: '11:50', wakeTime: '07:40' })).toBe(19.8)
  })

  it('缺少任一時間回傳 undefined', () => {
    expect(sleepHours({ bedtime: '23:00' })).toBeUndefined()
    expect(sleepHours(undefined)).toBeUndefined()
  })
})

describe('評分說明', () => {
  it('每個分數都有說明：睡眠品質與心情 1–5，布里斯托 1–7', () => {
    expect(SLEEP_QUALITY_DESCRIPTIONS).toHaveLength(5)
    expect(MOOD_DESCRIPTIONS).toHaveLength(5)
    expect(BRISTOL_DESCRIPTIONS).toHaveLength(7)
  })
})

describe('entrySchema', () => {
  const base = { date: '2026-10-28', meals: [], bowel: [] }

  it('只有日期、空餐點與空排便也合法', () => {
    expect(entrySchema.safeParse(base).success).toBe(true)
  })

  it.each([
    ['日期格式錯誤', { ...base, date: '2026/10/28' }],
    ['體重為負數', { ...base, weightKg: -1 }],
    ['布里斯托分類超出 1–7', { ...base, bowel: [{ bristol: 8 }] }],
    ['時間格式錯誤', { ...base, sleep: { bedtime: '25:00' } }],
    ['未知的餐別', { ...base, meals: [{ type: 'brunch', description: '' }] }],
  ])('拒絕：%s', (_name, input) => {
    expect(entrySchema.safeParse(input).success).toBe(false)
  })
})
