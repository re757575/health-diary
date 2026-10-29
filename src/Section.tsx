import { Paper, Title } from '@mantine/core'
import { useId, type ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
}

/** 頁面上的一個區塊：有標題的卡片，標題同時是區塊（region）的名稱 */
export function Section({ title, children }: Props) {
  const id = useId()
  return (
    <Paper component="section" withBorder p="md" aria-labelledby={id}>
      <Title order={2} size="h4" mb="sm" id={id}>
        {title}
      </Title>
      {children}
    </Paper>
  )
}
