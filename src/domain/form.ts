import { DEFAULT_FOOD_UNIT, MEAL_TYPES, type Entry, type MealType, type SymptomItem } from './entry'
import { foodKey } from './food'

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

/** 依位置移除一項。食物名稱可以改，不能再用名稱找 */
export function removeFoodItem(meal: MealFormValues, index: number): MealFormValues {
  return { ...meal, items: meal.items.filter((_, i) => i !== index) }
}

/** 食物在三餐中的位置：哪一餐的第幾項（從 0 起算） */
export interface FoodLocation {
  meal: MealType
  index: number
}

export type MoveFoodResult =
  | { meals: FormValues['meals']; status: 'moved'; at: FoodLocation }
  | { meals: FormValues['meals']; status: 'unchanged' | 'duplicate' }

/**
 * 把一餐裡的某一項食物移到某一餐的某個位置（份量、單位照舊）；同一餐就是重新排序。
 * `position` 是插在第幾項前面（0 是最前面、清單長度是最後面），以移動前的清單計算，
 * 不給就接在最後面。位置沒有實際改變時回傳 unchanged；
 * 移到另一餐時，目標那餐已有同名食物就不移動（duplicate），免得同一餐出現兩筆
 */
export function moveFoodItem(
  meals: FormValues['meals'],
  from: MealType,
  index: number,
  to: MealType,
  position?: number,
): MoveFoodResult {
  const item = meals[from].items[index]
  if (!item) return { meals, status: 'unchanged' }
  const clamp = (n: number, length: number) => Math.min(Math.max(n, 0), length)

  if (from === to) {
    const gap = clamp(position ?? meals[to].items.length, meals[to].items.length)
    // 拿掉自己之後，排在自己後面的各項都往前移了一格
    const target = gap > index ? gap - 1 : gap
    if (target === index) return { meals, status: 'unchanged' }
    const items = meals[to].items.filter((_, i) => i !== index)
    items.splice(target, 0, item)
    return {
      meals: { ...meals, [to]: { ...meals[to], items } },
      status: 'moved',
      at: { meal: to, index: target },
    }
  }

  const key = foodKey(item.name)
  if (meals[to].items.some((i) => foodKey(i.name) === key)) return { meals, status: 'duplicate' }
  const target = clamp(position ?? meals[to].items.length, meals[to].items.length)
  const items = [...meals[to].items]
  items.splice(target, 0, item)
  return {
    meals: {
      ...meals,
      [from]: removeFoodItem(meals[from], index),
      [to]: { ...meals[to], items },
    },
    status: 'moved',
    at: { meal: to, index: target },
  }
}

/**
 * 鍵盤上下鍵：把食物在整份餐點裡往上或往下移一格。餐內還有空間就在同一餐內換位置；
 * 已經在這一餐的第一項（往上）或最後一項（往下），就移到前一餐的最後面或後一餐的最前面
 */
export function stepFoodItem(
  meals: FormValues['meals'],
  from: MealType,
  index: number,
  direction: -1 | 1,
): MoveFoodResult {
  const { length } = meals[from].items
  if (direction < 0 ? index > 0 : index < length - 1) {
    return moveFoodItem(meals, from, index, from, direction < 0 ? index - 1 : index + 2)
  }
  const next = MEAL_TYPES[MEAL_TYPES.indexOf(from) + direction]
  if (!next) return { meals, status: 'unchanged' }
  return moveFoodItem(meals, from, index, next, direction < 0 ? undefined : 0)
}

/**
 * 把一批食物（例如照片辨識的結果）加進一餐：名稱已經在這餐的略過（不蓋掉已經調整過的份量）。
 * 備註接在原本的備註後面，已經包含就不重複。回傳新的餐點與略過了幾項
 */
export function addFoodItems(
  meal: MealFormValues,
  items: readonly FoodItemFormValues[],
  note = '',
): { meal: MealFormValues; added: number; skipped: number } {
  const keys = new Set(meal.items.map((i) => foodKey(i.name)))
  const fresh = items.filter((i) => {
    const key = foodKey(i.name)
    if (keys.has(key)) return false
    keys.add(key)
    return true
  })
  const extra = note.trim()
  const current = meal.note.trim()
  const merged =
    !extra || current.includes(extra) ? meal.note : current ? `${current}；${extra}` : extra
  return {
    meal: { items: [...meal.items, ...fresh.map((i) => ({ ...i }))], note: merged },
    added: fresh.length,
    skipped: items.length - fresh.length,
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
