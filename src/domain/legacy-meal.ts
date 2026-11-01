import { DEFAULT_FOOD_UNIT, type FoodItem, type Meal } from './entry'

/**
 * 把舊版（v7 之前）整段文字的餐點，拆成一項項的食物與份量。
 * 只用在舊資料：資料庫升版與匯入舊版備份時各做一次；新格式的餐點只有備註時是使用者刻意寫的，不能再拆。
 *
 * 依實際的寫法：用空格、頓號、逗號、換行或「+」分隔；份量可能寫在後面（白飯1碗、蒸餃x9、香蕉一小根）
 * 或前面（一小塊重乳酪蛋糕）；「外食：」「便利商店」「麥當勞」這類地點與來源移到備註。
 * 「小、中、大」沒有對應的單位，留在名稱裡：魯肉飯小 → 魯肉飯（小）、香蕉一小根 → 香蕉（小） 1 根
 */

/** 地點與來源：單獨出現或寫在食物前面時，移到備註 */
const PLACES = [
  '外食',
  '外送',
  '家裡煮',
  '自己煮',
  '便利商店',
  '超商',
  '早餐店',
  '麥當勞',
  '肯德基',
  '摩斯',
  '星巴克',
  '餐廳',
  '自助餐',
]

/** 舊資料裡會出現的量詞；不在下拉選單的也照樣保留 */
const UNIT_WORDS = '份碗盤杯瓶顆個片塊根條盒包匙粒支隻'
const NUMBER_WORDS: Record<string, number> = {
  半: 0.5,
  一: 1,
  二: 2,
  兩: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
}
const NUMBER = `(\\d+(?:\\.\\d+)?|[${Object.keys(NUMBER_WORDS).join('')}])`
const SIZE = '([小中大]?)'

/** 後面的份量：白飯1碗、香蕉一小根 */
const TRAILING_AMOUNT = new RegExp(`^(.+?)${NUMBER}${SIZE}([${UNIT_WORDS}])$`)
/** 後面的倍數：蒸餃x9、餅乾*2 */
const TRAILING_TIMES = new RegExp(`^(.+?)\\s*[x×*＊]\\s*(\\d+(?:\\.\\d+)?)$`)
/** 前面的份量：一小塊重乳酪蛋糕 */
const LEADING_AMOUNT = new RegExp(`^${NUMBER}${SIZE}([${UNIT_WORDS}])(.+)$`)
/** 只寫大小：魯肉飯小、薯條小 */
const TRAILING_SIZE = /^(.{2,})([小中大])$/

const toNumber = (text: string) => NUMBER_WORDS[text] ?? Number(text)

/** 名稱加上大小：魯肉飯 + 小 → 魯肉飯（小）；沒有大小就是原名 */
const withSize = (name: string, size: string | undefined) =>
  size ? `${name.trim()}（${size}）` : name.trim()

/** 一項文字 → 食物；拆不出名稱時回傳 undefined */
function parseItem(text: string): FoodItem | undefined {
  let match = text.match(TRAILING_TIMES)
  if (match) return { name: match[1]!.trim(), amount: Number(match[2]), unit: DEFAULT_FOOD_UNIT }
  match = text.match(TRAILING_AMOUNT)
  if (match) {
    return { name: withSize(match[1]!, match[3]), amount: toNumber(match[2]!), unit: match[4]! }
  }
  match = text.match(LEADING_AMOUNT)
  if (match) {
    return { name: withSize(match[4]!, match[2]), amount: toNumber(match[1]!), unit: match[3]! }
  }
  match = text.match(TRAILING_SIZE)
  const name = match ? withSize(match[1]!, match[2]) : text.trim()
  return name ? { name, amount: 1, unit: DEFAULT_FOOD_UNIT } : undefined
}

/** 把文字前面的地點拆出來：「便利商店麵包」→ 便利商店 + 麵包、「早餐店的吐司漢堡」→ 早餐店 + 吐司漢堡 */
function splitPlace(text: string): { place?: string; rest: string } {
  const place = PLACES.find((p) => text.startsWith(p))
  if (!place) return { rest: text }
  return { place, rest: text.slice(place.length).replace(/^的/, '') }
}

export function convertLegacyMeal(meal: Meal): Meal {
  if (meal.items?.length || !meal.description?.trim()) return meal

  const notes: string[] = []
  const items: FoodItem[] = []
  for (const raw of meal.description.split(/[\s、,，+＋]+/).filter(Boolean)) {
    // 「外食：蒸餃x9」：冒號前面是備註
    const colon = raw.search(/[：:]/)
    let text = raw
    if (colon >= 0) {
      const label = raw.slice(0, colon).trim()
      if (label) notes.push(label)
      text = raw.slice(colon + 1).trim()
      if (!text) continue
    }
    const { place, rest } = splitPlace(text)
    if (place) notes.push(place)
    if (!rest) continue
    const item = parseItem(rest)
    if (item) items.push(item)
  }

  const note = [...new Set(notes)].join('、')
  return {
    type: meal.type,
    ...(items.length > 0 && { items }),
    ...(note && { description: note }),
  }
}
