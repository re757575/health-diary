import { sleepHours, type Entry } from './entry'
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
  sleepHours: TrendPoint[]
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
function daysBetween(from: string, to: string): number {
  const utc = (date: string) => {
    const [y, m, d] = date.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((utc(to) - utc(from)) / DAY_MS)
}

/**
 * 整理最近 `days` 天（含 `today`）的體重與睡眠時數趨勢。
 * 沒有紀錄的日子不補值，只回傳有資料的點。
 */
export function buildTrends(entries: Entry[], today: Date, days = 30): Trends {
  const startDate = toDateString(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1)),
  )
  const endDate = toDateString(today)

  const inWindow = entries
    .filter((e) => e.date >= startDate && e.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date))

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
    sleepHours: toPoints((e) => sleepHours(e.sleep)),
  }
}
