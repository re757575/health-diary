import { describe, expect, it } from 'vitest'
import type { Entry, MealType } from './entry'
import {
  filterFoods,
  foodKey,
  foodsToRemember,
  formatFoodList,
  parseFoodList,
  sortFoodsByUsage,
  uniqueFoods,
} from './food'

describe('parseFoodList', () => {
  it('一行一個，或用逗號、頓號、分號、空格、Tab 分隔都可以；保留順序、去掉重複與空白', () => {
    expect(
      parseFoodList('燕麥\n 香蕉 \r\n\n無糖豆漿,雞胸肉，地瓜、香蕉;茶葉蛋\t蘋果 堅果'),
    ).toEqual(['燕麥', '香蕉', '無糖豆漿', '雞胸肉', '地瓜', '茶葉蛋', '蘋果', '堅果'])
  })

  it('CSV 的引號會去掉；超過 30 字的略過', () => {
    expect(parseFoodList(`"燕麥","香蕉"\n${'很長'.repeat(20)}`)).toEqual(['燕麥', '香蕉'])
  })
})

describe('filterFoods', () => {
  it('依輸入的字篩選，不分大小寫；沒輸入時全部回傳', () => {
    const foods = ['豆漿', '無糖豆漿', '燕麥', 'DHC 乳清']
    expect(filterFoods(foods, '豆')).toEqual(['豆漿', '無糖豆漿'])
    expect(filterFoods(foods, 'dhc')).toEqual(['DHC 乳清'])
    expect(filterFoods(foods, '  ')).toEqual(foods)
  })
})

describe('sortFoodsByUsage', () => {
  const entry = (...meals: [MealType, ...string[]][]): Entry => ({
    date: '2026-10-28',
    meals: meals.map(([type, ...names]) => ({
      type,
      items: names.map((name) => ({ name, amount: 1, unit: '份' })),
    })),
    bowel: [],
  })
  const entries = [
    entry(['breakfast', '燕麥', '豆漿'], ['lunch', '地瓜', '地瓜']),
    entry(['lunch', '地瓜', '雞胸肉'], ['dinner', '雞胸肉']),
  ]

  it('吃過越多次越前面，同一餐重複只算一次；次數相同維持原順序', () => {
    expect(sortFoodsByUsage(['香蕉', '燕麥', '雞胸肉', '地瓜'], entries)).toEqual([
      '雞胸肉',
      '地瓜',
      '燕麥',
      '香蕉',
    ])
  })

  it('給了餐別就只算那一餐', () => {
    expect(sortFoodsByUsage(['香蕉', '雞胸肉', '豆漿', '燕麥'], entries, 'breakfast')).toEqual([
      '豆漿',
      '燕麥',
      '香蕉',
      '雞胸肉',
    ])
  })
})

describe('匯出食物清單', () => {
  it('一行一個；匯出的內容再匯入得到相同的清單', () => {
    const foods = ['燕麥', '魯肉飯（小）', '無糖豆漿']
    expect(formatFoodList(foods)).toBe('燕麥\n魯肉飯（小）\n無糖豆漿\n')
    expect(parseFoodList(formatFoodList(foods))).toEqual(foods)
    expect(formatFoodList([])).toBe('')
  })
})

describe('foodsToRemember', () => {
  it('不重複；名稱有空格或過長的不放進清單，確保匯出再匯入不會被拆開', () => {
    expect(foodsToRemember(['燕麥', ' 燕麥 ', 'DHC 乳清', '', '很長'.repeat(20), '香蕉'])).toEqual([
      '燕麥',
      '香蕉',
    ])
  })
})

describe('排除重複的食物', () => {
  it('全形半形、大小寫、空白的差異都算同一個', () => {
    expect(foodKey('魯肉飯（小）')).toBe(foodKey('魯肉飯(小)'))
    expect(foodKey('ＤＨＣ乳清')).toBe(foodKey('dhc 乳清'))
    expect(foodKey('豆漿')).not.toBe(foodKey('無糖豆漿'))
  })

  it('保留先出現的寫法與順序；已在清單裡的也略過', () => {
    expect(uniqueFoods(['魯肉飯（小）', '燕麥', '魯肉飯(小)', 'ＤＨＣ乳清', 'DHC乳清'])).toEqual([
      '魯肉飯（小）',
      '燕麥',
      'ＤＨＣ乳清',
    ])
    expect(uniqueFoods(['燕麥', 'Banana', '地瓜'], ['banana', '燕麥'])).toEqual(['地瓜'])
  })

  it('匯入清單時，同一份裡寫法稍有不同的重複也去掉', () => {
    expect(parseFoodList('魯肉飯（小）\n魯肉飯(小)\n燕麥\n燕麥')).toEqual(['魯肉飯（小）', '燕麥'])
  })
})
