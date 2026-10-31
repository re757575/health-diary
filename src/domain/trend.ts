import { LONG_SLEEP_HOURS, sleepHours, type Entry, type SymptomSeverity } from './entry'
import { toDateString } from './form'

export interface TrendPoint {
  date: string
  /** 距離區間起點幾天（起點為 0），用來在日期軸上定位 */
  dayIndex: number
  value: number
}

export interface Trends {
  startDate: string
  endDate: string
  days: number
  weight: TrendPoint[]
  /** 睡眠時數的點；超過 12 小時的多半是填錯，不收 */
  sleepHours: TrendPoint[]
  /** 因睡眠時數超過 12 小時而沒有列入的日期，由舊到新 */
  suspectSleepDates: string[]
}

export interface SeriesSummary {
  count: number
  /** 區間內最後一筆 */
  latest?: TrendPoint
  /** 最後一筆減第一筆；至少兩筆才有 */
  change?: number
  average?: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** 摘要一條已由舊到新排序的數列 */
export function summarizeSeries(points: TrendPoint[]): SeriesSummary {
  if (points.length === 0) return { count: 0 }
  const first = points[0]
  const latest = points[points.length - 1]
  const sum = points.reduce((total, p) => total + p.value, 0)
  return {
    count: points.length,
    latest,
    ...(points.length > 1 && { change: round1(latest.value - first.value) }),
    average: round1(sum / points.length),
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

/** 用 UTC 計算日數差，避開夏令時間造成的 23／25 小時 */
export function daysBetween(from: string, to: string): number {
  const utc = (date: string) => {
    const [y, m, d] = date.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((utc(to) - utc(from)) / DAY_MS)
}

/** 最近 `days` 天（含 `today`）的起訖日與落在區間內的紀錄（由舊到新） */
export function recentWindow(entries: Entry[], today: Date, days: number) {
  const startDate = toDateString(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1)),
  )
  const endDate = toDateString(today)
  const inWindow = entries
    .filter((e) => e.date >= startDate && e.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date))
  return { startDate, endDate, inWindow }
}

/**
 * 整理最近 `days` 天（含 `today`）的體重與睡眠時數趨勢。
 * 沒有紀錄的日子不補值，只回傳有資料的點。
 */
export function buildTrends(entries: Entry[], today: Date, days = 30): Trends {
  const { startDate, endDate, inWindow } = recentWindow(entries, today, days)

  /** 只留下有值的日子，轉成圖上的點 */
  const toPoints = (valueOf: (entry: Entry) => number | undefined): TrendPoint[] =>
    inWindow.flatMap((e) => {
      const value = valueOf(e)
      return value === undefined
        ? []
        : [{ date: e.date, dayIndex: daysBetween(startDate, e.date), value }]
    })

  return {
    startDate,
    endDate,
    days,
    weight: toPoints((e) => e.weightKg),
    sleepHours: toPoints((e) => {
      const hours = sleepHours(e.sleep)
      return hours !== undefined && hours <= LONG_SLEEP_HOURS ? hours : undefined
    }),
    suspectSleepDates: inWindow
      .filter((e) => (sleepHours(e.sleep) ?? 0) > LONG_SLEEP_HOURS)
      .map((e) => e.date),
  }
}

export interface SymptomTrendItem {
  name: string
  /** 區間內有這個症狀的天數 */
  days: number
  /** 輕／中／重各有幾天（加總等於 days） */
  bySeverity: Record<SymptomSeverity, number>
}

export interface SymptomTrend {
  /** 區間內有紀錄的天數，當作長條的比例基準 */
  recordedDays: number
  /** 只用文字寫症狀、沒有點選的天數；這些天不列入統計 */
  textOnlyDays: number
  /** 依天數由多到少，同天數依名稱排序 */
  items: SymptomTrendItem[]
}

/** 最近 `days` 天各症狀出現的天數，與其中輕／中／重各幾天 */
export function buildSymptomTrend(entries: Entry[], today: Date, days = 30): SymptomTrend {
  const { inWindow } = recentWindow(entries, today, days)
  const byName = new Map<string, SymptomTrendItem>()
  let textOnlyDays = 0

  for (const entry of inWindow) {
    const items = entry.symptomItems ?? []
    if (items.length === 0 && entry.symptoms?.trim()) textOnlyDays++
    // 同一天同名只算一次，以最後一筆的程度為準
    const perDay = new Map(items.map((i) => [i.name, i.severity]))
    for (const [name, severity] of perDay) {
      const item = byName.get(name) ?? {
        name,
        days: 0,
        bySeverity: { 1: 0, 2: 0, 3: 0 },
      }
      item.days++
      item.bySeverity[severity]++
      byName.set(name, item)
    }
  }

  const items = [...byName.values()].sort(
    (a, b) => b.days - a.days || a.name.localeCompare(b.name, 'zh-Hant'),
  )
  return { recordedDays: inWindow.length, textOnlyDays, items }
}
