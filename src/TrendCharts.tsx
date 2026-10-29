import { Fragment, useId } from 'react'
import { buildLineChart, type ChartBox } from '@/domain/chart-scale'
import type { Entry } from '@/domain/entry'
import { buildTrends, summarizeSeries, type TrendPoint } from '@/domain/trend'
import { Section } from './Section'

interface Props {
  entries: Entry[]
  /** 區間的最後一天（含） */
  today: Date
}

const DAYS = 30

const BOX: ChartBox = {
  width: 340,
  height: 180,
  // 右邊留白要夠放下最後一個日期刻度（置中於最右側）的半個字寬
  margin: { top: 12, right: 20, bottom: 24, left: 36 },
}

/** 感應圈半徑：比看得見的圓點（r=4）大，手機上才好點到 */
const HIT_RADIUS = 12

const shortDate = (date: string) => date.slice(5).replace('-', '/')

function formatChange(change: number, unit: string): string {
  if (change === 0) return `±0 ${unit}`
  return `${change > 0 ? '+' : '−'}${Math.abs(change)} ${unit}`
}

interface ChartProps {
  title: string
  /** 資料表與圖的名稱，例如「體重」 */
  subject: string
  /** 資料表欄位標題 */
  valueHeader: string
  unit: string
  emptyText: string
  /** 對應 index.css 的 --series-* 色票 */
  seriesClass: string
  points: TrendPoint[]
  startDate: string
}

function TrendChart({
  title,
  subject,
  valueHeader,
  unit,
  emptyText,
  seriesClass,
  points,
  startDate,
}: ChartProps) {
  const headingId = useId()

  if (points.length === 0) {
    return (
      <figure className="trend" aria-labelledby={headingId}>
        <h3 id={headingId}>{title}</h3>
        <p>{emptyText}</p>
      </figure>
    )
  }

  const summary = summarizeSeries(points)
  const chart = buildLineChart({ points, startDate, days: DAYS, box: BOX })
  const { right, bottom, left } = BOX.margin
  const plotBottom = BOX.height - bottom
  const plotRight = BOX.width - right

  const summarySegments = [
    `最新 ${summary.latest!.value} ${unit}（${shortDate(summary.latest!.date)}）`,
  ]
  if (summary.change !== undefined) {
    summarySegments.push(`區間變化 ${formatChange(summary.change, unit)}`)
    summarySegments.push(`平均 ${summary.average} ${unit}`)
  }

  return (
    <figure className={`trend ${seriesClass}`} aria-labelledby={headingId}>
      <h3 id={headingId}>{title}</h3>
      {/* 每一段不拆行，需要換行時只在段與段之間換，避免數字與單位被分開 */}
      <p className="trend-summary">
        {summarySegments.map((segment, i) => (
          <Fragment key={segment}>
            {i > 0 && ' · '}
            <span className="trend-segment">{segment}</span>
          </Fragment>
        ))}
      </p>

      <svg
        role="img"
        aria-label={`${title}折線圖，共 ${points.length} 筆紀錄`}
        viewBox={`0 0 ${BOX.width} ${BOX.height}`}
      >
        {/* 格線與刻度：一像素、實線、不搶資料的注意力 */}
        {chart.yTicks.map((tick) => (
          <g key={tick.value}>
            <line className="trend-grid" x1={left} x2={plotRight} y1={tick.y} y2={tick.y} />
            <text className="trend-axis" x={left - 6} y={tick.y} textAnchor="end" dy="0.32em">
              {tick.value}
            </text>
          </g>
        ))}
        {chart.xTicks.map((tick) => (
          <text
            key={tick.label}
            className="trend-axis"
            x={tick.x}
            y={plotBottom + 16}
            textAnchor="middle"
          >
            {tick.label}
          </text>
        ))}

        {points.length > 1 && <path className="trend-line" d={chart.path} />}
        {chart.dots.map((dot) => (
          <g key={dot.date}>
            <circle className="trend-dot" cx={dot.x} cy={dot.y} r={4} />
            <circle className="trend-hit" cx={dot.x} cy={dot.y} r={HIT_RADIUS}>
              <title>{`${dot.date} · ${dot.value} ${unit}`}</title>
            </circle>
          </g>
        ))}
      </svg>

      <details>
        <summary>檢視資料表</summary>
        <table aria-label={`${subject}資料表`}>
          <thead>
            <tr>
              <th scope="col">日期</th>
              <th scope="col">{valueHeader}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.date}>
                <td>{p.date}</td>
                <td>{`${p.value} ${unit}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

export function TrendCharts({ entries, today }: Props) {
  const trends = buildTrends(entries, today, DAYS)

  return (
    <Section title={`最近 ${DAYS} 天趨勢`}>
      <TrendChart
        title="體重趨勢"
        subject="體重"
        valueHeader="體重"
        unit="kg"
        emptyText={`最近 ${DAYS} 天還沒有體重紀錄`}
        seriesClass="series-weight"
        points={trends.weight}
        startDate={trends.startDate}
      />
      <TrendChart
        title="睡眠時數趨勢"
        subject="睡眠時數"
        valueHeader="睡眠時數"
        unit="小時"
        emptyText={`最近 ${DAYS} 天還沒有睡眠紀錄（需要填入睡與起床時間）`}
        seriesClass="series-sleep"
        points={trends.sleepHours}
        startDate={trends.startDate}
      />
    </Section>
  )
}
