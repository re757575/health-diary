import { z } from 'zod'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type MealType = (typeof MEAL_TYPES)[number]

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '點心／其他',
}

/** 睡眠品質 1–5 各分數的說明，索引 0 對應 1 分 */
export const SLEEP_QUALITY_DESCRIPTIONS = [
  '很差：難入睡或一直醒來，起床很疲憊',
  '不太好：睡得斷斷續續，起床仍想睡',
  '普通：睡得還可以，沒有特別好或差',
  '不錯：好入睡，起床精神不錯',
  '很好：一覺到天亮，起床神清氣爽',
] as const

/** 心情／精神 1–5 各分數的說明，索引 0 對應 1 分 */
export const MOOD_DESCRIPTIONS = [
  '很低落：情緒很差，精神委靡',
  '偏低：有些煩悶或疲倦',
  '普通：平穩，沒有特別的感受',
  '不錯：心情輕鬆，精神良好',
  '很好：心情愉快，精神充沛',
] as const

/** 布里斯托大便分類 1–7 各型的說明，索引 0 對應第 1 型 */
export const BRISTOL_DESCRIPTIONS = [
  '第 1 型：一顆顆分開的硬球，像堅果，很難排出（嚴重便秘）',
  '第 2 型：香腸狀但由硬塊黏成，表面凹凸（輕度便秘）',
  '第 3 型：香腸狀，表面有裂痕（正常）',
  '第 4 型：香腸或蛇狀，表面光滑柔軟（理想）',
  '第 5 型：柔軟的團塊，邊緣清楚，容易排出（纖維偏少）',
  '第 6 型：糊狀，邊緣毛糙，沒有固定形狀（輕度腹瀉）',
  '第 7 型：水狀，完全沒有固體（嚴重腹瀉）',
] as const

const mealSchema = z.object({
  type: z.enum(MEAL_TYPES),
  description: z.string(),
})

const bowelSchema = z.object({
  time: z.string().regex(HHMM).optional(),
  /** 布里斯托大便分類法 1（硬塊）～ 7（水狀） */
  bristol: z.number().int().min(1).max(7).optional(),
  note: z.string().optional(),
})

const sleepSchema = z.object({
  bedtime: z.string().regex(HHMM).optional(),
  wakeTime: z.string().regex(HHMM).optional(),
  /** 自評睡眠品質 1（很差）～ 5（很好） */
  quality: z.number().int().min(1).max(5).optional(),
})

/** 每日一筆，以日期（YYYY-MM-DD）為主鍵 */
export const entrySchema = z.object({
  date: z.string().regex(DATE),
  weightKg: z.number().positive().optional(),
  sleep: sleepSchema.optional(),
  meals: z.array(mealSchema),
  bowel: z.array(bowelSchema),
  waterMl: z.number().int().nonnegative().optional(),
  /** 自評心情／精神 1（很差）～ 5（很好） */
  mood: z.number().int().min(1).max(5).optional(),
  symptoms: z.string().optional(),
  notes: z.string().optional(),
})

export type Entry = z.infer<typeof entrySchema>
export type Meal = z.infer<typeof mealSchema>
export type Bowel = z.infer<typeof bowelSchema>

/** 睡眠時數（小時）。跨午夜時自動加一天；缺少任一時間回傳 undefined */
export function sleepHours(sleep: Entry['sleep']): number | undefined {
  if (!sleep?.bedtime || !sleep.wakeTime) return undefined
  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    return h * 60 + m
  }
  const diff = toMinutes(sleep.wakeTime) - toMinutes(sleep.bedtime)
  const minutes = diff <= 0 ? diff + 24 * 60 : diff
  return Math.round((minutes / 60) * 10) / 10
}

/** 超過這個時數多半是 12 小時制的上午／下午選錯（例如入睡 23:50 填成 11:50），儲存前要請使用者確認 */
export const LONG_SLEEP_HOURS = 12
