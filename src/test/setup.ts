import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// vitest 未開 globals，RTL 不會自動 cleanup，需手動在每個測試後卸載
afterEach(cleanup)

// jsdom 沒有實作 Mantine 會用到的瀏覽器 API
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  }) as MediaQueryList

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// jsdom 有 window.scrollTo，但呼叫時只會印出「Not implemented」，所以不能用 ??= 判斷，要直接蓋掉；
// 需要檢查呼叫的測試自己改成 vi.fn()
window.scrollTo = () => {}
