import { Button, TextInput } from '@mantine/core'
import { toTimeString } from '@/domain/form'

interface Props {
  label: string
  /** 「現在」按鈕的無障礙名稱；不要包含欄位名稱，否則用標籤找欄位時會同時比對到按鈕 */
  nowLabel: string
  value: string
  onChange: (value: string) => void
}

/** 原生時間欄位，右側有「現在」按鈕一鍵填入目前時間 */
export function TimeField({ label, nowLabel, value, onChange }: Props) {
  return (
    <TextInput
      label={label}
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rightSection={
        <Button
          type="button"
          variant="subtle"
          size="compact-xs"
          aria-label={nowLabel}
          onClick={() => onChange(toTimeString(new Date()))}
        >
          現在
        </Button>
      }
      rightSectionWidth="3.25rem"
      rightSectionPointerEvents="all"
    />
  )
}
