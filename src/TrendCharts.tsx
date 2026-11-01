import { Button, Group } from '@mantine/core'
import { Fragment, useId, useState } from 'react'
import { buildLineChart, labelOf, tickDayIndexes, type ChartBox } from '@/domain/chart-scale'
import {
  MIN_COMPARE_DAYS,
  SHORT_SLEEP_HOURS,
  buildDaily,
  compareBySleep,
  moodIntensity,
  sleepIntensity,
  symptomIntensity,
  type Daily,
  type DayGroup,
} from '@/domain/daily'
import type { Entry } from '@/domain/entry'
import { SEVERITY_LABELS, SYMPTOM_SEVERITIES } from '@/domain/entry'
import {
  buildSymptomTrend,
  buildTrends,
  suspectSleepNote,
  summarizeSeries,
  type SymptomTrend,
  type TrendPoint,
} from '@/domain/trend'
import type { Medication } from '@/domain/medication'
import { buildMedicationTrend, type MedicationTrendItem } from '@/domain/medication-trend'
import type { DayWeight } from '@/domain/weight'
import { Section } from './Section'

interface Props {
  entries: Entry[]
  /** 區間的最後一天（含） */
  today: Date
  /** 固定用藥；區間內有在吃的會顯示服藥天數與對照 */
  medications?: Medication[]
}

/** 可以切換的區間；label 也用在標題與說明（「最近 30 天…」） */
const RANGES = [
  { days: 30, label: '30 天' },
  { days: 90, label: '90 天' },
  { days: 365, label: '1 年' },
] as const

/** 目前顯示的區間 */
interface Range {
  days: number
  label: string
}

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
  /** 區間天數（日期軸的長度） */
  days: number
  /** 圖下方的補充說明，例如有資料因疑似填錯而沒列入 */
  note?: string
  /**
   * 沿用模式（體重）：沒量的日子維持上一次的數值，畫成水平虛線。
   * `carriedIn` 是區間開始前最後一次量的數值，區間內都沒量時整段沿用它
   */
  carry?: { carriedIn?: DayWeight }
}

export function TrendChart({
  title,
  subject,
  valueHeader,
  unit,
  emptyText,
  seriesClass,
  points,
  startDate,
  days,
  note,
  carry,
}: ChartProps) {
  const headingId = useId()

  if (points.length === 0 && !carry?.carriedIn) {
    return (
      <figure className="trend" aria-labelledby={headingId}>
        <h3 id={headingId}>{title}</h3>
        <p>{emptyText}</p>
        {note && <p className="trend-note">{note}</p>}
      </figure>
    )
  }

  const summary = summarizeSeries(points)
  const chart = buildLineChart({
    points,
    startDate,
    days,
    box: BOX,
    carry: carry && { carriedIn: carry.carriedIn?.kg },
  })
  const { right, bottom, left } = BOX.margin
  const plotBottom = BOX.height - bottom
  const plotRight = BOX.width - right

  const carriedIn = carry?.carriedIn
  const summarySegments = summary.latest
    ? [`最新 ${summary.latest.value} ${unit}（${shortDate(summary.latest.date)}）`]
    : // 區間內都沒量，只有沿用進來的數值
      [`沒有量，維持 ${shortDate(carriedIn!.measuredOn)} 的 ${carriedIn!.kg} ${unit}`]
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
        aria-label={
          `${title}折線圖，共 ${points.length} 筆紀錄` +
          (chart.carriedPath ? '；虛線是沒量、維持上一次數值的日子' : '')
        }
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

        {/* 一般模式只有一個點時不畫線；沿用模式的實線只連到實際量的點，有才畫 */}
        {(carry ? chart.path : points.length > 1) && <path className="trend-line" d={chart.path} />}
        {chart.carriedPath && (
          <path className="trend-line trend-line-carried" d={chart.carriedPath} />
        )}
        {chart.dots.map((dot) => (
          <g key={dot.date}>
            {/* 點很密時縮小；1 年時每天的點會疊成一串，只留線（感應圈仍在，點得到數值） */}
            {days <= 92 && (
              <circle className="trend-dot" cx={dot.x} cy={dot.y} r={days > 31 ? 2.5 : 4} />
            )}
            <circle className="trend-hit" cx={dot.x} cy={dot.y} r={HIT_RADIUS}>
              <title>{`${dot.date} · ${dot.value} ${unit}`}</title>
            </circle>
          </g>
        ))}
      </svg>

      {chart.carriedPath && (
        <p className="trend-note">
          <span className="trend-legend-carried" aria-hidden="true" />
          虛線：沒量的日子，維持上一次量的數值
        </p>
      )}
      {points.length > 0 && (
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
      )}
      {note && <p className="trend-note">{note}</p>}
    </figure>
  )
}

/** 每日一覽：三列色塊（睡眠、心情、症狀），同一天上下對齊，顏色越深代表越多／越好／越重 */
const STRIP = {
  width: 340,
  rowHeight: 16,
  rowGap: 6,
  // 右邊留白要夠放下最後一個日期刻度（置中於最右邊那格）的半個字寬，和折線圖一樣
  margin: { top: 4, right: 20, bottom: 20, left: 40 },
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

function groupRow(label: string, group: DayGroup) {
  return (
    <tr key={label}>
      <th scope="row">{label}</th>
      <td>{group.days} 天</td>
      <td>{group.moodAvg ?? '—'}</td>
      <td>{group.symptomBase > 0 ? `${group.symptomDays}／${group.symptomBase} 天` : '—'}</td>
    </tr>
  )
}

function DailyChart({ daily, periodText }: { daily: Daily; periodText: string }) {
  const headingId = useId()
  const { cells, startDate, days } = daily
  const hasData = cells.some(
    (c) => c.sleepHours !== undefined || c.mood !== undefined || c.symptomLevel !== undefined,
  )

  if (!hasData) {
    return (
      <figure className="trend" aria-labelledby={headingId}>
        <h3 id={headingId}>睡眠、心情與症狀對照</h3>
        <p>{periodText}還沒有睡眠、心情或症狀的紀錄</p>
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
  // 刻度與折線圖相同，最右邊是今天
  const xTicks = tickDayIndexes(days).map((dayIndex) => ({
    x: xOf(dayIndex) + cellWidth / 2,
    label: labelOf(startDate, dayIndex),
  }))

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
        aria-label={`${periodText}睡眠、心情與症狀一覽，共 ${cells.length} 天有紀錄`}
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
          // 每格太窄（1 年時不到 1 像素）就不留間隔，連成一條色帶
          const gap = cellWidth > 3 ? 1 : 0
          const x = xOf(cell.dayIndex) + gap / 2
          const width = cellWidth - gap
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

/** 固定用藥的服藥天數，以及有吃、沒吃的日子在心情與症狀上的對照；區間內沒有固定用藥就不顯示 */
function MedicationChart({
  items,
  periodText,
}: {
  items: MedicationTrendItem[]
  periodText: string
}) {
  const headingId = useId()
  if (items.length === 0) return null

  return (
    <figure className="trend series-mood" aria-labelledby={headingId}>
      <h3 id={headingId}>固定用藥</h3>
      <p>{periodText}的服藥天數；沒有標「沒吃」的日子都算有吃。</p>
      {items.map(({ medication, scheduledDays, missedDays, taken, missed }) => {
        const takenDays = scheduledDays - missedDays
        const comparable = taken.days >= MIN_COMPARE_DAYS && missed.days >= MIN_COMPARE_DAYS
        return (
          <section key={medication.id} className="medication-trend" aria-label={medication.name}>
            <p>
              <strong>{medication.name}</strong>
              {'　'}服藥 {takenDays}／{scheduledDays} 天
              {missedDays > 0 && `（沒吃 ${missedDays} 天）`}
            </p>
            {/* 長條只是把上面的天數畫出來，不重複給讀屏軟體 */}
            <span className="symptom-track" aria-hidden="true">
              <span
                className="symptom-seg"
                style={{ width: `${(takenDays / scheduledDays) * 100}%` }}
              />
            </span>
            {comparable ? (
              <table aria-label={`${medication.name}有吃與沒吃的對照`}>
                <thead>
                  <tr>
                    <th scope="col">分組</th>
                    <th scope="col">天數</th>
                    <th scope="col">平均心情</th>
                    <th scope="col">有症狀</th>
                  </tr>
                </thead>
                <tbody>
                  {groupRow('有吃', taken)}
                  {groupRow('沒吃', missed)}
                </tbody>
              </table>
            ) : (
              <p className="trend-note">
                {missedDays === 0
                  ? '這段期間都有吃，沒有沒吃的日子可以對照。'
                  : `有吃（${taken.days} 天）與沒吃（${missed.days} 天）的紀錄各累積 ${MIN_COMPARE_DAYS} 天後，才會顯示心情與症狀的對照。`}
              </p>
            )}
          </section>
        )
      })}
      <p className="trend-note">對照只算有填紀錄的日子；天數少的時候，差異可能只是巧合。</p>
    </figure>
  )
}

/**
 * @param periodText 說明文字開頭的期間，例如「最近 30 天」或「這段期間」
 */
export function SymptomChart({ trend, periodText }: { trend: SymptomTrend; periodText: string }) {
  const headingId = useId()
  const { recordedDays, textOnlyDays, items } = trend

  return (
    <figure className="trend series-symptom" aria-labelledby={headingId}>
      <h3 id={headingId}>症狀出現天數</h3>
      <p>
        {periodText}有 {recordedDays} 天有紀錄
      </p>
      {items.length === 0 ? (
        <p>{periodText}還沒有點選記錄的症狀</p>
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

export function TrendCharts({ entries, today, medications = [] }: Props) {
  const [range, setRange] = useState<Range>(RANGES[0])
  const { days, label: period } = range
  const periodText = `最近 ${period}`
  const trends = buildTrends(entries, today, days)
  const symptoms = buildSymptomTrend(entries, today, days)
  const daily = buildDaily(entries, today, days)
  const medicationTrend = buildMedicationTrend(medications, entries, daily, today)

  return (
    <Section title={`最近 ${period}趨勢`}>
      {/* 體重這類變化要看幾個月才看得出走向，可以拉長區間 */}
      <Group role="group" aria-label="趨勢區間" gap="xs" mb="md" grow>
        {RANGES.map((r) => (
          <Button
            key={r.days}
            type="button"
            size="compact-md"
            variant={r.days === days ? 'filled' : 'default'}
            aria-pressed={r.days === days}
            onClick={() => setRange(r)}
          >
            {r.label}
          </Button>
        ))}
      </Group>
      <TrendChart
        title="體重趨勢"
        subject="體重"
        valueHeader="體重"
        unit="kg"
        emptyText={`${periodText}還沒有體重紀錄`}
        seriesClass="series-weight"
        points={trends.weight}
        startDate={trends.startDate}
        days={days}
        carry={{ carriedIn: trends.weightCarriedIn }}
      />
      <TrendChart
        title="睡眠時數趨勢"
        subject="睡眠時數"
        valueHeader="睡眠時數"
        unit="小時"
        emptyText={`${periodText}還沒有睡眠紀錄（需要填入睡與起床時間）`}
        seriesClass="series-sleep"
        points={trends.sleepHours}
        startDate={trends.startDate}
        days={days}
        note={suspectSleepNote(trends.suspectSleepDates)}
      />
      <DailyChart daily={daily} periodText={periodText} />
      <MedicationChart items={medicationTrend} periodText={periodText} />
      <SymptomChart trend={symptoms} periodText={periodText} />
    </Section>
  )
}
