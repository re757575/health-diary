import { describe, expect, it } from 'vitest'
import { entrySchema } from './entry'
import {
  addWater,
  emptyForm,
  entryToForm,
  fillEmptyMeals,
  formToEntry,
  shiftDate,
  toDateString,
  toTimeString,
} from './form'

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

describe('toTimeString', () => {
  it('使用本地時間，個位數補零', () => {
    expect(toTimeString(new Date(2026, 9, 31, 7, 5))).toBe('07:05')
    expect(toTimeString(new Date(2026, 9, 31, 23, 59))).toBe('23:59')
  })
})

describe('addWater', () => {
  it('在現有數值上累加，空白當作 0', () => {
    expect(addWater('', 250)).toBe('250')
    expect(addWater('500', 250)).toBe('750')
  })
})

describe('fillEmptyMeals', () => {
  const meals = (b: string, l = '', d = '', s = '') => ({
    breakfast: b,
    lunch: l,
    dinner: d,
    snack: s,
  })

  it('只補空著的餐別，已有內容的不動', () => {
    const result = fillEmptyMeals(meals('我的早餐', ''), meals('昨天早餐', '昨天午餐'))
    expect(result.meals).toEqual(meals('我的早餐', '昨天午餐'))
    expect(result.filled).toBe(1)
  })

  it('只有空白的餐別視為空；來源只有空白的不帶入', () => {
    const result = fillEmptyMeals(meals('  ', ''), meals('豆漿', '  '))
    expect(result.meals).toEqual(meals('豆漿', ''))
    expect(result.filled).toBe(1)
  })

  it('不修改傳入的物件', () => {
    const current = meals('')
    fillEmptyMeals(current, meals('豆漿'))
    expect(current).toEqual(meals(''))
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

describe('運動與狀況標籤', () => {
  it('沒填運動、沒選標籤時，Entry 不帶這兩個欄位', () => {
    const entry = formToEntry(emptyForm('2026-10-28'))
    expect(entry.exerciseMinutes).toBeUndefined()
    expect(entry.tags).toBeUndefined()
  })

  it('運動 0 分鐘是有效的紀錄（今天沒運動），不會被當成沒填', () => {
    expect(formToEntry({ ...emptyForm('2026-10-28'), exerciseMinutes: '0' }).exerciseMinutes).toBe(
      0,
    )
  })

  it('舊紀錄沒有這兩個欄位，載入表單時是空字串與空陣列', () => {
    const form = entryToForm({ date: '2026-10-28', meals: [], bowel: [] })
    expect(form.exerciseMinutes).toBe('')
    expect(form.tags).toEqual([])
  })
})

describe('症狀項目', () => {
  it('沒有選任何症狀時，Entry 不帶 symptomItems', () => {
    expect(formToEntry(emptyForm('2026-10-28')).symptomItems).toBeUndefined()
  })

  it('舊紀錄沒有 symptomItems，載入表單時是空陣列', () => {
    expect(entryToForm({ date: '2026-10-28', meals: [], bowel: [] }).symptomItems).toEqual([])
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
      exerciseMinutes: 120,
      tags: ['空氣品質差', '久坐'],
      symptomItems: [
        { name: '頭痛', severity: 2 },
        { name: '耳鳴', severity: 1 },
      ],
      symptoms: '下午開車時腰椎酸痛',
      notes: '早起運動',
    })
    expect(formToEntry(entryToForm(entry))).toEqual(entry)
  })
})
