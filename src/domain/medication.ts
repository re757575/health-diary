import { z } from 'zod'
import { collectNames } from './choice'
import type { Entry } from './entry'

const DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * 固定服用的藥物或保健食品（例如每天吃的維他命），以 id 為主鍵。
 * 登記後在期間內每天都當作有吃，哪天沒吃才在當天的紀錄標出（Entry.missedMedications）
 */
export const medicationSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1),
    /** 劑量與用法，例如「1000mg，每天 2 粒」 */
    dose: z.string().optional(),
    /** 開始固定服用的日期 */
    startDate: z.string().regex(DATE),
    /** 最後一天吃的日期（含）；還在吃就沒有 */
    endDate: z.string().regex(DATE).optional(),
  })
  .refine((m) => !m.endDate || m.endDate >= m.startDate, {
    message: '最後一天不能早於開始日期',
    path: ['endDate'],
  })

export type Medication = z.infer<typeof medicationSchema>

/** 這天是否在固定服用的期間內 */
export function isActiveOn(medication: Medication, date: string): boolean {
  return medication.startDate <= date && (!medication.endDate || date <= medication.endDate)
}

/** 這天該吃的固定用藥，依名稱排序 */
export function activeMedications(medications: Medication[], date: string): Medication[] {
  return medications
    .filter((m) => isActiveOn(m, date))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
}

/** 期間（含頭尾）內有任何一天在吃的固定用藥，依開始日期排序 */
export function medicationsDuring(
  medications: Medication[],
  startDate: string,
  endDate: string,
): Medication[] {
  return medications
    .filter((m) => m.startDate <= endDate && (!m.endDate || m.endDate >= startDate))
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
}

/** 「2026-10-20 起」或「2026-09-01～2026-10-15」 */
export function formatPeriod(medication: Medication): string {
  return medication.endDate
    ? `${medication.startDate}～${medication.endDate}`
    : `${medication.startDate} 起`
}

/** 臨時用藥的候選清單：過去紀錄裡用過的，依名稱排序 */
export function collectAsNeededNames(entries: Entry[]): string[] {
  return collectNames(
    [],
    entries.flatMap((e) => e.asNeededMedications ?? []),
  )
}

/** 表單欄位一律是字串，空字串代表沒填 */
export interface MedicationFormValues {
  name: string
  dose: string
  startDate: string
  endDate: string
}

export const emptyMedicationForm = (today: string): MedicationFormValues => ({
  name: '',
  dose: '',
  startDate: today,
  endDate: '',
})

const toText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value.trim()

/** 表單 → Medication：空欄位省略。是否合法交給 medicationSchema 驗證 */
export function formToMedication(form: MedicationFormValues, id: string): Medication {
  return {
    id,
    name: form.name.trim(),
    dose: toText(form.dose),
    startDate: form.startDate,
    endDate: toText(form.endDate),
  }
}

export function medicationToForm(medication: Medication): MedicationFormValues {
  return {
    name: medication.name,
    dose: medication.dose ?? '',
    startDate: medication.startDate,
    endDate: medication.endDate ?? '',
  }
}
