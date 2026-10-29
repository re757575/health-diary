import { Badge, Button, Container, Divider, Group, Stack, Text, Title } from '@mantine/core'
import { useLiveQuery } from 'dexie-react-hooks'
import { Fragment, useState } from 'react'
import { getEntry, getProfile, listEntries } from '@/data/repository'
import { emptyForm, entryToForm, toDateString } from '@/domain/form'
import { sleepHours } from '@/domain/entry'
import { AboutSection } from './AboutSection'
import { Conditions } from './Conditions'
import { DataTools } from './DataTools'
import { EntryForm } from './EntryForm'
import { ProfileForm } from './ProfileForm'
import { Section } from './Section'
import { TrendCharts } from './TrendCharts'

export default function App() {
  const [date, setDate] = useState(() => toDateString(new Date()))
  // 包一層物件以區分「載入中」（undefined）與「這天沒有紀錄」（{ entry: undefined }）。
  // useLiveQuery 在 date 改變後，新結果回來前會先給上一次的結果，所以結果要帶著日期，
  // 對不上目前的 date 就當作還在載入；否則表單會用上一天的資料初始化，之後也不會更新
  const loaded = useLiveQuery(async () => ({ date, entry: await getEntry(date) }), [date])
  const history = useLiveQuery(listEntries, [])
  // 同樣包一層物件區分「載入中」與「尚未填寫」
  const profile = useLiveQuery(async () => ({ value: await getProfile() }), [])

  // 從歷史紀錄選一天來編輯時，表單在頁面上方，要帶使用者回去
  function editDate(next: string) {
    setDate(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <Container component="main" size="sm" py="md">
      <Stack gap="md">
        <Title order={1} size="h2">
          健康日記
        </Title>

        <Section title="每日紀錄">
          {loaded?.date === date && (
            <EntryForm
              key={date}
              initial={loaded.entry ? entryToForm(loaded.entry) : emptyForm(date)}
              onDateChange={setDate}
            />
          )}
        </Section>

        {history && <TrendCharts entries={history} today={new Date()} />}

        <Section title="歷史紀錄">
          {history?.length === 0 && <Text>還沒有紀錄。</Text>}
          <Stack component="ul" gap={0} p={0} m={0} style={{ listStyle: 'none' }}>
            {history?.map((entry, i) => {
              const hours = sleepHours(entry.sleep)
              return (
                <Fragment key={entry.date}>
                  {i > 0 && <Divider component="li" />}
                  <Group component="li" justify="space-between" wrap="nowrap" py="xs">
                    <div>
                      <Group gap="xs">
                        <Text fw={600}>{entry.date}</Text>
                        {entry.date === date && (
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
                    <Button
                      variant="light"
                      size="compact-md"
                      aria-label={`編輯 ${entry.date}`}
                      onClick={() => editDate(entry.date)}
                    >
                      編輯
                    </Button>
                  </Group>
                </Fragment>
              )
            })}
          </Stack>
        </Section>

        <Conditions />

        <Section title="基本資料">{profile && <ProfileForm initial={profile.value} />}</Section>

        <DataTools />

        <AboutSection />
      </Stack>
    </Container>
  )
}
