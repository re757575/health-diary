import { Button, Group, Stack, Text, TextInput } from '@mantine/core'
import { useLiveQuery } from 'dexie-react-hooks'
import { Fragment, useState } from 'react'
import { getProfile, listConditions } from '@/data/repository'
import { CONDITION_STATUS_LABELS } from '@/domain/condition'
import { buildDaily } from '@/domain/daily'
import type { Entry } from '@/domain/entry'
import { shiftDate, toDateString } from '@/domain/form'
import { formatPeriod, medicationsDuring, type Medication } from '@/domain/medication'
import { buildMedicationTrend } from '@/domain/medication-trend'
import { SEX_LABELS, ageOn } from '@/domain/profile'
import {
  asNeededDays,
  entriesInRange,
  notableDays,
  reportRange,
  summarizeReport,
  type ReportRange,
} from '@/domain/report'
import { buildSymptomTrend, buildTrends, suspectSleepNote } from '@/domain/trend'
import { Section } from './Section'
import { SymptomChart, TrendChart } from './TrendCharts'

interface Props {
  /** 全部紀錄（體重沿用要看範圍之前的） */
  entries: Entry[]
  medications: Medication[]
}

const QUICK_RANGES = [7, 30, 90]
const WEEKDAYS = '日一二三四五六'

/** YYYY-MM-DD → 本地時間的 Date（趨勢圖以這天為區間的最後一天） */
function toLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

/** 10/28 */
const shortDate = (date: string) => date.slice(5).replace('-', '/')

/** 2026-10-28（三） */
const withWeekday = (date: string) => `${date}（${WEEKDAYS[toLocalDate(date).getDay()]}）`

const formatChange = (change: number) =>
  change === 0 ? '±0' : change > 0 ? `+${change}` : `−${-change}`

/**
 * 就醫報告：選一段期間，整理給醫生看的重點（不是每天的完整紀錄）。
 * 可以直接給醫生看，或列印、存成 PDF；列印時只印報告本身
 */
export function Report({ entries, medications }: Props) {
  const today = toDateString(new Date())
  const [startDate, setStartDate] = useState(() => shiftDate(today, -29))
  const [endDate, setEndDate] = useState(today)
  const range = reportRange(startDate, endDate)

  function pickRecent(days: number) {
    const end = toDateString(new Date())
    setEndDate(end)
    setStartDate(shiftDate(end, -(days - 1)))
  }

  return (
    <Stack gap="md">
      <div className="no-print">
        <Section title="就醫報告">
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              選一段期間，整理給醫生看的重點：基本資料、用藥、期間摘要、趨勢圖與有狀況的日子。可以直接給醫生看，或列印、存成
              PDF。
            </Text>
            <Group gap="xs" role="group" aria-label="快速選擇期間" grow>
              {QUICK_RANGES.map((days) => (
                <Button
                  key={days}
                  type="button"
                  size="compact-md"
                  variant="default"
                  onClick={() => pickRecent(days)}
                >
                  最近 {days} 天
                </Button>
              ))}
            </Group>
            <div className="fields">
              <TextInput
                label="開始"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <TextInput
                label="結束"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            {'error' in range && (
              <Text size="sm" c="red" role="alert">
                {range.error}
              </Text>
            )}
            <Button type="button" onClick={() => window.print()} disabled={'error' in range}>
              列印／存成 PDF
            </Button>
          </Stack>
        </Section>
      </div>

      {!('error' in range) && (
        <ReportContent entries={entries} medications={medications} range={range} />
      )}
    </Stack>
  )
}

function ReportContent({
  entries,
  medications,
  range,
}: Props & {
  range: ReportRange
}) {
  const conditions = useLiveQuery(listConditions, [])
  const profile = useLiveQuery(async () => ({ value: await getProfile() }), [])
  const end = toLocalDate(range.endDate)
  const inRange = entriesInRange(entries, range)
  const summary = summarizeReport(inRange)
  const trends = buildTrends(entries, end, range.days)
  const symptoms = buildSymptomTrend(entries, end, range.days)
  const adherence = buildMedicationTrend(
    medications,
    entries,
    buildDaily(entries, end, range.days),
    end,
  )
  const asNeeded = asNeededDays(inRange)
  const days = notableDays(inRange, new Map(medications.map((m) => [m.id, m.name])))
  // 已痊癒的疾病對這次看診多半不重要，不列
  const ongoing = (conditions ?? []).filter((c) => c.status !== 'resolved')
  const p = profile?.value
  const age = p?.birthday ? ageOn(p.birthday, end) : undefined
  const basics = [
    p?.sex && SEX_LABELS[p.sex],
    age !== undefined && `${age} 歲`,
    p?.heightCm !== undefined && `身高 ${p.heightCm} cm`,
  ].filter(Boolean)
  const periodMeds = medicationsDuring(medications, range.startDate, range.endDate)

  const summaryRows = [
    summary.weight && {
      label: '體重',
      value: `${summary.weight.first.kg} → ${summary.weight.last.kg} kg（${formatChange(summary.weight.change)} kg，${shortDate(summary.weight.first.date)}～${shortDate(summary.weight.last.date)}）`,
    },
    summary.sleep && {
      label: '睡眠',
      value: `平均 ${summary.sleep.averageHours} 小時（${summary.sleep.nights} 晚），睡不到 6.5 小時 ${summary.sleep.shortNights} 晚`,
    },
    summary.mood && {
      label: '心情',
      value: `平均 ${summary.mood.average}／5（${summary.mood.days} 天）`,
    },
    summary.bowel && {
      label: '排便',
      value: `平均每天 ${summary.bowel.averagePerDay} 次；硬便 ${summary.bowel.hardDays} 天、腹瀉 ${summary.bowel.looseDays} 天（${summary.bowel.days} 天有記錄）`,
    },
  ].filter((row): row is { label: string; value: string } => Boolean(row))

  return (
    <div className="report">
      <Stack gap="md">
        <Section title="健康紀錄報告">
          <Stack gap={4}>
            <Text>
              {range.startDate}～{range.endDate}（{range.days} 天，有紀錄 {summary.recordedDays}{' '}
              天）
            </Text>
            {basics.length > 0 && <Text>{basics.join('，')}</Text>}
            <Text size="sm" c="dimmed">
              產生日期：{toDateString(new Date())}（由健康日記 App 整理，數值為本人自行記錄）
            </Text>
          </Stack>
        </Section>

        {ongoing.length > 0 && (
          <Section title="已知疾病">
            <Stack component="ul" gap={4} m={0} pl="md">
              {ongoing.map((c) => (
                <Text component="li" key={c.id}>
                  {c.name}（
                  {[CONDITION_STATUS_LABELS[c.status], c.since && `${c.since} 起`]
                    .filter(Boolean)
                    .join('，')}
                  ）{c.notes?.trim() && `：${c.notes.trim()}`}
                </Text>
              ))}
            </Stack>
          </Section>
        )}

        {(periodMeds.length > 0 || asNeeded.length > 0) && (
          <Section title="用藥">
            <Stack component="ul" gap={4} m={0} pl="md">
              {periodMeds.map((m) => {
                const item = adherence.find((a) => a.medication.id === m.id)
                return (
                  <Text component="li" key={m.id}>
                    {m.name}
                    {m.dose && `（${m.dose}）`}：{formatPeriod(m)}
                    {item &&
                      `，服藥 ${item.scheduledDays - item.missedDays}／${item.scheduledDays} 天` +
                        (item.missedDays > 0 ? `（沒吃 ${item.missedDays} 天）` : '')}
                  </Text>
                )
              })}
              {asNeeded.map((a) => (
                <Text component="li" key={a.name}>
                  臨時用藥：{a.name}，{a.days} 天
                </Text>
              ))}
            </Stack>
          </Section>
        )}

        <Section title="期間摘要">
          {summaryRows.length > 0 ? (
            <table className="report-table" aria-label="期間摘要">
              <tbody>
                {summaryRows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Text>這段期間沒有可以摘要的紀錄。</Text>
          )}
        </Section>

        <Section title="趨勢">
          <TrendChart
            title="體重趨勢"
            subject="體重"
            valueHeader="體重"
            unit="kg"
            emptyText="這段期間沒有體重紀錄"
            seriesClass="series-weight"
            points={trends.weight}
            startDate={trends.startDate}
            days={range.days}
            carry={{ carriedIn: trends.weightCarriedIn }}
          />
          <TrendChart
            title="睡眠時數趨勢"
            subject="睡眠時數"
            valueHeader="睡眠時數"
            unit="小時"
            emptyText="這段期間沒有睡眠紀錄"
            seriesClass="series-sleep"
            points={trends.sleepHours}
            startDate={trends.startDate}
            days={range.days}
            note={suspectSleepNote(trends.suspectSleepDates)}
          />
          <SymptomChart trend={symptoms} periodText="這段期間" />
        </Section>

        <Section title="有狀況的日子">
          {days.length === 0 ? (
            <Text>這段期間沒有症狀、臨時用藥或異常排便的紀錄。</Text>
          ) : (
            <dl className="report-days">
              {days.map((d) => (
                <Fragment key={d.date}>
                  <dt>{withWeekday(d.date)}</dt>
                  <dd>
                    {[
                      d.symptoms.length > 0 && `症狀：${d.symptoms.join('、')}`,
                      d.symptomNote && `補充：${d.symptomNote}`,
                      d.asNeeded.length > 0 && `臨時用藥：${d.asNeeded.join('、')}`,
                      d.missedMedications.length > 0 &&
                        `固定用藥沒吃：${d.missedMedications.join('、')}`,
                      d.abnormalBowel.length > 0 && `排便：${d.abnormalBowel.join('、')}`,
                    ]
                      .filter(Boolean)
                      .map((line) => (
                        <div key={line as string}>{line}</div>
                      ))}
                  </dd>
                </Fragment>
              ))}
            </dl>
          )}
        </Section>
      </Stack>
    </div>
  )
}
