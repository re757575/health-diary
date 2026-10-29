import { Button, NativeSelect, Textarea, TextInput, createTheme } from '@mantine/core'

export const theme = createTheme({
  primaryColor: 'teal',
  defaultRadius: 'md',
  fontFamily:
    "system-ui, -apple-system, 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif",
  // 手機單手操作：欄位與按鈕用 md（約 42px 高），比預設 sm 好點
  components: {
    TextInput: TextInput.extend({ defaultProps: { size: 'md' } }),
    NativeSelect: NativeSelect.extend({ defaultProps: { size: 'md' } }),
    Textarea: Textarea.extend({ defaultProps: { size: 'md' } }),
    Button: Button.extend({ defaultProps: { size: 'md' } }),
  },
})
