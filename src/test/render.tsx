import { render as rtlRender } from '@testing-library/react'
import type { ReactElement } from 'react'
import { Providers } from '@/Providers'

/** 帶著 App 的 Provider 渲染，元件單獨測試時也能用 Mantine 元件 */
export function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Providers })
}
