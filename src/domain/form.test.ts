import { describe, expect, it } from 'vitest'
import { entrySchema } from './entry'
import { emptyForm, entryToForm, formToEntry, shiftDate, toDateString } from './form'

describe('toDateString', () => {
  it('使用本地時區，個位數月日補零', () => {
    expect(toDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

describe('shiftDate', () => {
  it('跨月、跨年與閏年', () => {
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDate('2024-03-01', -1)).toBe('2024-02-29')
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('移動 0 天維持原日期', () => {
    expect(shiftDate('2026-10-29', 0)).toBe('2026-10-29')
  })
})

describe('formToEntry', () => {
  it('空表單只留下日期，且是合法的 Entry', () => {
    const entry = formToEntry(emptyForm('2026-10-28'))
    expect(entry).toMatchObject({ date: '2026-10-28', meals: [], bowel: [] })
    expect(entry.weightKg).toBeUndefined()
    expect(entry.sleep).toBeUndefined()
    expect(entrySchema.safeParse(entry).success).toBe(true)
  })

  it('數值欄位轉成數字，體重 0 不會被當成沒填', () => {
    const form = { ...emptyForm('2026-10-28'), weightKg: '70.5', waterMl: '0', mood: '3' }
    expect(formToEntry(form)).toMatchObject({ weightKg: 70.5, waterMl: 0, mood: 3 })
  })

  it('只收有內容的餐點，並去除前後空白', () => {
    const form = emptyForm('2026-10-28')
    form.meals.breakfast = '  蛋餅  '
    form.meals.dinner = '   '
    expect(formToEntry(form).meals).toEqual([{ type: 'breakfast', description: '蛋餅' }])
  })

  it('捨棄全空的排便列，保留有任一欄位的列', () => {
    const form = emptyForm('2026-10-28')
    form.bowel = [
      { time: '', bristol: '', note: '' },
      { time: '', bristol: '4', note: '' },
    ]
    expect(formToEntry(form).bowel).toEqual([{ time: undefined, bristol: 4, note: undefined }])
  })

  it('只填睡眠品質也會建立 sleep', () => {
    const form = { ...emptyForm('2026-10-28'), sleepQuality: '2' }
    expect(formToEntry(form).sleep).toEqual({ bedtime: undefined, wakeTime: undefined, quality: 2 })
  })
})

describe('entryToForm', () => {
  it('編輯既有紀錄：Entry → 表單 → Entry 內容不變', () => {
    const entry = entrySchema.parse({
      date: '2026-10-28',
      weightKg: 70.5,
      sleep: { bedtime: '23:30', wakeTime: '07:00', quality: 4 },
      meals: [{ type: 'lunch', description: '雞胸便當' }],
      bowel: [{ time: '08:10', bristol: 4, note: '順暢' }],
      waterMl: 1800,
      mood: 4,
      symptoms: '無',
      notes: '早起運動',
    })
    expect(formToEntry(entryToForm(entry))).toEqual(entry)
  })
})
