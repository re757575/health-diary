import type { TrendPoint } from './trend'

export interface ChartBox {
  width: number
  height: number
  margin: { top: number; right: number; bottom: number; left: number }
}

export interface LineChart {
  /** SVG path 的 d 屬性；沒有資料點時為空字串 */
  path: string
  /** 沿用模式下沒量的日子（維持上一次的數值）畫成虛線的 path；沒有這種日子時為空字串 */
  carriedPath: string
  dots: { x: number; y: number; date: string; value: number }[]
  yTicks: { value: number; y: number }[]
  xTicks: { x: number; label: string }[]
}

/** 座標只留 1 位小數，SVG 夠精細又不會產生一長串小數 */
const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * 把趨勢數列換成 SVG 座標。x 軸是 `days` 天的日期軸（不是第幾筆資料），
 * 所以沒紀錄的日子會留白；y 軸範圍由 niceTicks 決定。
 */
export function buildLineChart({
  points,
  startDate,
  days,
  box,
  carry,
}: {
  points: TrendPoint[]
  startDate: string
  days: number
  box: ChartBox
  /**
   * 沿用模式（體重）：沒量的日子視為維持上一次的數值，畫成水平虛線，到下次量的前一天再接到新的點。
   * `carriedIn` 是區間開始前最後一次的數值，區間開頭沒量的日子沿用它
   */
  carry?: { carriedIn?: number }
}): LineChart {
  const { top, right, bottom, left } = box.margin
  const innerWidth = box.width - left - right
  const innerHeight = box.height - top - bottom
  const xOf = (dayIndex: number) => round1(left + (dayIndex / (days - 1)) * innerWidth)

  const xTicks = tickDayIndexes(days).map((dayIndex) => ({
    x: xOf(dayIndex),
    label: labelOf(startDate, dayIndex),
  }))

  const carriedIn = carry?.carriedIn
  if (points.length === 0 && carriedIn === undefined) {
    return { path: '', carriedPath: '', dots: [], yTicks: [], xTicks }
  }

  const values = [...points.map((p) => p.value), ...(carriedIn !== undefined ? [carriedIn] : [])]
  const ticks = niceTicks(Math.min(...values), Math.max(...values))
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]

  const yOf = (value: number) => round1(top + ((yMax - value) / (yMax - yMin)) * innerHeight)

  const dots = points.map((p) => ({
    x: xOf(p.dayIndex),
    y: yOf(p.value),
    date: p.date,
    value: p.value,
  }))
  const yTicks = ticks.map((value) => ({ value, y: yOf(value) }))

  if (!carry) {
    const path = dots.map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x} ${d.y}`).join(' ')
    return { path, carriedPath: '', dots, yTicks, xTicks }
  }

  // 依時間走一遍：上一個值（量的或沿用進來的）維持到下次量的前一天（虛線），再接到新的點（實線）
  const solid: string[] = []
  const carried: string[] = []
  const segment = (from: [number, number], to: [number, number]) =>
    `M${from[0]} ${from[1]} L${to[0]} ${to[1]}`
  let previous = carriedIn !== undefined ? { dayIndex: -1, value: carriedIn } : undefined
  for (const p of points) {
    if (previous) {
      // 區間開頭沿用進來的值，從第 0 天開始畫
      const holdFrom = Math.max(previous.dayIndex, 0)
      const holdTo = p.dayIndex - 1
      const y = yOf(previous.value)
      if (holdTo > holdFrom) carried.push(segment([xOf(holdFrom), y], [xOf(holdTo), y]))
      if (holdTo >= 0) solid.push(segment([xOf(holdTo), y], [xOf(p.dayIndex), yOf(p.value)]))
    }
    previous = p
  }
  // 最後一次量之後到區間最後一天，維持最後的數值
  if (previous && previous.dayIndex < days - 1) {
    const y = yOf(previous.value)
    carried.push(segment([xOf(Math.max(previous.dayIndex, 0)), y], [xOf(days - 1), y]))
  }
  return { path: solid.join(' '), carriedPath: carried.join(' '), dots, yTicks, xTicks }
}

/**
 * 日期軸刻度落在第幾天：從最後一天往回數，讓最右邊永遠是「今天」。
 * 間距隨區間變長：30 天每 7 天、90 天每 15 天、1 年約每兩個月，刻度都維持 5～7 個
 */
export function tickDayIndexes(days: number): number[] {
  const step = days <= 31 ? 7 : days <= 92 ? 15 : 61
  return Array.from(
    { length: Math.floor((days - 1) / step) + 1 },
    (_, i) => days - 1 - i * step,
  ).reverse()
}

/** 起點日期加上 `dayIndex` 天，格式 MM/DD（用 UTC 計算，避開夏令時間） */
export function labelOf(startDate: string, dayIndex: number): string {
  const [y, m, d] = startDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + dayIndex)).toISOString().slice(5, 10).replace('-', '/')
}

/** 去掉浮點誤差（例如 0.30000000000000004），用於刻度值與整除判斷 */
const clean = (n: number) => Number(n.toPrecision(12))

/**
 * y 軸刻度：間距取 1、2、5 的 10 的次方倍，約 4 格，範圍向外取整以包住所有值。
 * 所有值相同時上下各擴 1，避免範圍為 0。
 */
export function niceTicks(min: number, max: number): number[] {
  if (min === max) {
    min -= 1
    max += 1
  }
  const raw = (max - min) / 4
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = clean([1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= clean(raw)) as number)

  const first = Math.floor(clean(min / step))
  const last = Math.ceil(clean(max / step))
  return Array.from({ length: last - first + 1 }, (_, i) => clean((first + i) * step))
}
