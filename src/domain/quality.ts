import { LONG_SLEEP_HOURS, sleepHours, type Entry } from './entry'
import { shiftDate, toDateString } from './form'

/** 每天都該填的核心欄位；有沒有填決定這天「完整」與否（餐點、症狀等選填的不算） */
const CORE_FIELDS: { label: string; filled: (entry: Entry) => boolean }[] = [
  { label: '體重', filled: (e) => e.weightKg !== undefined },
  { label: '飲水', filled: (e) => e.waterMl !== undefined },
  { label: '睡眠時間', filled: (e) => Boolean(e.sleep?.bedtime && e.sleep.wakeTime) },
  { label: '心情', filled: (e) => e.mood !== undefined },
]

/** 這筆紀錄還沒填的核心欄位名稱 */
export function missingFields(entry: Entry): string[] {
  return CORE_FIELDS.filter((f) => !f.filled(entry)).map((f) => f.label)
}

export interface LongSleep {
  date: string
  hours: number
  bedtime: string
  wakeTime: string
}

/** 睡眠時數超過 12 小時的紀錄，多半是上午／下午填錯 */
export function findLongSleeps(entries: Entry[]): LongSleep[] {
  return entries.flatMap((e) => {
    const hours = sleepHours(e.sleep)
    return hours !== undefined && hours > LONG_SLEEP_HOURS
      ? [{ date: e.date, hours, bedtime: e.sleep!.bedtime!, wakeTime: e.sleep!.wakeTime! }]
      : []
  })
}

export interface IncompleteDay {
  date: string
  /** 這天完全沒有紀錄 */
  empty: boolean
  /** 沒填的核心欄位；整天沒紀錄時就是全部 */
  missing: string[]
}

/**
 * 今天之前最近 `days` 天裡，核心欄位沒填完的日子，由近到遠。
 * 從第一筆紀錄的那天才開始算，使用者還沒開始記錄的日子不算漏填；今天還在填，不列入。
 */
export function findIncompleteDays(entries: Entry[], today: Date, days = 7): IncompleteDay[] {
  if (entries.length === 0) return []
  const firstDate = entries.reduce((min, e) => (e.date < min ? e.date : min), entries[0]!.date)
  const byDate = new Map(entries.map((e) => [e.date, e]))
  const todayDate = toDateString(today)

  const result: IncompleteDay[] = []
  for (let i = 1; i <= days; i++) {
    const date = shiftDate(todayDate, -i)
    if (date < firstDate) break
    const entry = byDate.get(date)
    const missing = entry ? missingFields(entry) : CORE_FIELDS.map((f) => f.label)
    if (missing.length > 0) result.push({ date, empty: !entry, missing })
  }
  return result
}
