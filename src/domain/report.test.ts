import { describe, expect, it } from 'vitest'
import type { Entry } from './entry'
import {
  asNeededDays,
  entriesInRange,
  notableDays,
  reportRange,
  summarizeReport,
  type ReportRange,
} from './report'

const entry = (date: string, extra: Partial<Entry> = {}): Entry => ({
  date,
  meals: [],
  bowel: [],
  ...extra,
})

describe('reportRange', () => {
  it('計算含頭尾的天數', () => {
    expect(reportRange('2026-10-01', '2026-10-31')).toEqual({
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      days: 31,
    })
    expect(reportRange('2026-10-31', '2026-10-31')).toMatchObject({ days: 1 })
  })

  it('沒選日期、開始晚於結束、超過 366 天時回傳說明', () => {
    expect(reportRange('', '2026-10-31')).toEqual({ error: '請選擇開始與結束日期' })
    expect(reportRange('2026-11-01', '2026-10-31')).toEqual({ error: '開始日期不能晚於結束日期' })
    expect(reportRange('2025-01-01', '2026-10-31')).toEqual({
      error: '範圍最長 366 天，請縮短期間',
    })
  })
})

describe('summarizeReport', () => {
  const range = reportRange('2026-10-01', '2026-10-31') as ReportRange

  it('只取範圍內的紀錄，由舊到新', () => {
    const inRange = entriesInRange(
      [entry('2026-10-05'), entry('2026-09-30'), entry('2026-10-01'), entry('2026-11-01')],
      range,
    )
    expect(inRange.map((e) => e.date)).toEqual(['2026-10-01', '2026-10-05'])
  })

  it('體重看第一次與最後一次量的；睡眠平均不算疑似填錯的；睡不夠的天數', () => {
    const summary = summarizeReport([
      entry('2026-10-01', { weightKg: 70, sleep: { bedtime: '23:00', wakeTime: '07:00' } }),
      entry('2026-10-02', { sleep: { bedtime: '01:00', wakeTime: '06:00' }, mood: 2 }),
      entry('2026-10-03', {
        weightKg: 68.5,
        sleep: { bedtime: '11:50', wakeTime: '07:40' },
        mood: 5,
      }),
    ])
    expect(summary).toMatchObject({
      recordedDays: 3,
      weight: {
        first: { date: '2026-10-01', kg: 70 },
        last: { date: '2026-10-03', kg: 68.5 },
        change: -1.5,
      },
      sleep: { nights: 2, averageHours: 6.5, shortNights: 1 },
      mood: { days: 2, average: 3.5 },
    })
  })

  it('排便：平均每天幾次（確認沒排便的算 0 次）、硬便與腹瀉的天數；沒記錄的日子不算', () => {
    const summary = summarizeReport([
      entry('2026-10-01', { bowel: [{ bristol: 1 }, { bristol: 4 }] }),
      entry('2026-10-02', { bowel: [{ bristol: 7 }] }),
      entry('2026-10-03', { noBowel: true }),
      entry('2026-10-04'),
    ])
    expect(summary.bowel).toEqual({ days: 3, averagePerDay: 1, hardDays: 1, looseDays: 1 })
  })

  it('什麼都沒記錄時只有天數', () => {
    expect(summarizeReport([entry('2026-10-01')])).toEqual({ recordedDays: 1 })
  })
})

describe('notableDays', () => {
  it('只列有症狀、臨時用藥、沒吃藥或異常排便的日子', () => {
    const days = notableDays(
      [
        entry('2026-10-01', { mood: 4, bowel: [{ bristol: 4 }] }),
        entry('2026-10-02', {
          symptomItems: [{ name: '頭痛', severity: 2 }],
          symptoms: '下午比較嚴重',
          asNeededMedications: ['普拿疼'],
        }),
        entry('2026-10-03', { missedMedications: ['c', 'deleted'], bowel: [{ bristol: 6 }] }),
      ],
      new Map([['c', '維他命C']]),
    )
    expect(days).toEqual([
      {
        date: '2026-10-02',
        symptoms: ['頭痛（中）'],
        symptomNote: '下午比較嚴重',
        asNeeded: ['普拿疼'],
        missedMedications: [],
        abnormalBowel: [],
      },
      {
        date: '2026-10-03',
        symptoms: [],
        asNeeded: [],
        missedMedications: ['維他命C'],
        abnormalBowel: ['布里斯托 6 型'],
      },
    ])
  })
})

describe('asNeededDays', () => {
  it('每種臨時用藥吃了幾天，同一天重複只算一次，天數多的在前', () => {
    expect(
      asNeededDays([
        entry('2026-10-01', { asNeededMedications: ['普拿疼', '普拿疼'] }),
        entry('2026-10-02', { asNeededMedications: ['胃藥', '普拿疼'] }),
      ]),
    ).toEqual([
      { name: '普拿疼', days: 2 },
      { name: '胃藥', days: 1 },
    ])
  })
})
