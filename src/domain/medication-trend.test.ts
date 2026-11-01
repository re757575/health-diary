import { describe, expect, it } from 'vitest'
import { buildDaily } from './daily'
import type { Entry } from './entry'
import type { Medication } from './medication'
import { buildMedicationTrend } from './medication-trend'

const today = new Date(2026, 9, 31)
const entry = (date: string, extra: Partial<Entry> = {}): Entry => ({
  date,
  meals: [],
  bowel: [],
  ...extra,
})
const trendOf = (medications: Medication[], entries: Entry[], days = 30) =>
  buildMedicationTrend(medications, entries, buildDaily(entries, today, days), today)

const vitC: Medication = { id: 'c', name: '維他命C', startDate: '2026-10-22' }

describe('buildMedicationTrend', () => {
  it('期間天數從開始日算到今天；沒標沒吃的日子（包括沒紀錄的）都算有吃', () => {
    const [item] = trendOf(
      [vitC],
      [
        entry('2026-10-25', { missedMedications: ['c'] }),
        entry('2026-10-26', { missedMedications: ['other'] }),
      ],
    )
    expect(item).toMatchObject({ scheduledDays: 10, missedDays: 1 })
  })

  it('開始日在區間之前就從區間起點算；停吃的算到最後一天；不在區間內的不列', () => {
    const items = trendOf(
      [
        { id: 'old', name: '魚油', startDate: '2026-01-01', endDate: '2026-10-05' },
        { id: 'gone', name: '鈣片', startDate: '2026-01-01', endDate: '2026-09-01' },
        { id: 'later', name: '鐵劑', startDate: '2026-11-05' },
      ],
      [],
    )
    // 30 天區間是 10/02～10/31
    expect(items.map((i) => [i.medication.id, i.scheduledDays])).toEqual([['old', 4]])
  })

  it('有吃與沒吃的日子分別算心情與症狀；只算期間內有紀錄的日子', () => {
    const sleep = { bedtime: '23:00', wakeTime: '07:00' }
    const [item] = trendOf(
      [vitC],
      [
        entry('2026-10-20', { mood: 1 }), // 開始吃之前，不算
        entry('2026-10-23', { mood: 4, sleep }),
        entry('2026-10-24', { mood: 5, sleep }),
        entry('2026-10-25', {
          mood: 2,
          sleep,
          missedMedications: ['c'],
          symptomItems: [{ name: '頭痛', severity: 2 }],
        }),
      ],
    )
    expect(item!.taken).toEqual({ days: 2, moodAvg: 4.5, symptomDays: 0, symptomBase: 2 })
    expect(item!.missed).toEqual({ days: 1, moodAvg: 2, symptomDays: 1, symptomBase: 1 })
  })
})
