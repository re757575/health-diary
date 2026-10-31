import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/data/db'
import { getLastBackupAt } from '@/data/repository'
import { exportBackup } from './exportBackup'

const now = new Date('2026-10-31T12:00:00Z')
let click: ReturnType<typeof vi.spyOn>

/** 模擬手機（觸控）或電腦，以及瀏覽器是否支援分享檔案 */
function stubDevice({
  touch,
  share,
}: {
  touch: boolean
  share?: (data: ShareData) => Promise<void>
}) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: touch && query === '(pointer: coarse)',
  }))
  vi.stubGlobal('navigator', {
    ...navigator,
    share,
    canShare: share ? () => true : undefined,
  })
}

beforeEach(async () => {
  await Promise.all([db.entries.clear(), db.meta.clear()])
  await db.entries.put({ date: '2026-10-30', weightKg: 70, meals: [], bowel: [] })
  URL.createObjectURL = vi.fn(() => 'blob:backup')
  URL.revokeObjectURL = vi.fn()
  click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  click.mockRestore()
})

describe('exportBackup', () => {
  it('電腦上下載備份檔，並記下備份時間', async () => {
    const share = vi.fn(async () => {})
    stubDevice({ touch: false, share })

    expect(await exportBackup(now)).toBe('downloaded')
    expect(share).not.toHaveBeenCalled()
    expect(click).toHaveBeenCalled()
    expect(await getLastBackupAt()).toBe(now.toISOString())
  })

  it('手機上用分享選單送出備份檔，檔名帶日期、內容是完整備份', async () => {
    const share = vi.fn(async (_data: ShareData) => {})
    stubDevice({ touch: true, share })

    expect(await exportBackup(now)).toBe('shared')
    const file = share.mock.calls[0]![0].files![0]!
    expect(file.name).toBe('health-diary-2026-10-31.json')
    expect(JSON.parse(await file.text()).entries).toHaveLength(1)
    expect(click).not.toHaveBeenCalled()
    expect(await getLastBackupAt()).toBe(now.toISOString())
  })

  it('關掉分享選單不算備份，也不改成下載', async () => {
    stubDevice({
      touch: true,
      share: async () => {
        throw new DOMException('cancelled', 'AbortError')
      },
    })

    expect(await exportBackup(now)).toBe('cancelled')
    expect(click).not.toHaveBeenCalled()
    expect(await getLastBackupAt()).toBeUndefined()
  })

  it('瀏覽器拒絕分享時改用下載，備份照樣完成', async () => {
    stubDevice({
      touch: true,
      share: async () => {
        throw new DOMException('not allowed', 'NotAllowedError')
      },
    })

    expect(await exportBackup(now)).toBe('downloaded')
    expect(click).toHaveBeenCalled()
    expect(await getLastBackupAt()).toBe(now.toISOString())
  })

  it('手機但不支援分享檔案時下載', async () => {
    stubDevice({ touch: true })

    expect(await exportBackup(now)).toBe('downloaded')
    expect(click).toHaveBeenCalled()
  })
})
