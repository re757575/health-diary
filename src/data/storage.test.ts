import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestPersistentStorage } from './storage'

function stubStorage(storage: Partial<StorageManager> | undefined) {
  vi.stubGlobal('navigator', { ...navigator, storage })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requestPersistentStorage', () => {
  it('已經是持久保存就不再要求', async () => {
    const persist = vi.fn()
    stubStorage({ persisted: async () => true, persist })
    expect(await requestPersistentStorage()).toBe(true)
    expect(persist).not.toHaveBeenCalled()
  })

  it('還不是持久保存時向瀏覽器要求，回傳瀏覽器的決定', async () => {
    stubStorage({ persisted: async () => false, persist: async () => true })
    expect(await requestPersistentStorage()).toBe(true)

    stubStorage({ persisted: async () => false, persist: async () => false })
    expect(await requestPersistentStorage()).toBe(false)
  })

  it('瀏覽器不支援時回傳 false', async () => {
    stubStorage(undefined)
    expect(await requestPersistentStorage()).toBe(false)
  })

  it('發生錯誤時回傳 false，不拋出', async () => {
    stubStorage({
      persisted: async () => {
        throw new Error('SecurityError')
      },
      persist: async () => true,
    })
    expect(await requestPersistentStorage()).toBe(false)
  })
})
