import type { TrendPoint } from './trend'

export interface ChartBox {
  width: number
  height: number
  margin: { top: number; right: number; bottom: number; left: number }
}

export interface LineChart {
  /** SVG path 的 d 屬性；沒有資料點時為空字串 */
  path: string
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
}: {
  points: TrendPoint[]
  startDate: string
  days: number
  box: ChartBox
}): LineChart {
  const { top, right, bottom, left } = box.margin
  const innerWidth = box.width - left - right
  const innerHeight = box.height - top - bottom
  const xOf = (dayIndex: number) => round1(left + (dayIndex / (days - 1)) * innerWidth)

  // 每 7 天一個刻度，從最後一天往回數，讓最右邊永遠是「今天」
  const xTicks = Array.from({ length: Math.floor((days - 1) / 7) + 1 }, (_, i) => days - 1 - i * 7)
    .reverse()
    .map((dayIndex) => ({ x: xOf(dayIndex), label: labelOf(startDate, dayIndex) }))

  if (points.length === 0) return { path: '', dots: [], yTicks: [], xTicks }

  const values = points.map((p) => p.value)
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
  const path = dots.map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x} ${d.y}`).join(' ')
  return { path, dots, yTicks: ticks.map((value) => ({ value, y: yOf(value) })), xTicks }
}

/** 起點日期加上 `dayIndex` 天，格式 MM/DD（用 UTC 計算，避開夏令時間） */
function labelOf(startDate: string, dayIndex: number): string {
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
