import { Badge, Button, Divider, Group, Stack, Text } from '@mantine/core'
import { Fragment, useState } from 'react'
import { deleteEntry, saveEntry } from '@/data/repository'
import { sleepHours, type Entry } from '@/domain/entry'
import { Section } from './Section'
import { Status } from './Status'
import { useStatus } from './useStatus'

interface Props {
  /** 全部紀錄，由新到舊 */
  entries: Entry[]
  /** 表單正在編輯的日期，標上「編輯中」 */
  editingDate: string
  onEdit: (date: string) => void
}

/** 「趨勢」分頁的歷史紀錄：每天一列，可以編輯或刪除，刪除後可復原 */
export function HistoryList({ entries, editingDate, onEdit }: Props) {
  const [status, setStatus] = useStatus()
  /** 剛刪除的紀錄，讓使用者能復原；做了別的操作就清掉 */
  const [deleted, setDeleted] = useState<Entry | null>(null)

  async function handleDelete(entry: Entry) {
    await deleteEntry(entry.date)
    setDeleted(entry)
    setStatus(`已刪除 ${entry.date} 的紀錄`)
  }

  async function handleUndo() {
    if (!deleted) return
    await saveEntry(deleted)
    setDeleted(null)
    setStatus(`已復原 ${deleted.date} 的紀錄`)
  }

  function handleEdit(date: string) {
    setDeleted(null)
    setStatus('')
    onEdit(date)
  }

  return (
    <Section title="歷史紀錄">
      {entries.length === 0 && <Text>還沒有紀錄。</Text>}
      <Stack component="ul" gap={0} p={0} m={0} style={{ listStyle: 'none' }}>
        {entries.map((entry, i) => {
          const hours = sleepHours(entry.sleep)
          return (
            <Fragment key={entry.date}>
              {i > 0 && <Divider component="li" />}
              <Group component="li" justify="space-between" wrap="nowrap" py="xs">
                <div>
                  <Group gap="xs">
                    <Text fw={600}>{entry.date}</Text>
                    {entry.date === editingDate && (
                      <Badge variant="light" size="sm">
                        編輯中
                      </Badge>
                    )}
                  </Group>
                  <Text size="sm" c="dimmed">
                    {[
                      entry.weightKg !== undefined && `${entry.weightKg} kg`,
                      hours !== undefined && `睡 ${hours} 小時`,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '只有文字紀錄'}
                  </Text>
                </div>
                <Group gap="xs" wrap="nowrap">
                  <Button
                    variant="light"
                    size="compact-md"
                    aria-label={`編輯 ${entry.date}`}
                    onClick={() => handleEdit(entry.date)}
                  >
                    編輯
                  </Button>
                  <Button
                    variant="light"
                    color="red"
                    size="compact-md"
                    aria-label={`刪除 ${entry.date}`}
                    onClick={() => handleDelete(entry)}
                  >
                    刪除
                  </Button>
                </Group>
              </Group>
            </Fragment>
          )
        })}
      </Stack>
      <Group justify="space-between" wrap="nowrap">
        <Status status={status} />
        {deleted && (
          <Button type="button" variant="light" size="compact-md" onClick={handleUndo}>
            復原
          </Button>
        )}
      </Group>
    </Section>
  )
}
