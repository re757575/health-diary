import { summarizeGroup, type Daily, type DayGroup } from './daily'
import type { Entry } from './entry'
import { toDateString } from './form'
import type { Medication } from './medication'
import { daysBetween } from './trend'

export interface MedicationTrendItem {
  medication: Medication
  /** 區間內在服用期間的天數，算到今天為止 */
  scheduledDays: number
  /** 標了沒吃的天數 */
  missedDays: number
  /** 有吃的日子（期間內有紀錄、沒標沒吃）的心情與症狀；沒紀錄的日子無從比較，不算 */
  taken: DayGroup
  /** 標了沒吃的日子的心情與症狀 */
  missed: DayGroup
}

/**
 * 區間（`daily` 的起點到 `today`）內每種固定用藥的服藥天數，以及有吃與沒吃的日子在心情、症狀上的對照。
 * 固定用藥沒標「沒吃」就算有吃，所以服藥天數 = 期間天數 − 沒吃天數。
 * 區間內不在服用期間（還沒開始、或已停吃）的藥不列出；順序依開始日期
 */
export function buildMedicationTrend(
  medications: Medication[],
  entries: Entry[],
  daily: Daily,
  today: Date,
): MedicationTrendItem[] {
  const windowStart = daily.startDate
  const windowEnd = toDateString(today)
  const missedOn = new Map(entries.map((e) => [e.date, new Set(e.missedMedications ?? [])]))

  return [...medications]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .flatMap((medication) => {
      const from = medication.startDate > windowStart ? medication.startDate : windowStart
      const end = medication.endDate ?? windowEnd
      const to = end < windowEnd ? end : windowEnd
      if (from > to) return []

      const inPeriod = daily.cells.filter((c) => c.date >= from && c.date <= to)
      const isMissed = (date: string) => missedOn.get(date)?.has(medication.id) ?? false
      // 「沒吃」只能在當天的紀錄裡標，所以從紀錄數就夠
      const missedDays = entries.filter(
        (e) => e.date >= from && e.date <= to && isMissed(e.date),
      ).length

      return [
        {
          medication,
          scheduledDays: daysBetween(from, to) + 1,
          missedDays,
          taken: summarizeGroup(inPeriod.filter((c) => !isMissed(c.date))),
          missed: summarizeGroup(inPeriod.filter((c) => isMissed(c.date))),
        },
      ]
    })
}
