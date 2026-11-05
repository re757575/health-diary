import { DEFAULT_FOOD_UNIT, FOOD_UNITS, type MealType } from './entry'
import { MAX_FOOD_NAME_LENGTH, foodKey } from './food'
import type { FoodItemFormValues } from './form'

/** 傳給 AI 的照片長邊上限（像素）：夠 AI 認出食物，檔案也小得多，分享和上傳都快 */
export const PHOTO_MAX_SIDE = 1280

/** 提示詞裡最多列出幾個常吃的食物，清單很長時只列前面（已依吃的次數排序） */
const MAX_KNOWN_FOODS = 60

/** AI 回覆的 JSON 長相，提示詞裡的範例和解析都以它為準 */
const EXAMPLE = `{
  "items": [
    { "name": "燕麥粥", "amount": 1, "unit": "碗" },
    { "name": "水煮蛋", "amount": 2, "unit": "顆" }
  ],
  "note": "家裡煮"
}`

/**
 * 產生請 AI 看食物照片、回覆固定格式 JSON 的提示詞。
 * @param knownFoods 常吃的食物；照片裡的食物和清單中的相同時，請 AI 沿用同樣的名稱，之後的統計才會算在一起
 */
export function buildPhotoPrompt(knownFoods: readonly string[] = []): string {
  const known = knownFoods.slice(0, MAX_KNOWN_FOODS)
  return [
    '你是一位飲食紀錄助理。請看我附上的食物照片，列出照片裡吃的每一項食物與估計的份量，並且「只」回覆下面格式的 JSON，不要加任何說明文字。',
    `# 輸出格式\n\`\`\`json\n${EXAMPLE}\n\`\`\``,
    [
      '# 欄位規則',
      '- items：照片裡的每一項食物各一筆；一道菜（例如「番茄炒蛋」）寫成一筆，不要拆成食材。照片裡沒有食物時 items 給空陣列 []。',
      '- name：繁體中文的常見名稱，簡短（不超過 30 字），不要寫品牌、形容詞或製作方式（寫「白飯」，不要寫「香噴噴的白飯」）。',
      '- amount：數字（不要加引號、不要寫分數），依照片估計的份量，可以有小數，例如 0.5。',
      `- unit：只能從這些單位選一個：${FOOD_UNITS.join('、')}。沒有合適的就用「${DEFAULT_FOOD_UNIT}」。`,
      '- note：整餐的備註，只有照片明顯看得出來才填（例如便當盒、餐廳、自己煮的家常菜），否則給 null。',
    ].join('\n'),
    ...(known.length > 0
      ? [
          `# 我常吃的食物\n照片裡的食物如果和下列其中一項相同，name 請直接用清單裡的寫法：\n${known.join('、')}`,
        ]
      : []),
    '分不清楚是什麼食物時，請寫最接近的猜測，我會再自己修改。',
  ].join('\n\n')
}

export interface PhotoMeal {
  /** 辨識出的食物，已清理過：名稱不重複、份量為正數 */
  items: FoodItemFormValues[]
  /** 整餐的備註；AI 沒填就是空字串 */
  note: string
}

export type PhotoMealResult = { ok: true; meal: PhotoMeal } | { ok: false; error: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** 有 items 的物件，或直接就是食物陣列 */
const looksLikeMeal = (value: unknown) =>
  Array.isArray(value) || (isRecord(value) && 'items' in value)

/**
 * 貼上的內容常包在 ```json 程式碼區塊，或前後夾著說明文字（說明裡也可能有 { 或 [ ）。
 * 從每個開頭符號試著往後解析，取第一個像食物 JSON 的
 */
function extractJson(text: string): unknown {
  for (let start = text.search(/[{[]/); start !== -1;) {
    const close = text[start] === '{' ? '}' : ']'
    for (let end = text.lastIndexOf(close); end > start; end = text.lastIndexOf(close, end - 1)) {
      try {
        const value: unknown = JSON.parse(text.slice(start, end + 1))
        if (looksLikeMeal(value)) return value
      } catch {
        // 繼續往前找結尾
      }
    }
    const next = text.slice(start + 1).search(/[{[]/)
    start = next === -1 ? -1 : start + 1 + next
  }
  throw new Error('no json')
}

/** AI 有時會把數字寫成字串（"1.5"）；無法解析或不是正數就當 1 份 */
function toAmount(value: unknown): string {
  const n = typeof value === 'string' ? Number(value.trim()) : value
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? String(n) : '1'
}

function toItem(raw: unknown): FoodItemFormValues | undefined {
  if (!isRecord(raw) || typeof raw.name !== 'string') return undefined
  const name = raw.name.trim()
  if (name === '' || name.length > MAX_FOOD_NAME_LENGTH) return undefined
  const unit = typeof raw.unit === 'string' ? raw.unit.trim() : ''
  return { name, amount: toAmount(raw.amount), unit: unit || DEFAULT_FOOD_UNIT }
}

/**
 * 解析 AI 回覆的食物 JSON。格式寬鬆處理（程式碼區塊、前後說明、數字寫成字串、
 * 直接給陣列都可以），但至少要有一項能用的食物，否則回傳錯誤訊息。
 * 名稱重複（含全形半形、大小寫不同）的只留第一項
 */
export function parsePhotoMeal(text: string): PhotoMealResult {
  let json: unknown
  try {
    json = extractJson(text)
  } catch {
    return { ok: false, error: '找不到 JSON，請把 AI 的回覆整段貼上' }
  }
  const rawItems = Array.isArray(json) ? json : isRecord(json) ? json.items : undefined
  if (!Array.isArray(rawItems)) {
    return { ok: false, error: '格式不符：找不到 items 陣列，請確認 AI 照提示詞的格式回覆' }
  }

  const seen = new Set<string>()
  const items: FoodItemFormValues[] = []
  for (const raw of rawItems) {
    const item = toItem(raw)
    if (!item || seen.has(foodKey(item.name))) continue
    seen.add(foodKey(item.name))
    items.push(item)
  }
  if (items.length === 0) {
    return {
      ok: false,
      error: rawItems.length === 0 ? 'AI 沒有在照片裡找到食物' : '沒有可以使用的食物項目',
    }
  }

  const note = isRecord(json) && typeof json.note === 'string' ? json.note.trim() : ''
  return { ok: true, meal: { items, note } }
}

/** 依時間猜這張照片是哪一餐，給匯入時的預設選項（使用者可以改） */
export function guessMeal(now: Date): MealType {
  const hour = now.getHours()
  if (hour >= 5 && hour < 10) return 'breakfast'
  if (hour >= 10 && hour < 15) return 'lunch'
  if (hour >= 17 && hour < 21) return 'dinner'
  return 'snack'
}

/** 長邊超過 maxSide 就等比例縮小，沒超過維持原尺寸（不放大） */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number,
): { width: number; height: number } {
  const longSide = Math.max(width, height)
  if (longSide <= maxSide) return { width, height }
  const scale = maxSide / longSide
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}
