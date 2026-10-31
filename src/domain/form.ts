import { MEAL_TYPES, type Entry, type MealType, type SymptomItem } from './entry'

export interface BowelFormValues {
  time: string
  bristol: string
  note: string
}

/** 表單欄位一律是字串（對應 input 的值），空字串代表沒填 */
export interface FormValues {
  date: string
  weightKg: string
  bedtime: string
  wakeTime: string
  sleepQuality: string
  meals: Record<MealType, string>
  bowel: BowelFormValues[]
  waterMl: string
  mood: string
  symptomItems: SymptomItem[]
  symptoms: string
  notes: string
}

/** 本地時區的 YYYY-MM-DD（不能用 toISOString，會換算成 UTC 而差一天） */
export function toDateString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 把 YYYY-MM-DD 前後移動幾天（以本地日曆計算，跨月、跨年、閏年都正確） */
export function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  return toDateString(new Date(year!, month! - 1, day! + days))
}

/** 本地時間的 HH:mm，給時間欄位的「現在」按鈕用 */
export function toTimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 飲水量欄位加上 ml；欄位空白當作 0 */
export function addWater(current: string, ml: number): string {
  return String((Number(current) || 0) + ml)
}

/** 把另一天的餐點補進還空著的餐別，已有內容的不動。回傳新的餐點與補了幾個餐別 */
export function fillEmptyMeals(
  current: FormValues['meals'],
  source: FormValues['meals'],
): { meals: FormValues['meals']; filled: number } {
  const meals = { ...current }
  let filled = 0
  for (const type of MEAL_TYPES) {
    if (meals[type].trim() === '' && source[type].trim() !== '') {
      meals[type] = source[type]
      filled++
    }
  }
  return { meals, filled }
}

export function emptyForm(date: string): FormValues {
  return {
    date,
    weightKg: '',
    bedtime: '',
    wakeTime: '',
    sleepQuality: '',
    meals: { breakfast: '', lunch: '', dinner: '', snack: '' },
    bowel: [],
    waterMl: '',
    mood: '',
    symptomItems: [],
    symptoms: '',
    notes: '',
  }
}

const toNumber = (value: string): number | undefined =>
  value.trim() === '' ? undefined : Number(value)

const toText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value.trim()

/** 表單 → Entry：空欄位省略，全空的排便列捨棄。數值是否合法交給 entrySchema 驗證 */
export function formToEntry(form: FormValues): Entry {
  const sleep = {
    bedtime: toText(form.bedtime),
    wakeTime: toText(form.wakeTime),
    quality: toNumber(form.sleepQuality),
  }
  const hasSleep = Object.values(sleep).some((v) => v !== undefined)

  return {
    date: form.date,
    weightKg: toNumber(form.weightKg),
    sleep: hasSleep ? sleep : undefined,
    meals: MEAL_TYPES.flatMap((type) => {
      const description = form.meals[type].trim()
      return description ? [{ type, description }] : []
    }),
    bowel: form.bowel
      .map((b) => ({ time: toText(b.time), bristol: toNumber(b.bristol), note: toText(b.note) }))
      .filter((b) => b.time !== undefined || b.bristol !== undefined || b.note !== undefined),
    waterMl: toNumber(form.waterMl),
    mood: toNumber(form.mood),
    symptomItems: form.symptomItems.length > 0 ? form.symptomItems : undefined,
    symptoms: toText(form.symptoms),
    notes: toText(form.notes),
  }
}

/** Entry → 表單，用於編輯既有紀錄 */
export function entryToForm(entry: Entry): FormValues {
  const form = emptyForm(entry.date)
  const str = (n: number | undefined) => (n === undefined ? '' : String(n))
  for (const meal of entry.meals) form.meals[meal.type] = meal.description
  return {
    ...form,
    weightKg: str(entry.weightKg),
    bedtime: entry.sleep?.bedtime ?? '',
    wakeTime: entry.sleep?.wakeTime ?? '',
    sleepQuality: str(entry.sleep?.quality),
    bowel: entry.bowel.map((b) => ({
      time: b.time ?? '',
      bristol: str(b.bristol),
      note: b.note ?? '',
    })),
    waterMl: str(entry.waterMl),
    mood: str(entry.mood),
    symptomItems: entry.symptomItems ?? [],
    symptoms: entry.symptoms ?? '',
    notes: entry.notes ?? '',
  }
}
