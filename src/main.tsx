// 只引入用到的元件樣式，不用整包 styles.css（CSS 少約 190 kB）。
// - 新用到 Mantine 元件時，要把它的樣式補在這裡；漏掉不會報錯，只是長得不對
// - 順序要和 node_modules/@mantine/core/styles.css 一致：後面的規則會蓋掉前面的
//   （例如 Button 的背景要蓋掉 UnstyledButton 的透明背景，所以 UnstyledButton 在前）
// - NativeSelect 的下拉箭頭樣式在 Combobox.css
import '@mantine/core/styles/baseline.css'
import '@mantine/core/styles/default-css-variables.css'
import '@mantine/core/styles/global.css'
import '@mantine/core/styles/UnstyledButton.css'
import '@mantine/core/styles/VisuallyHidden.css'
import '@mantine/core/styles/Paper.css'
import '@mantine/core/styles/ActionIcon.css'
import '@mantine/core/styles/Group.css'
import '@mantine/core/styles/Input.css'
import '@mantine/core/styles/Text.css'
import '@mantine/core/styles/Combobox.css'
import '@mantine/core/styles/Badge.css'
import '@mantine/core/styles/Button.css'
import '@mantine/core/styles/Container.css'
import '@mantine/core/styles/Divider.css'
import '@mantine/core/styles/Tooltip.css'
import '@mantine/core/styles/Stack.css'
import '@mantine/core/styles/Title.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Providers } from './Providers'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
)
