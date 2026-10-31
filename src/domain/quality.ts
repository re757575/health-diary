import { LONG_SLEEP_HOURS, sleepHours, type Entry } from './entry'

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
