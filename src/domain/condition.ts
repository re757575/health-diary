import { z } from 'zod'

export const CONDITION_STATUSES = ['active', 'managed', 'resolved'] as const
export type ConditionStatus = (typeof CONDITION_STATUSES)[number]

export const CONDITION_STATUS_LABELS: Record<ConditionStatus, string> = {
  active: '治療中／有症狀',
  managed: '穩定控制中',
  resolved: '已痊癒',
}

/** 已知疾病（個人健康背景，不屬於某一天），以 id 為主鍵 */
export const conditionSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  /** 開始（確診）年月 YYYY-MM */
  since: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  status: z.enum(CONDITION_STATUSES),
  /** 用藥、醫囑、控制狀況等補充說明 */
  notes: z.string().optional(),
})

export type Condition = z.infer<typeof conditionSchema>

/** 表單欄位一律是字串，空字串代表沒填 */
export interface ConditionFormValues {
  name: string
  since: string
  status: ConditionStatus
  notes: string
}

export const emptyConditionForm = (): ConditionFormValues => ({
  name: '',
  since: '',
  status: 'managed',
  notes: '',
})

const toText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value.trim()

/** 表單 → Condition：空欄位省略。是否合法交給 conditionSchema 驗證 */
export function formToCondition(form: ConditionFormValues, id: string): Condition {
  return {
    id,
    name: form.name.trim(),
    since: toText(form.since),
    status: form.status,
    notes: toText(form.notes),
  }
}

export function conditionToForm(condition: Condition): ConditionFormValues {
  return {
    name: condition.name,
    since: condition.since ?? '',
    status: condition.status,
    notes: condition.notes ?? '',
  }
}
