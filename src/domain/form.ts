import { DEFAULT_FOOD_UNIT, MEAL_TYPES, type Entry, type MealType, type SymptomItem } from './entry'

export interface FoodItemFormValues {
  name: string
  /** 數量；空字串視為 1 */
  amount: string
  unit: string
}

export interface MealFormValues {
  items: FoodItemFormValues[]
  /** 這餐的備註，例如外食、家裡煮 */
  note: string
}

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
  meals: Record<MealType, MealFormValues>
  bowel: BowelFormValues[]
  /** 確認當天沒有排便；有排便紀錄時不算數 */
  noBowel: boolean
  waterMl: string
  exerciseMinutes: string
  tags: string[]
  mood: string
  symptomItems: SymptomItem[]
  /** 固定用藥中這天沒吃的 id */
  missedMedications: string[]
  asNeededMedications: string[]
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

const WEEKDAYS = '日一二三四五六'

/** 2026-10-28（三） */
export function withWeekday(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return `${date}（${WEEKDAYS[new Date(year!, month! - 1, day!).getDay()]}）`
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

export const emptyMeal = (): MealFormValues => ({ items: [], note: '' })

/** 這餐還沒填任何東西 */
export const isEmptyMeal = (meal: MealFormValues) =>
  meal.items.length === 0 && meal.note.trim() === ''

/** 點選食物：還沒有就加入（預設 1 份），已經有就拿掉 */
export function toggleFoodItem(meal: MealFormValues, name: string): MealFormValues {
  const exists = meal.items.some((i) => i.name === name)
  return {
    ...meal,
    items: exists
      ? meal.items.filter((i) => i.name !== name)
      : [...meal.items, { name, amount: '1', unit: DEFAULT_FOOD_UNIT }],
  }
}

/** 把另一天的餐點補進還空著的餐別，已有內容的不動。回傳新的餐點與補了幾個餐別 */
export function fillEmptyMeals(
  current: FormValues['meals'],
  source: FormValues['meals'],
): { meals: FormValues['meals']; filled: number } {
  const meals = { ...current }
  let filled = 0
  for (const type of MEAL_TYPES) {
    if (isEmptyMeal(meals[type]) && !isEmptyMeal(source[type])) {
      meals[type] = { items: source[type].items.map((i) => ({ ...i })), note: source[type].note }
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
    meals: { breakfast: emptyMeal(), lunch: emptyMeal(), dinner: emptyMeal(), snack: emptyMeal() },
    bowel: [],
    noBowel: false,
    waterMl: '',
    exerciseMinutes: '',
    tags: [],
    mood: '',
    symptomItems: [],
    missedMedications: [],
    asNeededMedications: [],
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
  const bowel = form.bowel
    .map((b) => ({ time: toText(b.time), bristol: toNumber(b.bristol), note: toText(b.note) }))
    .filter((b) => b.time !== undefined || b.bristol !== undefined || b.note !== undefined)
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
      const { items, note } = form.meals[type]
      const foods = items
        .filter((i) => i.name.trim() !== '')
        .map((i) => ({
          name: i.name.trim(),
          amount: i.amount.trim() === '' ? 1 : Number(i.amount),
          unit: i.unit,
        }))
      const description = toText(note)
      if (foods.length === 0 && !description) return []
      return [
        { type, ...(foods.length > 0 && { items: foods }), ...(description && { description }) },
      ]
    }),
    bowel,
    noBowel: form.noBowel && bowel.length === 0 ? true : undefined,
    waterMl: toNumber(form.waterMl),
    exerciseMinutes: toNumber(form.exerciseMinutes),
    tags: form.tags.length > 0 ? form.tags : undefined,
    mood: toNumber(form.mood),
    symptomItems: form.symptomItems.length > 0 ? form.symptomItems : undefined,
    missedMedications: form.missedMedications.length > 0 ? form.missedMedications : undefined,
    asNeededMedications: form.asNeededMedications.length > 0 ? form.asNeededMedications : undefined,
    symptoms: toText(form.symptoms),
    notes: toText(form.notes),
  }
}

/**
 * 兩份表單存成紀錄後是否相同，用來判斷有沒有未儲存的修改。
 * 以存檔後的內容比較：只差前後空白、或多了全空的排便列，都算沒有修改
 */
export function isSameEntry(a: FormValues, b: FormValues): boolean {
  return JSON.stringify(formToEntry(a)) === JSON.stringify(formToEntry(b))
}

/** Entry → 表單，用於編輯既有紀錄 */
export function entryToForm(entry: Entry): FormValues {
  const form = emptyForm(entry.date)
  const str = (n: number | undefined) => (n === undefined ? '' : String(n))
  for (const meal of entry.meals) {
    form.meals[meal.type] = {
      items: (meal.items ?? []).map((i) => ({ ...i, amount: String(i.amount) })),
      note: meal.description ?? '',
    }
  }
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
    noBowel: entry.noBowel ?? false,
    waterMl: str(entry.waterMl),
    exerciseMinutes: str(entry.exerciseMinutes),
    tags: entry.tags ?? [],
    mood: str(entry.mood),
    symptomItems: entry.symptomItems ?? [],
    missedMedications: entry.missedMedications ?? [],
    asNeededMedications: entry.asNeededMedications ?? [],
    symptoms: entry.symptoms ?? '',
    notes: entry.notes ?? '',
  }
}
