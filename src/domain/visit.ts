import { z } from 'zod'
import { collectNames } from './choice'
import { SEVERITY_LABELS, type Entry } from './entry'
import { daysBetween } from './trend'

const DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * 一次就醫（看診）的紀錄，以 id 為主鍵；同一天可以看好幾科，所以不併進每天的紀錄。
 * 只有日期與診所／醫院必填，其餘都是選填的文字
 */
export const visitSchema = z
  .object({
    id: z.string().min(1),
    /** 看診日期 */
    date: z.string().regex(DATE),
    /** 診所或醫院 */
    facility: z.string().trim().min(1),
    /** 科別，例如「家醫科」 */
    department: z.string().optional(),
    /** 看診醫師 */
    doctor: z.string().optional(),
    /** 症狀、看診原因 */
    symptoms: z.string().optional(),
    /** 做了哪些檢查、檢驗與結果 */
    examinations: z.string().optional(),
    /** 醫師的診斷 */
    diagnosis: z.string().optional(),
    /** 醫囑：生活、飲食上要注意的事 */
    advice: z.string().optional(),
    /** 開的藥 */
    prescription: z.string().optional(),
    /** 下次回診日期 */
    followUpDate: z.string().regex(DATE).optional(),
    notes: z.string().optional(),
  })
  .refine((v) => !v.followUpDate || v.followUpDate >= v.date, {
    message: '回診日期不能早於就醫日期',
    path: ['followUpDate'],
  })

export type Visit = z.infer<typeof visitSchema>

const byFacility = (a: Visit, b: Visit) => a.facility.localeCompare(b.facility, 'zh-Hant')

/** 由新到舊；同一天的依診所名稱 */
export function sortVisits(visits: Visit[]): Visit[] {
  return [...visits].sort((a, b) => b.date.localeCompare(a.date) || byFacility(a, b))
}

/** 期間內（含頭尾）的就醫紀錄，由舊到新；同一天的依診所名稱 */
export function visitsDuring(visits: Visit[], startDate: string, endDate: string): Visit[] {
  return visits
    .filter((v) => v.date >= startDate && v.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date) || byFacility(a, b))
}

/** 「○○診所（家醫科，王醫師）」 */
export function describeVisit(visit: Visit): string {
  const who = [visit.department?.trim(), visit.doctor?.trim()].filter(Boolean)
  return who.length > 0 ? `${visit.facility}（${who.join('，')}）` : visit.facility
}

/** 顯示用的各項內容（沒填的不列），報告、AI 提示詞與清單共用 */
export function visitDetails(visit: Visit): { label: string; value: string }[] {
  const rows: [string, string | undefined][] = [
    ['症狀', visit.symptoms],
    ['檢查', visit.examinations],
    ['診斷', visit.diagnosis],
    ['醫囑', visit.advice],
    ['處方', visit.prescription],
    ['下次回診', visit.followUpDate],
    ['備註', visit.notes],
  ]
  return rows.flatMap(([label, value]) => (value?.trim() ? [{ label, value: value.trim() }] : []))
}

export interface FollowUp {
  visit: Visit
  /** 距離今天幾天，今天為 0 */
  daysLeft: number
}

/**
 * 還沒到的回診（含今天），日期近的在前。
 * 同一家之後又有就醫紀錄的不算：多半已經回診過，或改了別的日子
 */
export function upcomingFollowUps(visits: Visit[], today: string): FollowUp[] {
  return visits
    .filter(
      (v) =>
        v.followUpDate !== undefined &&
        v.followUpDate >= today &&
        !visits.some((other) => other.facility === v.facility && other.date > v.date),
    )
    .map((visit) => ({ visit, daysLeft: daysBetween(today, visit.followUpDate!) }))
    .sort((a, b) => a.daysLeft - b.daysLeft)
}

/** 「今天」分頁在回診前幾天開始提醒 */
export const FOLLOW_UP_REMINDER_DAYS = 3

/** 「今天」「明天」「3 天後」 */
export function describeDaysLeft(daysLeft: number): string {
  if (daysLeft === 0) return '今天'
  if (daysLeft === 1) return '明天'
  return `${daysLeft} 天後`
}

/** 診所、科別、醫師的候選清單：過去填過的，依名稱排序 */
export function collectVisitNames(
  visits: Visit[],
  key: 'facility' | 'department' | 'doctor',
): string[] {
  return collectNames(
    [],
    visits.flatMap((v) => v[key]?.trim() || []),
  )
}

/** 每日紀錄裡的症狀寫成一段文字，例如「頭痛（中）、咳嗽（輕）；喉嚨有點癢」；沒有就是空字串 */
export function entrySymptomsText(entry: Entry | undefined): string {
  if (!entry) return ''
  const items = (entry.symptomItems ?? [])
    .map((i) => `${i.name}（${SEVERITY_LABELS[i.severity]}）`)
    .join('、')
  return [items, entry.symptoms?.trim()].filter(Boolean).join('；')
}

/** 表單欄位一律是字串，空字串代表沒填 */
export interface VisitFormValues {
  date: string
  facility: string
  department: string
  doctor: string
  symptoms: string
  examinations: string
  diagnosis: string
  advice: string
  prescription: string
  followUpDate: string
  notes: string
}

export const emptyVisitForm = (today: string): VisitFormValues => ({
  date: today,
  facility: '',
  department: '',
  doctor: '',
  symptoms: '',
  examinations: '',
  diagnosis: '',
  advice: '',
  prescription: '',
  followUpDate: '',
  notes: '',
})

const toText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value.trim()

/** 表單 → Visit：空欄位省略。是否合法交給 visitSchema 驗證 */
export function formToVisit(form: VisitFormValues, id: string): Visit {
  return {
    id,
    date: form.date,
    facility: form.facility.trim(),
    department: toText(form.department),
    doctor: toText(form.doctor),
    symptoms: toText(form.symptoms),
    examinations: toText(form.examinations),
    diagnosis: toText(form.diagnosis),
    advice: toText(form.advice),
    prescription: toText(form.prescription),
    followUpDate: toText(form.followUpDate),
    notes: toText(form.notes),
  }
}

export function visitToForm(visit: Visit): VisitFormValues {
  return {
    date: visit.date,
    facility: visit.facility,
    department: visit.department ?? '',
    doctor: visit.doctor ?? '',
    symptoms: visit.symptoms ?? '',
    examinations: visit.examinations ?? '',
    diagnosis: visit.diagnosis ?? '',
    advice: visit.advice ?? '',
    prescription: visit.prescription ?? '',
    followUpDate: visit.followUpDate ?? '',
    notes: visit.notes ?? '',
  }
}
