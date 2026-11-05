import { describe, expect, it } from 'vitest'
import { entrySchema } from './entry'
import {
  addFoodItems,
  addWater,
  emptyForm,
  entryToForm,
  fillEmptyMeals,
  formToEntry,
  isSameEntry,
  moveFoodItem,
  removeFoodItem,
  stepFoodItem,
  toggleFoodItem,
  shiftDate,
  toDateString,
  toTimeString,
  withWeekday,
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

describe('withWeekday', () => {
  it('日期後面加上星期幾', () => {
    expect(withWeekday('2026-10-28')).toBe('2026-10-28（三）')
    expect(withWeekday('2026-11-01')).toBe('2026-11-01（日）')
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

describe('removeFoodItem', () => {
  it('依位置移除，同名的只移除指定那一項', () => {
    const item = (name: string) => ({ name, amount: '1', unit: '份' })
    const meal = { items: [item('燕麥'), item('燕麥'), item('香蕉')], note: '' }
    expect(removeFoodItem(meal, 1).items).toEqual([item('燕麥'), item('香蕉')])
  })
})

describe('moveFoodItem', () => {
  const item = (name: string, amount = '1', unit = '份') => ({ name, amount, unit })
  const meals = () => ({
    breakfast: { items: [item('燕麥', '2', '碗'), item('香蕉'), item('豆漿')], note: '家裡' },
    lunch: { items: [item('便當'), item('湯')], note: '外食' },
    dinner: { items: [], note: '' },
    snack: { items: [], note: '' },
  })
  const names = (meal: { items: { name: string }[] }) => meal.items.map((i) => i.name)

  describe('移到另一餐', () => {
    it('沒指定位置就接在最後面，份量與單位照舊，備註不動', () => {
      const result = moveFoodItem(meals(), 'breakfast', 0, 'lunch')
      expect(result.status).toBe('moved')
      expect(result.meals.breakfast).toEqual({ items: [item('香蕉'), item('豆漿')], note: '家裡' })
      expect(result.meals.lunch).toEqual({
        items: [item('便當'), item('湯'), item('燕麥', '2', '碗')],
        note: '外食',
      })
      expect(result).toMatchObject({ at: { meal: 'lunch', index: 2 } })
    })

    it('指定位置就插在那裡；超出範圍的位置視為最前或最後', () => {
      expect(names(moveFoodItem(meals(), 'breakfast', 0, 'lunch', 1).meals.lunch)).toEqual([
        '便當',
        '燕麥',
        '湯',
      ])
      expect(names(moveFoodItem(meals(), 'breakfast', 0, 'lunch', 0).meals.lunch)).toEqual([
        '燕麥',
        '便當',
        '湯',
      ])
      expect(names(moveFoodItem(meals(), 'breakfast', 0, 'lunch', 99).meals.lunch)).toEqual([
        '便當',
        '湯',
        '燕麥',
      ])
    })

    it('移到空的一餐', () => {
      const result = moveFoodItem(meals(), 'lunch', 1, 'dinner', 0)
      expect(names(result.meals.dinner)).toEqual(['湯'])
      expect(names(result.meals.lunch)).toEqual(['便當'])
    })

    it('目標那餐已有同名食物（全形半形、大小寫視為相同）：不移動，避免重複', () => {
      const before = meals()
      before.lunch.items.push(item('ＢＡＮＡＮＡ'))
      before.breakfast.items[1] = item('banana')
      const result = moveFoodItem(before, 'breakfast', 1, 'lunch')
      expect(result.status).toBe('duplicate')
      expect(result.meals).toBe(before)
    })
  })

  describe('同一餐內重新排序', () => {
    // 位置是「插在第幾項前面」（0 是最前面、長度是最後面），以拖曳前的清單計算
    it.each([
      [0, 2, ['香蕉', '燕麥', '豆漿']],
      [0, 3, ['香蕉', '豆漿', '燕麥']],
      [2, 0, ['豆漿', '燕麥', '香蕉']],
      [2, 1, ['燕麥', '豆漿', '香蕉']],
      [1, 0, ['香蕉', '燕麥', '豆漿']],
    ])('第 %i 項插到位置 %i', (index, at, expected) => {
      const result = moveFoodItem(meals(), 'breakfast', index, 'breakfast', at)
      expect(result.status).toBe('moved')
      expect(names(result.meals.breakfast)).toEqual(expected)
      expect(result.meals.breakfast.note).toBe('家裡')
      expect(result).toMatchObject({ at: { meal: 'breakfast' } })
    })

    it('份量與單位跟著那一項走', () => {
      const result = moveFoodItem(meals(), 'breakfast', 0, 'breakfast', 3)
      expect(result.meals.breakfast.items[2]).toEqual(item('燕麥', '2', '碗'))
      expect(result).toMatchObject({ at: { meal: 'breakfast', index: 2 } })
    })

    it('放在自己前面或後面（位置沒變）、位置不存在：不變', () => {
      const before = meals()
      expect(moveFoodItem(before, 'breakfast', 1, 'breakfast', 1)).toEqual({
        meals: before,
        status: 'unchanged',
      })
      expect(moveFoodItem(before, 'breakfast', 1, 'breakfast', 2).status).toBe('unchanged')
      expect(moveFoodItem(before, 'dinner', 0, 'lunch').status).toBe('unchanged')
    })
  })
})

describe('stepFoodItem', () => {
  const item = (name: string) => ({ name, amount: '1', unit: '份' })
  const meals = () => ({
    breakfast: { items: [item('燕麥'), item('香蕉')], note: '' },
    lunch: { items: [item('便當'), item('湯')], note: '' },
    dinner: { items: [] as ReturnType<typeof item>[], note: '' },
    snack: { items: [] as ReturnType<typeof item>[], note: '' },
  })
  const names = (meal: { items: { name: string }[] }) => meal.items.map((i) => i.name)

  it('餐內還有空間就在同一餐裡往上或往下一格', () => {
    const down = stepFoodItem(meals(), 'breakfast', 0, 1)
    expect(names(down.meals.breakfast)).toEqual(['香蕉', '燕麥'])
    expect(down).toMatchObject({ status: 'moved', at: { meal: 'breakfast', index: 1 } })

    const up = stepFoodItem(meals(), 'lunch', 1, -1)
    expect(names(up.meals.lunch)).toEqual(['湯', '便當'])
    expect(up).toMatchObject({ at: { meal: 'lunch', index: 0 } })
  })

  it('已經在最後一項再往下：移到後一餐的最前面', () => {
    const result = stepFoodItem(meals(), 'breakfast', 1, 1)
    expect(names(result.meals.breakfast)).toEqual(['燕麥'])
    expect(names(result.meals.lunch)).toEqual(['香蕉', '便當', '湯'])
    expect(result).toMatchObject({ at: { meal: 'lunch', index: 0 } })
  })

  it('已經在第一項再往上：移到前一餐的最後面', () => {
    const result = stepFoodItem(meals(), 'lunch', 0, -1)
    expect(names(result.meals.breakfast)).toEqual(['燕麥', '香蕉', '便當'])
    expect(result).toMatchObject({ at: { meal: 'breakfast', index: 2 } })
  })

  it('第一餐的第一項往上、最後一餐的最後一項往下：沒有地方可去，不變', () => {
    const before = meals()
    expect(stepFoodItem(before, 'breakfast', 0, -1).status).toBe('unchanged')
    before.snack.items.push(item('餅乾'))
    expect(stepFoodItem(before, 'snack', 0, 1).status).toBe('unchanged')
  })

  it('要移到前後一餐，但那一餐已有同名食物：不移動並回報重複', () => {
    const before = meals()
    before.breakfast.items = [item('燕麥')]
    before.lunch.items.push(item('燕麥'))
    const result = stepFoodItem(before, 'breakfast', 0, 1)
    expect(result.status).toBe('duplicate')
    expect(result.meals).toBe(before)
  })
})

describe('addFoodItems', () => {
  const item = (name: string, amount = '1', unit = '份') => ({ name, amount, unit })

  it('接在原有的食物後面；這餐已有的名稱略過，不蓋掉已調整的份量', () => {
    const meal = { items: [item('燕麥', '2', '碗')], note: '' }
    const result = addFoodItems(meal, [item('燕麥'), item('香蕉', '1', '根'), item('Ｍilk')])
    expect(result.meal.items.map((i) => i.name)).toEqual(['燕麥', '香蕉', 'Ｍilk'])
    expect(result.meal.items[0]).toEqual(item('燕麥', '2', '碗'))
    expect(result).toMatchObject({ added: 2, skipped: 1 })
  })

  it('名稱用全形半形、大小寫不同寫法也算已有', () => {
    const result = addFoodItems({ items: [item('milk')], note: '' }, [item('ＭＩＬＫ')])
    expect(result).toMatchObject({ added: 0, skipped: 1 })
  })

  it('備註接在原本的備註後面；已經包含或沒有就不動', () => {
    const base = { items: [], note: '' }
    expect(addFoodItems(base, [], '家裡煮').meal.note).toBe('家裡煮')
    expect(addFoodItems({ ...base, note: '外食' }, [], '便當').meal.note).toBe('外食；便當')
    expect(addFoodItems({ ...base, note: '外食、便當' }, [], '便當').meal.note).toBe('外食、便當')
    expect(addFoodItems({ ...base, note: '外食' }, [], '  ').meal.note).toBe('外食')
  })

  it('不會改到傳入的物件', () => {
    const items = [item('香蕉')]
    const result = addFoodItems({ items: [], note: '' }, items)
    result.meal.items[0]!.amount = '9'
    expect(items[0]!.amount).toBe('1')
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
