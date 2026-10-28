import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// vitest 未開 globals，RTL 不會自動 cleanup，需手動在每個測試後卸載
afterEach(cleanup)
