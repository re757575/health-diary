import { describe, expect, it } from 'vitest'
import type { Entry } from './entry'
import {
  activeMedications,
  collectAsNeededNames,
  emptyMedicationForm,
  formatPeriod,
  formToMedication,
  isActiveOn,
  medicationSchema,
  medicationsDuring,
  medicationToForm,
  type Medication,
} from './medication'

const vitC: Medication = { id: 'c', name: '維他命C', dose: '1000mg', startDate: '2026-10-20' }
const fishOil: Medication = {
  id: 'f',
  name: '魚油',
  startDate: '2026-09-01',
  endDate: '2026-10-15',
}

describe('固定用藥的期間', () => {
  it('開始日與最後一天都算在期間內', () => {
    expect(isActiveOn(vitC, '2026-10-19')).toBe(false)
    expect(isActiveOn(vitC, '2026-10-20')).toBe(true)
    expect(isActiveOn(fishOil, '2026-10-15')).toBe(true)
    expect(isActiveOn(fishOil, '2026-10-16')).toBe(false)
  })

  it('某天該吃的藥只列期間內的，依名稱排序', () => {
    const extra: Medication = { id: 'a', name: '鈣片', startDate: '2026-10-01' }
    expect(activeMedications([vitC, fishOil, extra], '2026-10-25').map((m) => m.id)).toEqual([
      'a',
      'c',
    ])
  })

  it('分析期間內有任何一天在吃的都列出，依開始日期排序', () => {
    expect(medicationsDuring([vitC, fishOil], '2026-10-10', '2026-10-31')).toEqual([fishOil, vitC])
    expect(medicationsDuring([vitC, fishOil], '2026-10-16', '2026-10-19')).toEqual([])
  })

  it('期間的寫法', () => {
    expect(formatPeriod(vitC)).toBe('2026-10-20 起')
    expect(formatPeriod(fishOil)).toBe('2026-09-01～2026-10-15')
  })
})

describe('固定用藥的表單', () => {
  it('空白的劑量與最後一天省略；表單與資料可互轉', () => {
    const form = { ...emptyMedicationForm('2026-11-01'), name: ' 維他命C ', dose: ' ' }
    const medication = formToMedication(form, 'id1')
    expect(medication).toEqual({ id: 'id1', name: '維他命C', startDate: '2026-11-01' })
    expect(medicationSchema.parse(medication)).toEqual(medication)
    expect(formToMedication(medicationToForm(vitC), 'c')).toEqual(vitC)
  })

  it('沒有名稱、最後一天早於開始日期都不合法', () => {
    expect(medicationSchema.safeParse({ ...vitC, name: ' ' }).success).toBe(false)
    expect(medicationSchema.safeParse({ ...vitC, endDate: '2026-10-19' }).success).toBe(false)
  })
})

describe('collectAsNeededNames', () => {
  it('列出過去用過的臨時用藥，不重複、依名稱排序', () => {
    const entry = (asNeededMedications?: string[]): Entry => ({
      date: '2026-10-28',
      meals: [],
      bowel: [],
      asNeededMedications,
    })
    expect(collectAsNeededNames([entry(['普拿疼']), entry(), entry(['胃藥', '普拿疼'])])).toEqual(
      ['普拿疼', '胃藥'].sort((a, b) => a.localeCompare(b, 'zh-Hant')),
    )
  })
})
