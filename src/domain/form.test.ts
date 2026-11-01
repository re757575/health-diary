import { describe, expect, it } from 'vitest'
import { entrySchema } from './entry'
import {
  addWater,
  emptyForm,
  entryToForm,
  fillEmptyMeals,
  formToEntry,
  isSameEntry,
  toggleFoodItem,
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
  const meal = (...names: string[]) => ({
    items: names.map((name) => ({ name, amount: '1', unit: '份' })),
    note: '',
  })
  const meals = (b = meal(), l = meal(), d = meal(), sn = meal()) => ({
    breakfast: b,
    lunch: l,
    dinner: d,
    snack: sn,
  })

  it('只補空著的餐別，已有內容的不動', () => {
    const result = fillEmptyMeals(
      meals(meal('我的早餐')),
      meals(meal('昨天早餐'), meal('昨天午餐')),
    )
    expect(result.meals).toEqual(meals(meal('我的早餐'), meal('昨天午餐')))
    expect(result.filled).toBe(1)
  })

  it('只有備註的餐別也算有內容；備註只有空白的算空', () => {
    const noted = { items: [], note: '外食' }
    const result = fillEmptyMeals(
      meals({ items: [], note: '  ' }, noted),
      meals(meal('豆漿'), meal('昨天午餐')),
    )
    expect(result.meals).toEqual(meals(meal('豆漿'), noted))
    expect(result.filled).toBe(1)
  })

  it('不修改傳入的物件，帶入的食物是複製的', () => {
    const current = meals()
    const source = meals(meal('豆漿'))
    const { meals: filled } = fillEmptyMeals(current, source)
    expect(current).toEqual(meals())
    filled.breakfast.items[0]!.amount = '2'
    expect(source.breakfast.items[0]!.amount).toBe('1')
  })
})

describe('toggleFoodItem', () => {
  it('還沒有就加入，預設 1 份；已經有就拿掉', () => {
    const added = toggleFoodItem({ items: [], note: '外食' }, '燕麥')
    expect(added).toEqual({ items: [{ name: '燕麥', amount: '1', unit: '份' }], note: '外食' })
    expect(toggleFoodItem(added, '燕麥')).toEqual({ items: [], note: '外食' })
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

  it('只收有內容的餐點：食物轉成數字份量（空白當 1），備註去掉前後空白，空的省略', () => {
    const form = emptyForm('2026-10-28')
    form.meals.breakfast = {
      items: [
        { name: ' 蛋餅 ', amount: '', unit: '份' },
        { name: '白飯', amount: '0.5', unit: '碗' },
      ],
      note: '',
    }
    form.meals.lunch = { items: [], note: '  外食  ' }
    form.meals.dinner = { items: [], note: '   ' }
    const entry = formToEntry(form)
    expect(entry.meals).toEqual([
      {
        type: 'breakfast',
        items: [
          { name: '蛋餅', amount: 1, unit: '份' },
          { name: '白飯', amount: 0.5, unit: '碗' },
        ],
      },
      { type: 'lunch', description: '外食' },
    ])
    expect(entrySchema.parse(entry)).toEqual(entry)
    expect(formToEntry(entryToForm(entry))).toEqual(entry)
  })

  it('份量是 0 或不是數字時不合法', () => {
    const form = emptyForm('2026-10-28')
    form.meals.snack = { items: [{ name: '堅果', amount: '0', unit: '份' }], note: '' }
    expect(entrySchema.safeParse(formToEntry(form)).success).toBe(false)
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

describe('isSameEntry', () => {
  const base = emptyForm('2026-10-28')

  it('改了任何會存下來的內容就不同', () => {
    expect(isSameEntry(base, { ...base, weightKg: '70' })).toBe(false)
    expect(
      isSameEntry(base, { ...base, meals: { ...base.meals, lunch: { items: [], note: '便當' } } }),
    ).toBe(false)
    expect(isSameEntry(base, { ...base, symptomItems: [{ name: '頭痛', severity: 1 }] })).toBe(
      false,
    )
  })

  it('只差前後空白或多了全空的排便列，存起來一樣，算沒有修改', () => {
    const saved = { ...base, notes: '早起' }
    expect(isSameEntry(saved, { ...saved, notes: '早起  ' })).toBe(true)
    expect(isSameEntry(saved, { ...saved, bowel: [{ time: '', bristol: '', note: '' }] })).toBe(
      true,
    )
  })

  it('改了又改回原值算沒有修改', () => {
    expect(isSameEntry(base, { ...base, weightKg: '' })).toBe(true)
  })
})

describe('當天沒有排便', () => {
  it('勾了且沒有排便紀錄時存成 noBowel，載入表單後仍是勾選', () => {
    const form = { ...emptyForm('2026-10-28'), noBowel: true }
    const entry = formToEntry(form)
    expect(entry.noBowel).toBe(true)
    expect(entrySchema.parse(entry)).toEqual(entry)
    expect(entryToForm(entry).noBowel).toBe(true)
  })

  it('有排便紀錄時不算數；只有全空的排便列不算紀錄', () => {
    const base = { ...emptyForm('2026-10-28'), noBowel: true }
    expect(
      formToEntry({ ...base, bowel: [{ time: '08:00', bristol: '', note: '' }] }).noBowel,
    ).toBeUndefined()
    expect(formToEntry({ ...base, bowel: [{ time: '', bristol: '', note: '' }] }).noBowel).toBe(
      true,
    )
  })

  it('舊紀錄沒有 noBowel，載入表單時是沒勾', () => {
    expect(entryToForm({ date: '2026-10-28', meals: [], bowel: [] }).noBowel).toBe(false)
  })
})
