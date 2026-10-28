import { MEAL_TYPES, type Entry, type MealType } from './entry'

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
  symptoms: string
  notes: string
}

/** 本地時區的 YYYY-MM-DD（不能用 toISOString，會換算成 UTC 而差一天） */
export function toDateString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
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
    symptoms: entry.symptoms ?? '',
    notes: entry.notes ?? '',
  }
}
