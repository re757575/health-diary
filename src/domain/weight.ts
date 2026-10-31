import type { Entry } from './entry'
import { shiftDate } from './form'

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

/** 和前一次量的體重相差超過這個比例，多半是打錯（例如 70 打成 700、7 或 77）；日常起伏約 1～2 kg，不會碰到 */
export const SUSPECT_WEIGHT_CHANGE = 0.1

/** 沒有前一次可以比較時，超出這個範圍就當作打錯 */
const PLAUSIBLE_KG = { min: 20, max: 300 }

/** 這個體重是否可能打錯：和前一次量的差超過 10%，或沒有前一次時不在合理範圍 */
export function isSuspectWeight(kg: number, previousKg?: number): boolean {
  if (previousKg === undefined) return kg < PLAUSIBLE_KG.min || kg > PLAUSIBLE_KG.max
  return Math.abs(kg - previousKg) / previousKg > SUSPECT_WEIGHT_CHANGE
}

export interface SuspectWeight {
  date: string
  kg: number
  /** 拿來比較的前一次體重；沒有前一次時是因為超出合理範圍 */
  previous?: DayWeight
}

/**
 * `entries` 裡可能打錯的體重，日期由舊到新
 * @param history 全部紀錄，用來找每筆之前最近一次量的體重
 */
export function findSuspectWeights(entries: Entry[], history: Entry[] = entries): SuspectWeight[] {
  return [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((e) => {
      if (e.weightKg === undefined) return []
      const previous = weightOn(history, shiftDate(e.date, -1))
      return isSuspectWeight(e.weightKg, previous?.kg)
        ? [{ date: e.date, kg: e.weightKg, ...(previous && { previous }) }]
        : []
    })
}
