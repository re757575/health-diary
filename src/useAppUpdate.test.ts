import { renderHook } from '@testing-library/react'
import type { RegisterSWOptions } from 'virtual:pwa-register/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAppUpdate } from './useAppUpdate'

const sw = vi.hoisted(() => ({
  options: undefined as RegisterSWOptions | undefined,
  updateServiceWorker: vi.fn(async () => {}),
}))
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options: RegisterSWOptions) => {
    sw.options = options
    return {
      needRefresh: [true, () => {}],
      offlineReady: [false, () => {}],
      updateServiceWorker: sw.updateServiceWorker,
    }
  },
}))

afterEach(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
})

describe('useAppUpdate', () => {
  it('回到前景時檢查新版本；離線檢查失敗也不拋出', async () => {
    const update = vi.fn(async () => {
      throw new Error('offline')
    })
    renderHook(() => useAppUpdate())
    sw.options!.onRegisteredSW!('sw.js', { update } as unknown as ServiceWorkerRegistration)

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(update).not.toHaveBeenCalled()

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('回報新版本是否就緒，套用時讓等待中的新版接手', () => {
    const { result } = renderHook(() => useAppUpdate())
    expect(result.current.updateReady).toBe(true)
    result.current.applyUpdate()
    expect(sw.updateServiceWorker).toHaveBeenCalled()
  })
})
