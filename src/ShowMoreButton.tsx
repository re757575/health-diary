import { Button } from '@mantine/core'

interface Props {
  expanded: boolean
  onToggle: () => void
  /** 收合時的文字，例如「顯示全部（還有 12 天）」；展開時一律是「收合」 */
  moreLabel: string
}

/** 資料越記越多的清單，預設只列前幾項，用這顆按鈕展開或收合其餘的 */
export function ShowMoreButton({ expanded, onToggle, moreLabel }: Props) {
  return (
    <Button
      type="button"
      variant="subtle"
      size="compact-sm"
      mt={4}
      aria-expanded={expanded}
      onClick={onToggle}
    >
      {expanded ? '收合' : moreLabel}
    </Button>
  )
}
