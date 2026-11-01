import { describe, expect, it } from 'vitest'
import type { Meal } from './entry'
import { convertLegacyMeal } from './legacy-meal'

const convert = (description: string) => convertLegacyMeal({ type: 'lunch', description })
const item = (name: string, amount = 1, unit = '份') => ({ name, amount, unit })

// 以下都是實際舊紀錄裡的寫法
describe('convertLegacyMeal', () => {
  it('用空格分隔；沒寫份量的是 1 份', () => {
    expect(convert('豆漿 鮪魚蛋餅')).toEqual({
      type: 'lunch',
      items: [item('豆漿'), item('鮪魚蛋餅')],
    })
  })

  it('份量寫在後面：數字或國字，單位照原本的；「小」留在名稱裡', () => {
    expect(convert('白飯1碗 碎瘦肉燉豆腐 青菜一碗 蘋果一顆 香蕉一小根').items).toEqual([
      item('白飯', 1, '碗'),
      item('碎瘦肉燉豆腐'),
      item('青菜', 1, '碗'),
      item('蘋果', 1, '顆'),
      item('香蕉（小）', 1, '根'),
    ])
  })

  it('倍數寫法 x9、*2；份量寫在前面；大小留在名稱裡', () => {
    expect(convert('蒸餃x9 汽車保養廠餅乾*2 一小塊重乳酪蛋糕 魯肉飯小').items).toEqual([
      item('蒸餃', 9),
      item('汽車保養廠餅乾', 2),
      item('重乳酪蛋糕（小）', 1, '塊'),
      item('魯肉飯（小）'),
    ])
  })

  it('冒號前面、單獨的地點、食物前面的地點都移到備註，不重複', () => {
    expect(convert('外食：蒸餃x9 魯肉飯小 魯蛋 豬血湯')).toEqual({
      type: 'lunch',
      items: [item('蒸餃', 9), item('魯肉飯（小）'), item('魯蛋'), item('豬血湯')],
      description: '外食',
    })
    expect(convert('便利商店 豆酥烤魚鮮蔬餐盒 無糖濃豆漿+濃縮蛋白粉 便利商店麵包')).toEqual({
      type: 'lunch',
      items: [item('豆酥烤魚鮮蔬餐盒'), item('無糖濃豆漿'), item('濃縮蛋白粉'), item('麵包')],
      description: '便利商店',
    })
    expect(convert('早餐店的吐司漢堡').items).toEqual([item('吐司漢堡')])
    expect(convert('麥當勞 薯條小 綠茶').description).toBe('麥當勞')
  })

  it('中、大也留在名稱裡；只有一個字的不當成大小', () => {
    expect(convert('薯條中 可樂大 2杯中豆漿').items).toEqual([
      item('薯條（中）'),
      item('可樂（大）'),
      item('中豆漿', 2, '杯'),
    ])
    expect(convert('小').items).toEqual([item('小')])
  })

  it('換行也是分隔；頓號、逗號照樣認得', () => {
    expect(convert('便利商店增肌蛋白餐 無糖豆漿+濃縮乳清\n芭樂、奇異果').items).toEqual([
      item('增肌蛋白餐'),
      item('無糖豆漿'),
      item('濃縮乳清'),
      item('芭樂'),
      item('奇異果'),
    ])
  })

  it('已經有食物項目、或沒有文字的餐點不動', () => {
    const structured: Meal = { type: 'dinner', items: [item('燕麥')], description: '外食' }
    expect(convertLegacyMeal(structured)).toBe(structured)
    const empty: Meal = { type: 'dinner', description: '  ' }
    expect(convertLegacyMeal(empty)).toBe(empty)
  })
})
