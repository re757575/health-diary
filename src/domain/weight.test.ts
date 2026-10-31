import { describe, expect, it } from 'vitest'
import type { Entry } from './entry'
import { weightOn } from './weight'

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
