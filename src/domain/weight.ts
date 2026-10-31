import type { Entry } from './entry'

export interface DayWeight {
  kg: number
  /** 實際量體重的那天；和查詢的日期不同，代表是沿用之前的數值 */
  measuredOn: string
}

/**
 * 某天的體重：當天有量就用當天的；沒量就沿用之前最近一次量的數值（體重不會天天量，沒量視為沒變）。
 * 之前都沒量過回傳 undefined。只存實際量的數值、需要時才推算，日後補上某天的實際體重，之後的日子會跟著更新
 */
export function weightOn(entries: Entry[], date: string): DayWeight | undefined {
  let found: DayWeight | undefined
  for (const e of entries) {
    if (e.weightKg === undefined || e.date > date) continue
    if (!found || e.date > found.measuredOn) found = { kg: e.weightKg, measuredOn: e.date }
  }
  return found
}
