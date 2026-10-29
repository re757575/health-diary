import { Text } from '@mantine/core'
import type { StatusMessage } from './useStatus'

export function Status({ status }: { status: StatusMessage }) {
  return (
    <Text role="status" size="sm" c={status.error ? 'red' : 'teal'} mih="1.5em">
      {status.text}
    </Text>
  )
}
