import { Button, Group, Paper, Text } from '@mantine/core'

interface Props {
  /** 每日紀錄有未儲存的修改：不會自動更新，但手動更新時修改已存成草稿，重新開啟後會還原 */
  dirty: boolean
  onUpdate: () => void
}

/** 新版本已下載好時顯示；也可以不理它，切到背景時會自動更新 */
export function UpdateNotice({ dirty, onUpdate }: Props) {
  return (
    <Paper component="section" aria-label="新版本" withBorder p="sm">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <div>
          <Text size="sm" fw={600}>
            新版本已就緒
          </Text>
          <Text size="sm" c="dimmed">
            {dirty
              ? '有尚未儲存的修改，現在更新的話，重新開啟後會自動還原'
              : '切到背景時會自動更新，也可以現在更新'}
          </Text>
        </div>
        <Button variant="light" size="compact-sm" style={{ flexShrink: 0 }} onClick={onUpdate}>
          更新
        </Button>
      </Group>
    </Paper>
  )
}
