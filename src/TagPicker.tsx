import { addTag, toggleTag } from '@/domain/tag'
import { ChipChoices } from './ChipChoices'

interface Props {
  /** 可以點選的標籤（預設標籤與過去用過的） */
  known: readonly string[]
  tags: string[]
  onChange: (tags: string[]) => void
}

/** 點選今天的狀況（空氣品質差、久坐…），清單沒有的可自行輸入 */
export function TagPicker({ known, tags, onChange }: Props) {
  return (
    <ChipChoices
      label="今天的狀況"
      known={known}
      selected={tags}
      onToggle={(name) => onChange(toggleTag(tags, name))}
      onAdd={(name) => onChange(addTag(tags, name))}
      addLabel="新增其他狀況"
      addPlaceholder="其他狀況，例如：出差"
      addButtonLabel="新增狀況"
    />
  )
}
