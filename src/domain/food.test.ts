import { describe, expect, it } from 'vitest'
import type { Entry, MealType } from './entry'
import { filterFoods, parseFoodList, sortFoodsByUsage } from './food'

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
