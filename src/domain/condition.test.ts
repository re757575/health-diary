import { describe, expect, it } from 'vitest'
import { conditionSchema, conditionToForm, emptyConditionForm, formToCondition } from './condition'

describe('formToCondition', () => {
  it('只填名稱：其餘欄位省略，狀態預設為穩定控制中', () => {
    const condition = formToCondition({ ...emptyConditionForm(), name: '  高血壓  ' }, 'c1')
    expect(condition).toEqual({
      id: 'c1',
      name: '高血壓',
      since: undefined,
      status: 'managed',
      notes: undefined,
    })
    expect(conditionSchema.safeParse(condition).success).toBe(true)
  })

  it('表單 → Condition → 表單內容不變', () => {
    const form = {
      name: '胃食道逆流',
      since: '2024-02',
      status: 'active' as const,
      notes: '睡前勿進食',
    }
    expect(conditionToForm(formToCondition(form, 'c1'))).toEqual(form)
  })
})

describe('conditionSchema', () => {
  const base = { id: 'c1', name: '高血壓', status: 'managed' }

  it('開始時間只有年月，可省略', () => {
    expect(conditionSchema.safeParse(base).success).toBe(true)
    expect(conditionSchema.safeParse({ ...base, since: '2020-03' }).success).toBe(true)
  })

  it.each([
    ['名稱空白', { ...base, name: '   ' }],
    ['月份超出範圍', { ...base, since: '2020-13' }],
    ['開始時間含日', { ...base, since: '2020-03-01' }],
    ['未知的狀態', { ...base, status: 'cured' }],
    ['缺少 id', { ...base, id: '' }],
  ])('拒絕：%s', (_name, input) => {
    expect(conditionSchema.safeParse(input).success).toBe(false)
  })
})
