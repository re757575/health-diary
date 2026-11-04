import { describe, expect, it } from 'vitest'
import { FOOD_UNITS } from './entry'
import { buildPhotoPrompt, guessMeal, parsePhotoMeal } from './photo-meal'

describe('buildPhotoPrompt', () => {
  it('說明輸出格式，並列出所有可用的單位', () => {
    const prompt = buildPhotoPrompt()
    expect(prompt).toContain('"items"')
    expect(prompt).toContain('"amount"')
    expect(prompt).toContain('"unit"')
    expect(prompt).toContain('"note"')
    for (const unit of FOOD_UNITS) expect(prompt).toContain(unit)
  })

  it('範例本身要能被 parsePhotoMeal 解析', () => {
    const example = /```json\n([\s\S]*?)\n```/.exec(buildPhotoPrompt())![1]!
    const result = parsePhotoMeal(example)
    expect(result).toMatchObject({ ok: true, meal: { note: '家裡煮' } })
  })

  it('有常吃的食物時請 AI 沿用同樣的名稱；沒有就不加這一段', () => {
    expect(buildPhotoPrompt(['燕麥', '香蕉'])).toContain('燕麥、香蕉')
    expect(buildPhotoPrompt([])).not.toContain('我常吃的食物')
  })

  it('常吃的食物太多時只列前面的', () => {
    const foods = Array.from({ length: 100 }, (_, i) => `食物${i + 1}`)
    const prompt = buildPhotoPrompt(foods)
    expect(prompt).toContain('食物60')
    expect(prompt).not.toContain('食物61、')
    expect(prompt).not.toContain('食物100')
  })
})

describe('parsePhotoMeal', () => {
  it('解析標準格式', () => {
    expect(
      parsePhotoMeal(
        '{"items":[{"name":"燕麥粥","amount":1,"unit":"碗"},{"name":"水煮蛋","amount":2,"unit":"顆"}],"note":"家裡煮"}',
      ),
    ).toEqual({
      ok: true,
      meal: {
        items: [
          { name: '燕麥粥', amount: '1', unit: '碗' },
          { name: '水煮蛋', amount: '2', unit: '顆' },
        ],
        note: '家裡煮',
      },
    })
  })

  it('包在程式碼區塊、前後有說明文字也能解析', () => {
    const reply =
      '好的，這是辨識結果 {參考}：\n```json\n{"items":[{"name":"香蕉","amount":1,"unit":"根"}],"note":null}\n```\n希望有幫助 [完]'
    expect(parsePhotoMeal(reply)).toEqual({
      ok: true,
      meal: { items: [{ name: '香蕉', amount: '1', unit: '根' }], note: '' },
    })
  })

  it('直接給陣列也可以', () => {
    expect(parsePhotoMeal('[{"name":"豆漿","amount":1,"unit":"杯"}]')).toMatchObject({
      ok: true,
      meal: { items: [{ name: '豆漿', amount: '1', unit: '杯' }] },
    })
  })

  it('份量寫成字串可以接受；缺少、不是數字或不是正數都當 1，沒有單位用「份」', () => {
    const result = parsePhotoMeal(
      JSON.stringify({
        items: [
          { name: 'A', amount: '1.5', unit: '碗' },
          { name: 'B', unit: ' ' },
          { name: 'C', amount: 0, unit: '個' },
          { name: 'D', amount: 'abc' },
          { name: 'E', amount: -2 },
        ],
      }),
    )
    expect(result).toMatchObject({ ok: true })
    if (!result.ok) return
    expect(result.meal.items).toEqual([
      { name: 'A', amount: '1.5', unit: '碗' },
      { name: 'B', amount: '1', unit: '份' },
      { name: 'C', amount: '1', unit: '個' },
      { name: 'D', amount: '1', unit: '份' },
      { name: 'E', amount: '1', unit: '份' },
    ])
  })

  it('名稱重複（含全形半形、大小寫）只留第一項；空白、過長或不是字串的略過', () => {
    const result = parsePhotoMeal(
      JSON.stringify({
        items: [
          { name: ' 豆漿 ', amount: 1, unit: '杯' },
          { name: '豆漿', amount: 2, unit: '杯' },
          { name: '拿鐵（小）', amount: 1, unit: '杯' },
          { name: '拿鐵(小)', amount: 1, unit: '杯' },
          { name: '', amount: 1, unit: '份' },
          { name: 'x'.repeat(31), amount: 1, unit: '份' },
          { name: 123 },
          null,
        ],
      }),
    )
    expect(result).toMatchObject({ ok: true })
    if (!result.ok) return
    expect(result.meal.items.map((i) => i.name)).toEqual(['豆漿', '拿鐵（小）'])
    expect(result.meal.items[0]!.amount).toBe('1')
  })

  it('不是 JSON、沒有 items、items 為空或全部不可用都回傳錯誤', () => {
    for (const text of ['', '我看不到照片', '{壞掉的 json', '{"foo":1}', '{"items":"燕麥"}']) {
      expect(parsePhotoMeal(text)).toMatchObject({ ok: false })
    }
    expect(parsePhotoMeal('{"items":[]}')).toEqual({
      ok: false,
      error: 'AI 沒有在照片裡找到食物',
    })
    expect(parsePhotoMeal('{"items":[{"name":""}]}')).toEqual({
      ok: false,
      error: '沒有可以使用的食物項目',
    })
  })
})

describe('guessMeal', () => {
  const at = (hour: number) => guessMeal(new Date(2026, 9, 28, hour))

  it('依時間猜餐別，其餘時段算點心', () => {
    expect([7, 12, 19, 15, 22, 3].map(at)).toEqual([
      'breakfast',
      'lunch',
      'dinner',
      'snack',
      'snack',
      'snack',
    ])
  })

  it('邊界：10 點算午餐、15 點起不是午餐、17 點算晚餐', () => {
    expect([5, 10, 14, 15, 16, 17, 21].map(at)).toEqual([
      'breakfast',
      'lunch',
      'lunch',
      'snack',
      'snack',
      'dinner',
      'snack',
    ])
  })
})
