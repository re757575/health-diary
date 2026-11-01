import { Button, Group, Paper, Stack, Text } from '@mantine/core'
import { withWeekday } from '@/domain/form'
import { describeDaysLeft, describeVisit, type FollowUp } from '@/domain/visit'

interface Props {
  /** 快到的回診，近的在前 */
  followUps: FollowUp[]
  onOpen: () => void
}

/** 回診快到時顯示在「今天」分頁，點了切到「就醫」看完整的紀錄 */
export function FollowUpNotice({ followUps, onOpen }: Props) {
  return (
    <Paper component="section" aria-label="回診提醒" withBorder p="sm">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Stack gap={2}>
          {followUps.map(({ visit, daysLeft }) => (
            <Text key={visit.id} size="sm">
              <Text span size="sm" fw={600}>
                {describeDaysLeft(daysLeft)}要回診
              </Text>
              ：{describeVisit(visit)}（{withWeekday(visit.followUpDate!)}）
            </Text>
          ))}
        </Stack>
        <Button variant="light" size="compact-sm" style={{ flexShrink: 0 }} onClick={onOpen}>
          看就醫紀錄
        </Button>
      </Group>
    </Paper>
  )
}
