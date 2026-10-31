import { Fragment, useId } from 'react'
import { buildLineChart, labelOf, type ChartBox } from '@/domain/chart-scale'
import {
  MIN_COMPARE_DAYS,
  SHORT_SLEEP_HOURS,
  buildDaily,
  compareBySleep,
  moodIntensity,
  sleepIntensity,
  symptomIntensity,
  type Daily,
  type SleepGroup,
} from '@/domain/daily'
import type { Entry } from '@/domain/entry'
import { LONG_SLEEP_HOURS, SEVERITY_LABELS, SYMPTOM_SEVERITIES } from '@/domain/entry'
import {
  buildSymptomTrend,
  buildTrends,
  summarizeSeries,
  type SymptomTrend,
  type TrendPoint,
} from '@/domain/trend'
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

/** 睡眠超過 12 小時而沒畫進圖的日子；請使用者回去改入睡或起床時間 */
function suspectSleepNote(dates: string[]): string | undefined {
  if (dates.length === 0) return undefined
  const shown = dates.slice(-3).map(shortDate).join('、')
  return `${dates.length} 天的睡眠時數超過 ${LONG_SLEEP_HOURS} 小時，可能是入睡或起床時間填錯，未列入圖表（${shown}${dates.length > 3 ? ' 等' : ''}）。請到「歷史紀錄」編輯修正。`
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
  /** 圖下方的補充說明，例如有資料因疑似填錯而沒列入 */
  note?: string
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
  note,
}: ChartProps) {
  const headingId = useId()

  if (points.length === 0) {
    return (
      <figure className="trend" aria-labelledby={headingId}>
        <h3 id={headingId}>{title}</h3>
        <p>{emptyText}</p>
        {note && <p className="trend-note">{note}</p>}
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
      {note && <p className="trend-note">{note}</p>}
    </figure>
  )
}

/** 每日一覽：三列色塊（睡眠、心情、症狀），同一天上下對齊，顏色越深代表越多／越好／越重 */
const STRIP = {
  width: 340,
  rowHeight: 16,
  rowGap: 6,
  margin: { top: 4, right: 8, bottom: 20, left: 40 },
}
const STRIP_ROWS = [
  { key: 'sleep', label: '睡眠', className: 'series-sleep' },
  { key: 'mood', label: '心情', className: 'series-mood' },
  { key: 'symptom', label: '症狀', className: 'series-symptom' },
] as const

const SYMPTOM_LEVEL_TEXT = [
  '沒有症狀',
  ...SYMPTOM_SEVERITIES.map((s) => `最重${SEVERITY_LABELS[s]}`),
]

function groupRow(label: string, group: SleepGroup) {
  return (
    <tr key={label}>
      <th scope="row">{label}</th>
      <td>{group.days} 天</td>
      <td>{group.moodAvg ?? '—'}</td>
      <td>{group.symptomBase > 0 ? `${group.symptomDays}／${group.symptomBase} 天` : '—'}</td>
    </tr>
  )
}

function DailyChart({ daily }: { daily: Daily }) {
  const headingId = useId()
  const { cells, startDate, days } = daily
  const hasData = cells.some(
    (c) => c.sleepHours !== undefined || c.mood !== undefined || c.symptomLevel !== undefined,
  )

  if (!hasData) {
    return (
      <figure className="trend" aria-labelledby={headingId}>
        <h3 id={headingId}>睡眠、心情與症狀對照</h3>
        <p>最近 {DAYS} 天還沒有睡眠、心情或症狀的紀錄</p>
      </figure>
    )
  }

  const { top, right, bottom, left } = STRIP.margin
  const innerWidth = STRIP.width - left - right
  const cellWidth = innerWidth / days
  const rowsHeight = STRIP_ROWS.length * STRIP.rowHeight + (STRIP_ROWS.length - 1) * STRIP.rowGap
  const height = top + rowsHeight + bottom
  const xOf = (dayIndex: number) => left + dayIndex * cellWidth
  const rowY = (row: number) => top + row * (STRIP.rowHeight + STRIP.rowGap)
  // 與折線圖一樣每 7 天一個刻度，最右邊是今天
  const xTicks = Array.from({ length: Math.floor((days - 1) / 7) + 1 }, (_, i) => days - 1 - i * 7)
    .reverse()
    .map((dayIndex) => ({ x: xOf(dayIndex) + cellWidth / 2, label: labelOf(startDate, dayIndex) }))

  const comparison = compareBySleep(cells)
  const comparable =
    comparison.short.days >= MIN_COMPARE_DAYS && comparison.enough.days >= MIN_COMPARE_DAYS

  return (
    <figure className="trend" aria-labelledby={headingId}>
      <h3 id={headingId}>睡眠、心情與症狀對照</h3>
      <p>
        同一天的睡眠、心情與症狀上下對齊；顏色越深代表睡得越久、心情越好、症狀越重，留白是沒有紀錄。
      </p>

      <svg
        role="img"
        aria-label={`最近 ${DAYS} 天睡眠、心情與症狀一覽，共 ${cells.length} 天有紀錄`}
        viewBox={`0 0 ${STRIP.width} ${height}`}
      >
        {STRIP_ROWS.map((row, r) => (
          <text
            key={row.key}
            className="trend-axis"
            x={left - 6}
            y={rowY(r) + STRIP.rowHeight / 2}
            textAnchor="end"
            dy="0.32em"
          >
            {row.label}
          </text>
        ))}
        {xTicks.map((tick) => (
          <text
            key={tick.label}
            className="trend-axis"
            x={tick.x}
            y={top + rowsHeight + 14}
            textAnchor="middle"
          >
            {tick.label}
          </text>
        ))}
        {cells.map((cell) => {
          const x = xOf(cell.dayIndex) + 0.5
          const width = cellWidth - 1
          const rect = (
            row: number,
            className: string,
            opacity: number | undefined,
            title: string,
          ) => (
            <rect
              key={`${cell.date}-${row}`}
              className={`strip-cell ${className}`}
              x={x}
              y={rowY(row)}
              width={width}
              height={STRIP.rowHeight}
              rx={2}
              fillOpacity={opacity}
            >
              <title>{`${cell.date} · ${title}`}</title>
            </rect>
          )
          return (
            <Fragment key={cell.date}>
              {cell.sleepHours !== undefined &&
                rect(
                  0,
                  'series-sleep',
                  sleepIntensity(cell.sleepHours),
                  `睡 ${cell.sleepHours} 小時`,
                )}
              {cell.mood !== undefined &&
                rect(1, 'series-mood', moodIntensity(cell.mood), `心情 ${cell.mood}/5`)}
              {cell.symptomLevel !== undefined &&
                (cell.symptomLevel === 0
                  ? rect(2, 'strip-none', undefined, '沒有症狀')
                  : rect(
                      2,
                      'series-symptom',
                      symptomIntensity(cell.symptomLevel),
                      `症狀${SYMPTOM_LEVEL_TEXT[cell.symptomLevel]}`,
                    ))}
            </Fragment>
          )
        })}
      </svg>

      {comparable ? (
        <>
          <table aria-label="睡眠對照表">
            <thead>
              <tr>
                <th scope="col">分組</th>
                <th scope="col">天數</th>
                <th scope="col">平均心情</th>
                <th scope="col">有症狀</th>
              </tr>
            </thead>
            <tbody>
              {groupRow(`睡不到 ${SHORT_SLEEP_HOURS} 小時`, comparison.short)}
              {groupRow(`睡 ${SHORT_SLEEP_HOURS} 小時以上`, comparison.enough)}
            </tbody>
          </table>
          <p className="trend-note">天數少的時候，差異可能只是巧合，僅供參考。</p>
        </>
      ) : (
        <p className="trend-note">
          睡不到 {SHORT_SLEEP_HOURS} 小時（{comparison.short.days} 天）與睡 {SHORT_SLEEP_HOURS}{' '}
          小時以上（{comparison.enough.days} 天）各累積 {MIN_COMPARE_DAYS}{' '}
          天後，才會顯示心情與症狀的對照。
        </p>
      )}

      <details>
        <summary>檢視資料表</summary>
        <table aria-label="睡眠、心情與症狀資料表">
          <thead>
            <tr>
              <th scope="col">日期</th>
              <th scope="col">睡眠</th>
              <th scope="col">心情</th>
              <th scope="col">症狀</th>
            </tr>
          </thead>
          <tbody>
            {cells.map((c) => (
              <tr key={c.date}>
                <td>{c.date}</td>
                <td>{c.sleepHours !== undefined ? `${c.sleepHours} 小時` : '—'}</td>
                <td>{c.mood !== undefined ? `${c.mood}/5` : '—'}</td>
                <td>{c.symptomLevel !== undefined ? SYMPTOM_LEVEL_TEXT[c.symptomLevel] : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

function SymptomChart({ trend }: { trend: SymptomTrend }) {
  const headingId = useId()
  const { recordedDays, textOnlyDays, items } = trend

  return (
    <figure className="trend series-symptom" aria-labelledby={headingId}>
      <h3 id={headingId}>症狀出現天數</h3>
      <p>
        最近 {DAYS} 天有 {recordedDays} 天有紀錄
      </p>
      {items.length === 0 ? (
        <p>最近 {DAYS} 天還沒有點選記錄的症狀</p>
      ) : (
        <>
          <ul className="symptom-bars">
            {items.map((item) => (
              <li key={item.name}>
                <span className="symptom-name">{item.name}</span>
                {/* 長條只是把右邊的文字畫出來，不重複給讀屏軟體 */}
                <span className="symptom-track" aria-hidden="true">
                  {SYMPTOM_SEVERITIES.map((severity) => (
                    <span
                      key={severity}
                      className={`symptom-seg symptom-seg-${severity}`}
                      style={{ width: `${(item.bySeverity[severity] / recordedDays) * 100}%` }}
                    />
                  ))}
                </span>
                <span className="symptom-count">
                  {`${item.days} 天（${SYMPTOM_SEVERITIES.filter((s) => item.bySeverity[s] > 0)
                    .map((s) => `${SEVERITY_LABELS[s]} ${item.bySeverity[s]}`)
                    .join(' · ')}）`}
                </span>
              </li>
            ))}
          </ul>
          <p className="trend-note">長條顏色由淺到深是輕、中、重</p>
        </>
      )}
      {textOnlyDays > 0 && (
        <p className="trend-note">另有 {textOnlyDays} 天的症狀是用文字記錄，沒有列入統計</p>
      )}
    </figure>
  )
}

export function TrendCharts({ entries, today }: Props) {
  const trends = buildTrends(entries, today, DAYS)
  const symptoms = buildSymptomTrend(entries, today, DAYS)
  const daily = buildDaily(entries, today, DAYS)

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
        note={suspectSleepNote(trends.suspectSleepDates)}
      />
      <DailyChart daily={daily} />
      <SymptomChart trend={symptoms} />
    </Section>
  )
}
