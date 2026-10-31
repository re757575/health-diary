import { Button, Group, Paper, Text } from '@mantine/core'
import { useState } from 'react'
import { exportBackup } from './exportBackup'

interface Props {
  /** 上次備份是幾天前；沒備份過為 undefined */
  daysSince?: number
}

/** 太久沒備份時顯示在「今天」分頁，一鍵匯出；匯出後上層會重算，提示自動消失 */
export function BackupNotice({ daysSince }: Props) {
  const [failed, setFailed] = useState(false)

  async function handleExport() {
    try {
      await exportBackup()
    } catch {
      setFailed(true)
    }
  }

  return (
    <Paper component="section" aria-label="備份提醒" withBorder p="sm">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <div>
          <Text size="sm" fw={600}>
            {daysSince === undefined ? '還沒有備份過紀錄' : `已經 ${daysSince} 天沒有備份`}
          </Text>
          <Text size="sm" c={failed ? 'red' : 'dimmed'}>
            {failed
              ? '匯出失敗，請到「設定」再試一次'
              : '資料只存在這台裝置，換手機或被瀏覽器清除就會遺失'}
          </Text>
        </div>
        <Button variant="light" size="compact-sm" onClick={handleExport}>
          匯出備份
        </Button>
      </Group>
    </Paper>
  )
}
