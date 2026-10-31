import { describe, expect, it } from 'vitest'
import { emptyForm } from '@/domain/form'
import { clearDraft, loadDraft, saveDraft } from './draft'

const form = (date: string, weightKg = '70') => ({ ...emptyForm(date), weightKg })

describe('草稿', () => {
  it('依日期各存一份，讀得回來；清掉一天不影響其他天', () => {
    const now = new Date('2026-10-31T12:00:00Z')
    saveDraft(form('2026-10-30'), now)
    saveDraft(form('2026-10-31', '71'), now)

    expect(loadDraft('2026-10-31')).toEqual({
      form: form('2026-10-31', '71'),
      savedAt: now.toISOString(),
    })
    clearDraft('2026-10-31')
    expect(loadDraft('2026-10-31')).toBeUndefined()
    expect(loadDraft('2026-10-30')?.form.weightKg).toBe('70')
  })

  it('存檔時清掉 30 天以前的草稿', () => {
    saveDraft(form('2026-09-01'), new Date('2026-09-01T12:00:00Z'))
    saveDraft(form('2026-10-31'), new Date('2026-10-31T12:00:00Z'))
    expect(loadDraft('2026-09-01')).toBeUndefined()
    expect(loadDraft('2026-10-31')).toBeDefined()
  })

  it('內容損壞或格式不對時當作沒有，不拋出', () => {
    localStorage.setItem('health-diary:drafts', '{壞掉的 JSON')
    expect(loadDraft('2026-10-31')).toBeUndefined()
    localStorage.setItem('health-diary:drafts', JSON.stringify({ '2026-10-31': { form: 1 } }))
    expect(loadDraft('2026-10-31')).toBeUndefined()
    expect(() => saveDraft(form('2026-10-31'))).not.toThrow()
  })
})
