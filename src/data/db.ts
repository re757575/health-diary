import Dexie, { type EntityTable } from 'dexie'
import type { Condition } from '@/domain/condition'
import type { Entry } from '@/domain/entry'
import { convertLegacyMeal } from '@/domain/legacy-meal'
import type { Medication } from '@/domain/medication'
import type { Profile } from '@/domain/profile'
import type { Visit } from '@/domain/visit'

/** 基本資料整個 App 只有一份，固定用這個 id 存 */
export const PROFILE_ID = 'me'

export type StoredProfile = Profile & { id: typeof PROFILE_ID }

/** 常吃的食物清單裡的一項；addedAt 用來維持匯入時的順序 */
export interface StoredFood {
  name: string
  addedAt: string
}

/** App 自己的狀態（例如上次備份的時間），不是健康資料，不放進備份檔 */
export interface Meta {
  key: string
  value: string
}

class HealthDiaryDb extends Dexie {
  entries!: EntityTable<Entry, 'date'>
  conditions!: EntityTable<Condition, 'id'>
  profile!: EntityTable<StoredProfile, 'id'>
  meta!: EntityTable<Meta, 'key'>
  medications!: EntityTable<Medication, 'id'>
  foods!: EntityTable<StoredFood, 'name'>
  visits!: EntityTable<Visit, 'id'>

  constructor() {
    super('health-diary')
    // 之後改 schema 時在這裡加 version(n).stores(...) 與 upgrade，不要改動舊版本
    this.version(1).stores({ entries: 'date' })
    // v2：新增已知疾病與基本資料。只新增資料表，既有的紀錄不受影響
    this.version(2).stores({ entries: 'date', conditions: 'id', profile: 'id' })
    // v3：紀錄新增選填的 symptomItems、exerciseMinutes、tags。沒有新資料表或索引，舊資料不需要轉換；
    // 資料表定義與 v2 相同，升版是為了標記這次的結構變更
    this.version(3).stores({ entries: 'date', conditions: 'id', profile: 'id' })
    // v4：新增 meta 資料表，記錄上次匯出備份的時間。只新增資料表，既有資料不受影響
    this.version(4).stores({ entries: 'date', conditions: 'id', profile: 'id', meta: 'key' })
    // v5：紀錄新增選填的 noBowel（確認當天沒有排便）。沒有新資料表或索引，舊資料不需要轉換
    this.version(5).stores({ entries: 'date', conditions: 'id', profile: 'id', meta: 'key' })
    // v6：新增固定用藥（medications）資料表；紀錄新增選填的 missedMedications、asNeededMedications。
    // 只新增資料表與選填欄位，舊資料不需要轉換
    this.version(6).stores({
      entries: 'date',
      conditions: 'id',
      profile: 'id',
      meta: 'key',
      medications: 'id',
    })
    // v7：新增常吃的食物清單（foods）；餐點從整段文字改成一項項的食物與份量（items），
    // 舊紀錄的文字在升版時拆成食物，地點等說明移到備註（description）
    this.version(7)
      .stores({
        entries: 'date',
        conditions: 'id',
        profile: 'id',
        meta: 'key',
        medications: 'id',
        foods: 'name',
      })
      .upgrade((tx) =>
        tx
          .table<Entry>('entries')
          .toCollection()
          .modify((entry) => {
            entry.meals = entry.meals.map(convertLegacyMeal)
          }),
      )
    // v8：新增就醫紀錄（visits）資料表。只新增資料表，既有資料不受影響
    this.version(8).stores({
      entries: 'date',
      conditions: 'id',
      profile: 'id',
      meta: 'key',
      medications: 'id',
      foods: 'name',
      visits: 'id',
    })
  }
}

export const db = new HealthDiaryDb()
