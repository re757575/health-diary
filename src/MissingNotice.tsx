import { Button, Group, Paper, Stack, Text } from '@mantine/core'
import type { IncompleteDay } from '@/domain/quality'

interface Props {
  days: IncompleteDay[]
  /** 表單目前顯示的日期；那一天不再提供「補填」 */
  currentDate: string
  onFill: (date: string) => void
}

const shortDate = (date: string) => date.slice(5).replace('-', '/')

/** 最近幾天沒填完的紀錄，點「補填」直接跳到那一天；全都填完就不顯示 */
export function MissingNotice({ days, currentDate, onFill }: Props) {
  if (days.length === 0) return null

  return (
    <Paper component="section" aria-label="未填完的紀錄" withBorder p="sm">
      <Text size="sm" fw={600} mb={4}>
        最近有 {days.length} 天的紀錄沒填完
      </Text>
      <Stack component="ul" gap={4} p={0} m={0} style={{ listStyle: 'none' }}>
        {days.map(({ date, empty, missing }) => (
          <Group component="li" key={date} justify="space-between" wrap="nowrap">
            <Text size="sm">
              <Text span fw={500}>
                {shortDate(date)}
              </Text>
              {'　'}
              <Text span c="dimmed">
                {empty ? '整天沒有紀錄' : `沒填：${missing.join('、')}`}
              </Text>
            </Text>
            {date === currentDate ? (
              <Text size="xs" c="dimmed">
                編輯中
              </Text>
            ) : (
              <Button
                variant="light"
                size="compact-sm"
                aria-label={`補填 ${date}`}
                onClick={() => onFill(date)}
              >
                補填
              </Button>
            )}
          </Group>
        ))}
      </Stack>
    </Paper>
  )
}
