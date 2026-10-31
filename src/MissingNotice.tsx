import { Button, Group, Paper, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import type { IncompleteDay } from '@/domain/quality'

interface Props {
  days: IncompleteDay[]
  /** 表單目前顯示的日期；那一天不再提供「補填」 */
  currentDate: string
  onFill: (date: string) => void
}

/** 預設只列最近幾天，漏填很多天時才不會把主要的表單擠到畫面下面 */
const COLLAPSED_COUNT = 3

const shortDate = (date: string) => date.slice(5).replace('-', '/')

/** 最近幾天沒填完的紀錄，點「補填」直接跳到那一天；全都填完就不顯示 */
export function MissingNotice({ days, currentDate, onFill }: Props) {
  const [expanded, setExpanded] = useState(false)
  if (days.length === 0) return null

  const hiddenCount = days.length - COLLAPSED_COUNT
  const visible = expanded ? days : days.slice(0, COLLAPSED_COUNT)

  return (
    <Paper component="section" aria-label="未填完的紀錄" withBorder p="sm">
      <Text size="sm" fw={600} mb={4}>
        最近有 {days.length} 天的紀錄沒填完
      </Text>
      <Stack component="ul" gap={4} p={0} m={0} style={{ listStyle: 'none' }}>
        {visible.map(({ date, empty, missing }) => (
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
      {hiddenCount > 0 && (
        <Button
          variant="subtle"
          size="compact-sm"
          mt={4}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '收合' : `還有 ${hiddenCount} 天`}
        </Button>
      )}
    </Paper>
  )
}
