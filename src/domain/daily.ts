import { LONG_SLEEP_HOURS, sleepHours, type Entry } from './entry'
import { daysBetween, recentWindow } from './trend'

/** 一天的睡眠、心情與症狀，用來並排比較；沒紀錄的欄位就是 undefined */
export interface DailyCell {
  date: string
  /** 距離區間起點幾天（起點為 0） */
  dayIndex: number
  /** 超過 12 小時的多半是填錯，不放進來 */
  sleepHours?: number
  mood?: number
  /**
   * 當天最嚴重的症狀：0 沒有、1 輕、2 中、3 重。症狀是有才點的，所以「沒點」只在當天
   * 填了睡眠時間或心情時才當作沒有症狀；只填體重那種日子無從得知，是 undefined。
   * 只用文字寫症狀的天數不知道程度，也是 undefined
   */
  symptomLevel?: 0 | 1 | 2 | 3
}

export interface Daily {
  startDate: string
  days: number
  cells: DailyCell[]
}

/** 最近 `days` 天（含 `today`）有紀錄的日子，由舊到新 */
export function buildDaily(entries: Entry[], today: Date, days = 30): Daily {
  const { startDate, inWindow } = recentWindow(entries, today, days)
  const cells = inWindow.map((e): DailyCell => {
    const hours = sleepHours(e.sleep)
    const items = e.symptomItems ?? []
    const textOnly = items.length === 0 && Boolean(e.symptoms?.trim())
    const filledDay = Boolean(e.sleep?.bedtime && e.sleep.wakeTime) || e.mood !== undefined
    const symptomKnown = items.length > 0 || (filledDay && !textOnly)
    return {
      date: e.date,
      dayIndex: daysBetween(startDate, e.date),
      sleepHours: hours !== undefined && hours <= LONG_SLEEP_HOURS ? hours : undefined,
      mood: e.mood,
      symptomLevel: symptomKnown
        ? (Math.max(0, ...items.map((i) => i.severity)) as 0 | 1 | 2 | 3)
        : undefined,
    }
  })
  return { startDate, days, cells }
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** 顏色深淺（0.2～1）：睡 4 小時以下最淡，8 小時以上最深 */
export const sleepIntensity = (hours: number) => 0.2 + 0.8 * clamp01((hours - 4) / 4)

/** 顏色深淺（0.2～1）：心情 1 最淡，5 最深 */
export const moodIntensity = (mood: number) => 0.2 + 0.8 * clamp01((mood - 1) / 4)

/** 顏色深淺：輕 0.4、中 0.7、重 1，與「症狀出現天數」的長條一致 */
export const symptomIntensity = (level: 1 | 2 | 3) => ({ 1: 0.4, 2: 0.7, 3: 1 })[level]

/** 睡眠少於這個時數算「睡不夠」 */
export const SHORT_SLEEP_HOURS = 6.5

/** 兩組各要累積幾天才顯示對照，天數太少的差異多半只是巧合 */
export const MIN_COMPARE_DAYS = 3

export interface SleepGroup {
  /** 這組的天數（有睡眠時數的日子） */
  days: number
  /** 平均心情；這組沒有人填心情時為 undefined */
  moodAvg?: number
  /** 有症狀的天數／能判斷有沒有症狀的天數（排除只用文字寫症狀的日子） */
  symptomDays: number
  symptomBase: number
}

export interface SleepComparison {
  short: SleepGroup
  enough: SleepGroup
}

const round1 = (n: number) => Math.round(n * 10) / 10

function summarizeGroup(cells: DailyCell[]): SleepGroup {
  const moods = cells.flatMap((c) => (c.mood === undefined ? [] : [c.mood]))
  const judged = cells.filter((c) => c.symptomLevel !== undefined)
  return {
    days: cells.length,
    ...(moods.length > 0 && { moodAvg: round1(moods.reduce((a, b) => a + b, 0) / moods.length) }),
    symptomDays: judged.filter((c) => c.symptomLevel! > 0).length,
    symptomBase: judged.length,
  }
}

/** 把有睡眠時數的日子分成「睡不夠」與「睡得夠」，各自看平均心情與有症狀的比例 */
export function compareBySleep(cells: DailyCell[]): SleepComparison {
  const withSleep = cells.filter((c) => c.sleepHours !== undefined)
  return {
    short: summarizeGroup(withSleep.filter((c) => c.sleepHours! < SHORT_SLEEP_HOURS)),
    enough: summarizeGroup(withSleep.filter((c) => c.sleepHours! >= SHORT_SLEEP_HOURS)),
  }
}
