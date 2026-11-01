import { SHORT_SLEEP_HOURS } from './daily'
import { LONG_SLEEP_HOURS, SEVERITY_LABELS, sleepHours, type Entry } from './entry'
import { daysBetween } from './trend'

/**
 * 就醫報告：指定日期範圍內給醫生看的重點，不是每天的完整紀錄。
 * 包含期間摘要（體重、睡眠、心情、排便）與有狀況的日子（症狀、臨時用藥、沒吃藥、異常排便）
 */

/** 報告最長涵蓋的天數；再長的趨勢圖擠在一起看不清楚 */
export const MAX_REPORT_DAYS = 366

export interface ReportRange {
  startDate: string
  endDate: string
  /** 含頭尾的天數 */
  days: number
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** 檢查使用者選的範圍；不合法時回傳要顯示的說明 */
export function reportRange(startDate: string, endDate: string): ReportRange | { error: string } {
  if (!DATE.test(startDate) || !DATE.test(endDate)) return { error: '請選擇開始與結束日期' }
  if (startDate > endDate) return { error: '開始日期不能晚於結束日期' }
  const days = daysBetween(startDate, endDate) + 1
  if (days > MAX_REPORT_DAYS) return { error: `範圍最長 ${MAX_REPORT_DAYS} 天，請縮短期間` }
  return { startDate, endDate, days }
}

/** 範圍內的紀錄，日期由舊到新 */
export function entriesInRange(entries: Entry[], range: ReportRange): Entry[] {
  return entries
    .filter((e) => e.date >= range.startDate && e.date <= range.endDate)
    .sort((a, b) => a.date.localeCompare(b.date))
}

const round1 = (n: number) => Math.round(n * 10) / 10
const average = (values: number[]) => round1(values.reduce((a, b) => a + b, 0) / values.length)

export interface ReportSummary {
  /** 有紀錄的天數 */
  recordedDays: number
  /** 期間第一次與最後一次量的體重；沒量過就沒有 */
  weight?: {
    first: { date: string; kg: number }
    last: { date: string; kg: number }
    change: number
  }
  /** 平均睡眠時數與睡不夠的天數；超過 12 小時的多半填錯，不算 */
  sleep?: { nights: number; averageHours: number; shortNights: number }
  mood?: { days: number; average: number }
  /** 有記錄排便（含確認沒排便）的日子：平均每天幾次、硬便（布里斯托 1–2 型）與腹瀉（6–7 型）的天數 */
  bowel?: { days: number; averagePerDay: number; hardDays: number; looseDays: number }
}

/** @param entries 範圍內的紀錄（entriesInRange） */
export function summarizeReport(entries: Entry[]): ReportSummary {
  const weights = entries.flatMap((e) =>
    e.weightKg === undefined ? [] : [{ date: e.date, kg: e.weightKg }],
  )
  const sleeps = entries.flatMap((e) => {
    const hours = sleepHours(e.sleep)
    return hours !== undefined && hours <= LONG_SLEEP_HOURS ? [hours] : []
  })
  const moods = entries.flatMap((e) => (e.mood === undefined ? [] : [e.mood]))
  const bowelDays = entries.filter((e) => e.bowel.length > 0 || e.noBowel)
  const bristols = (e: Entry) =>
    e.bowel.flatMap((b) => (b.bristol === undefined ? [] : [b.bristol]))

  return {
    recordedDays: entries.length,
    ...(weights.length > 0 && {
      weight: {
        first: weights[0]!,
        last: weights[weights.length - 1]!,
        change: round1(weights[weights.length - 1]!.kg - weights[0]!.kg),
      },
    }),
    ...(sleeps.length > 0 && {
      sleep: {
        nights: sleeps.length,
        averageHours: average(sleeps),
        shortNights: sleeps.filter((h) => h < SHORT_SLEEP_HOURS).length,
      },
    }),
    ...(moods.length > 0 && { mood: { days: moods.length, average: average(moods) } }),
    ...(bowelDays.length > 0 && {
      bowel: {
        days: bowelDays.length,
        averagePerDay: average(bowelDays.map((e) => e.bowel.length)),
        hardDays: bowelDays.filter((e) => bristols(e).some((b) => b <= 2)).length,
        looseDays: bowelDays.filter((e) => bristols(e).some((b) => b >= 6)).length,
      },
    }),
  }
}

export interface NotableDay {
  date: string
  /** 點選的症狀與程度，例如「頭痛（中）」 */
  symptoms: string[]
  /** 症狀的文字補充 */
  symptomNote?: string
  asNeeded: string[]
  /** 沒吃的固定用藥名稱 */
  missedMedications: string[]
  /** 異常的排便，例如「布里斯托 7 型」 */
  abnormalBowel: string[]
}

/**
 * 有狀況的日子（由舊到新）：有症狀、吃了臨時用藥、沒吃固定用藥，或排便是布里斯托 1、2、6、7 型。
 * 都正常的日子不列，報告才不會太長
 * @param medicationNames 固定用藥 id → 名稱；已刪除的藥查不到就略過
 */
export function notableDays(entries: Entry[], medicationNames: Map<string, string>): NotableDay[] {
  return entries.flatMap((e) => {
    const day: NotableDay = {
      date: e.date,
      symptoms: (e.symptomItems ?? []).map((i) => `${i.name}（${SEVERITY_LABELS[i.severity]}）`),
      ...(e.symptoms?.trim() && { symptomNote: e.symptoms.trim() }),
      asNeeded: e.asNeededMedications ?? [],
      missedMedications: (e.missedMedications ?? []).flatMap((id) => medicationNames.get(id) ?? []),
      abnormalBowel: e.bowel.flatMap((b) =>
        b.bristol !== undefined && (b.bristol <= 2 || b.bristol >= 6)
          ? [`布里斯托 ${b.bristol} 型`]
          : [],
      ),
    }
    const notable =
      day.symptoms.length > 0 ||
      day.symptomNote !== undefined ||
      day.asNeeded.length > 0 ||
      day.missedMedications.length > 0 ||
      day.abnormalBowel.length > 0
    return notable ? [day] : []
  })
}

/** 臨時用藥各吃了幾天，天數多的在前 */
export function asNeededDays(entries: Entry[]): { name: string; days: number }[] {
  const counts = new Map<string, number>()
  for (const e of entries) {
    for (const name of new Set(e.asNeededMedications ?? [])) {
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }
  return [...counts]
    .map(([name, days]) => ({ name, days }))
    .sort((a, b) => b.days - a.days || a.name.localeCompare(b.name, 'zh-Hant'))
}
