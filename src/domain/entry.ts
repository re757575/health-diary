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
