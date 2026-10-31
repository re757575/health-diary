import Dexie, { type EntityTable } from 'dexie'
import type { Condition } from '@/domain/condition'
import type { Entry } from '@/domain/entry'
import type { Profile } from '@/domain/profile'

/** 基本資料整個 App 只有一份，固定用這個 id 存 */
export const PROFILE_ID = 'me'

export type StoredProfile = Profile & { id: typeof PROFILE_ID }

class HealthDiaryDb extends Dexie {
  entries!: EntityTable<Entry, 'date'>
  conditions!: EntityTable<Condition, 'id'>
  profile!: EntityTable<StoredProfile, 'id'>

  constructor() {
    super('health-diary')
    // 之後改 schema 時在這裡加 version(n).stores(...) 與 upgrade，不要改動舊版本
    this.version(1).stores({ entries: 'date' })
    // v2：新增已知疾病與基本資料。只新增資料表，既有的紀錄不受影響
    this.version(2).stores({ entries: 'date', conditions: 'id', profile: 'id' })
    // v3：紀錄新增選填的 symptomItems。沒有新資料表或索引，舊資料不需要轉換；
    // 資料表定義與 v2 相同，升版是為了標記這次的結構變更
    this.version(3).stores({ entries: 'date', conditions: 'id', profile: 'id' })
  }
}

export const db = new HealthDiaryDb()
