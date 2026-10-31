import { describe, expect, it } from 'vitest'
import type { Entry } from './entry'
import { findSuspectWeights, isSuspectWeight, weightOn } from './weight'

const entry = (date: string, weightKg?: number): Entry => ({ date, weightKg, meals: [], bowel: [] })

describe('weightOn', () => {
  const entries = [entry('2026-10-30'), entry('2026-10-28', 69), entry('2026-10-20', 70)]

  it('當天有量就用當天的', () => {
    expect(weightOn(entries, '2026-10-28')).toEqual({ kg: 69, measuredOn: '2026-10-28' })
  })

  it('當天沒量（或沒有紀錄）就沿用之前最近一次，不受陣列順序影響', () => {
    expect(weightOn(entries, '2026-10-30')).toEqual({ kg: 69, measuredOn: '2026-10-28' })
    expect(weightOn(entries, '2026-10-25')).toEqual({ kg: 70, measuredOn: '2026-10-20' })
  })

  it('之前都沒量過就沒有；之後量的不往回沿用', () => {
    expect(weightOn(entries, '2026-10-19')).toBeUndefined()
    expect(weightOn([], '2026-10-28')).toBeUndefined()
  })
})

describe('isSuspectWeight', () => {
  it('和前一次差超過 10% 才算可疑，日常起伏不算', () => {
    expect(isSuspectWeight(71.5, 70)).toBe(false)
    expect(isSuspectWeight(77, 70)).toBe(false) // 剛好 10%
    expect(isSuspectWeight(77.1, 70)).toBe(true)
    expect(isSuspectWeight(700, 70)).toBe(true)
    expect(isSuspectWeight(7, 70)).toBe(true)
  })

  it('沒有前一次時，只看是否在 20～300 kg 的合理範圍', () => {
    expect(isSuspectWeight(70)).toBe(false)
    expect(isSuspectWeight(700)).toBe(true)
    expect(isSuspectWeight(7)).toBe(true)
  })
})

describe('findSuspectWeights', () => {
  it('每筆和它之前最近一次量的比較，日期由舊到新', () => {
    const entries = [
      entry('2026-10-30', 70.2),
      entry('2026-10-28', 700),
      entry('2026-10-27', 70),
      entry('2026-10-29'),
    ]
    expect(findSuspectWeights(entries)).toEqual([
      { date: '2026-10-28', kg: 700, previous: { kg: 70, measuredOn: '2026-10-27' } },
      // 10/28 的 700 也是打錯，但它是「前一次」，所以 10/30 和它比也會被標出
      { date: '2026-10-30', kg: 70.2, previous: { kg: 700, measuredOn: '2026-10-28' } },
    ])
  })

  it('前一次可以在要檢查的範圍之外，從 history 找', () => {
    const history = [entry('2026-09-01', 70), entry('2026-10-28', 7)]
    expect(findSuspectWeights([entry('2026-10-28', 7)], history)).toEqual([
      { date: '2026-10-28', kg: 7, previous: { kg: 70, measuredOn: '2026-09-01' } },
    ])
  })
})
