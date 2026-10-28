import { describe, expect, it } from 'vitest'
import { ageOn, emptyProfileForm, formToProfile, profileSchema, profileToForm } from './profile'

describe('ageOn', () => {
  it('生日當天滿歲，前一天還沒滿', () => {
    expect(ageOn('1990-05-20', new Date(2026, 4, 20))).toBe(36)
    expect(ageOn('1990-05-20', new Date(2026, 4, 19))).toBe(35)
  })

  it('跨年份、月份較小也正確', () => {
    expect(ageOn('1990-12-31', new Date(2026, 0, 1))).toBe(35)
  })

  it('生日在未來回傳 undefined', () => {
    expect(ageOn('2030-01-01', new Date(2026, 9, 28))).toBeUndefined()
  })

  it('不存在的日期回傳 undefined', () => {
    expect(ageOn('2025-02-30', new Date(2026, 9, 28))).toBeUndefined()
  })
})

describe('formToProfile / profileToForm', () => {
  it('空表單轉成全部省略的 profile', () => {
    expect(formToProfile(emptyProfileForm())).toEqual({})
  })

  it('身高轉成數字，並可還原成表單', () => {
    const form = { birthday: '1990-05-20', heightCm: '175.5', sex: 'female' as const }
    expect(formToProfile(form)).toEqual({ birthday: '1990-05-20', heightCm: 175.5, sex: 'female' })
    expect(profileToForm(formToProfile(form))).toEqual(form)
  })

  it('尚未填寫（undefined）還原成空表單', () => {
    expect(profileToForm(undefined)).toEqual(emptyProfileForm())
  })
})

describe('profileSchema', () => {
  it.each([
    ['身高為負數', { heightCm: -1 }],
    ['身高不合理', { heightCm: 500 }],
    ['生日格式錯誤', { birthday: '1990/05/20' }],
    ['未知的性別', { sex: 'x' }],
  ])('拒絕：%s', (_name, input) => {
    expect(profileSchema.safeParse(input).success).toBe(false)
  })

  it('全部選填，空物件合法', () => {
    expect(profileSchema.safeParse({}).success).toBe(true)
  })
})
