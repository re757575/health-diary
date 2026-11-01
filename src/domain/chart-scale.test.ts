import { describe, expect, it } from 'vitest'
import { buildLineChart, niceTicks, tickDayIndexes, type ChartBox } from './chart-scale'

// 內部繪圖區 300 × 130，左上角在 (30, 10)
const box: ChartBox = {
  width: 340,
  height: 160,
  margin: { top: 10, right: 10, bottom: 20, left: 30 },
}
const startDate = '2026-09-29'

describe('buildLineChart：x 軸與邊界', () => {
  it('x 軸刻度每 7 天一個，從最後一天往回數，標籤為 MM/DD', () => {
    const chart = buildLineChart({ points: [], startDate, days: 30, box })
    expect(chart.xTicks).toEqual([
      { x: 40.3, label: '09/30' },
      { x: 112.8, label: '10/07' },
      { x: 185.2, label: '10/14' },
      { x: 257.6, label: '10/21' },
      { x: 330, label: '10/28' },
    ])
  })

  it('沒有資料點時：沒有折線、圓點與 y 軸刻度', () => {
    const chart = buildLineChart({ points: [], startDate, days: 30, box })
    expect(chart).toMatchObject({ path: '', dots: [], yTicks: [] })
  })

  it('只有一個資料點：置中於刻度範圍，路徑只有起點', () => {
    const chart = buildLineChart({
      points: [{ date: '2026-10-28', dayIndex: 29, value: 70 }],
      startDate,
      days: 30,
      box,
    })
    expect(chart.dots).toEqual([{ x: 330, y: 75, date: '2026-10-28', value: 70 }])
    expect(chart.path).toBe('M330 75')
    expect(chart.yTicks.map((t) => t.value)).toEqual([69, 69.5, 70, 70.5, 71])
  })
})

describe('buildLineChart：資料點與折線', () => {
  const points = [
    { date: '2026-09-29', dayIndex: 0, value: 68 },
    { date: '2026-10-14', dayIndex: 15, value: 70 },
    { date: '2026-10-28', dayIndex: 29, value: 72 },
  ]

  it('x 依日期在 30 天內等比例排列，y 依刻度範圍反向排列（值越大越上面）', () => {
    const chart = buildLineChart({ points, startDate, days: 30, box })
    expect(chart.dots).toEqual([
      { x: 30, y: 140, date: '2026-09-29', value: 68 },
      { x: 185.2, y: 75, date: '2026-10-14', value: 70 },
      { x: 330, y: 10, date: '2026-10-28', value: 72 },
    ])
  })

  it('折線路徑依序連接每個資料點', () => {
    const chart = buildLineChart({ points, startDate, days: 30, box })
    expect(chart.path).toBe('M30 140 L185.2 75 L330 10')
  })

  it('y 軸刻度對應到座標，最小刻度在底、最大刻度在頂', () => {
    const chart = buildLineChart({ points, startDate, days: 30, box })
    expect(chart.yTicks).toEqual([
      { value: 68, y: 140 },
      { value: 69, y: 107.5 },
      { value: 70, y: 75 },
      { value: 71, y: 42.5 },
      { value: 72, y: 10 },
    ])
  })
})

describe('niceTicks', () => {
  it('刻度間距取 1、2、5 的倍數，範圍向外取整', () => {
    expect(niceTicks(68.2, 71.4)).toEqual([68, 69, 70, 71, 72])
    expect(niceTicks(5.5, 9)).toEqual([5, 6, 7, 8, 9])
    expect(niceTicks(48, 112)).toEqual([40, 60, 80, 100, 120])
  })

  it('所有值相同時，上下各擴 1 以免除以零', () => {
    expect(niceTicks(7, 7)).toEqual([6, 6.5, 7, 7.5, 8])
  })

  it('小數間距：刻度值乾淨，也不會因浮點誤差多出一格', () => {
    expect(niceTicks(7.1, 8.9)).toEqual([7, 7.5, 8, 8.5, 9])
    // 0.4 / 0.1 在浮點運算是 4.000000000000001，不能因此多一格 0.5
    expect(niceTicks(0.1, 0.4)).toEqual([0.1, 0.2, 0.3, 0.4])
  })
})

describe('buildLineChart：沿用模式（體重沒量時維持上一次）', () => {
  // 30 天：x = 30 + dayIndex * 300 / 29；值都相同時刻度 69～71，70 落在 y = 75
  const point = (dayIndex: number, value = 70) => ({ date: `d${dayIndex}`, dayIndex, value })
  const xOf = (dayIndex: number) => Math.round((30 + (dayIndex * 300) / 29) * 10) / 10

  it('中間沒量的日子是水平虛線，到下次量的前一天再用實線接到新的點', () => {
    const chart = buildLineChart({
      points: [point(10, 70), point(14, 71)],
      startDate,
      days: 30,
      box,
      carry: {},
    })
    const [first, second] = chart.dots
    expect(chart.carriedPath).toContain(`M${xOf(10)} ${first!.y} L${xOf(13)} ${first!.y}`)
    expect(chart.path).toBe(`M${xOf(13)} ${first!.y} L${xOf(14)} ${second!.y}`)
  })

  it('連續兩天都有量就直接實線相連；量到最後一天時沒有虛線', () => {
    const chart = buildLineChart({
      points: [point(28), point(29)],
      startDate,
      days: 30,
      box,
      carry: {},
    })
    expect(chart.path).toBe(`M${xOf(28)} 75 L${xOf(29)} 75`)
    expect(chart.carriedPath).toBe('')
  })

  it('最後一次量之後到區間最後一天維持原值', () => {
    const chart = buildLineChart({ points: [point(20)], startDate, days: 30, box, carry: {} })
    expect(chart.path).toBe('')
    expect(chart.carriedPath).toBe(`M${xOf(20)} 75 L${xOf(29)} 75`)
  })

  it('區間開頭沿用區間前的數值；它也算進 y 軸範圍', () => {
    const chart = buildLineChart({
      points: [point(5, 70)],
      startDate,
      days: 30,
      box,
      carry: { carriedIn: 72 },
    })
    expect(chart.yTicks.map((t) => t.value)).toEqual([70, 70.5, 71, 71.5, 72])
    const yCarried = chart.yTicks.at(-1)!.y
    expect(chart.carriedPath.startsWith(`M${xOf(0)} ${yCarried} L${xOf(4)} ${yCarried}`)).toBe(true)
    expect(chart.path).toBe(`M${xOf(4)} ${yCarried} L${xOf(5)} ${chart.dots[0]!.y}`)
  })

  it('區間內都沒量、只有沿用進來的數值：整段虛線，沒有圓點', () => {
    const chart = buildLineChart({
      points: [],
      startDate,
      days: 30,
      box,
      carry: { carriedIn: 70 },
    })
    expect(chart.dots).toEqual([])
    expect(chart.path).toBe('')
    expect(chart.carriedPath).toBe(`M${xOf(0)} 75 L${xOf(29)} 75`)
  })
})

describe('tickDayIndexes', () => {
  it('最右邊永遠是最後一天，間距隨區間變長，刻度維持 5～7 個', () => {
    expect(tickDayIndexes(7)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(tickDayIndexes(14)).toEqual([1, 3, 5, 7, 9, 11, 13])
    expect(tickDayIndexes(30)).toEqual([1, 8, 15, 22, 29])
    expect(tickDayIndexes(90)).toEqual([14, 29, 44, 59, 74, 89])
    expect(tickDayIndexes(365)).toEqual([59, 120, 181, 242, 303, 364])
  })
})
