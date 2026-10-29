import { Button, Container, Divider, Group, Stack, Text, Title } from '@mantine/core'
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
  // 包一層物件以區分「載入中」（undefined）與「這天沒有紀錄」（{ entry: undefined }）
  const loaded = useLiveQuery(async () => ({ entry: await getEntry(date) }), [date])
  const history = useLiveQuery(listEntries, [])
  // 同樣包一層物件區分「載入中」與「尚未填寫」
  const profile = useLiveQuery(async () => ({ value: await getProfile() }), [])

  return (
    <Container component="main" size="sm" py="md">
      <Stack gap="md">
        <Title order={1} size="h2">
          健康日記
        </Title>

        <Section title="基本資料">{profile && <ProfileForm initial={profile.value} />}</Section>

        <Section title="每日紀錄">
          {loaded && (
            <EntryForm
              key={date}
              initial={loaded.entry ? entryToForm(loaded.entry) : emptyForm(date)}
              onDateChange={setDate}
            />
          )}
        </Section>

        {history && <TrendCharts entries={history} today={new Date()} />}

        <Conditions />

        <DataTools />

        <Section title="歷史紀錄">
          {history?.length === 0 && <Text>還沒有紀錄。</Text>}
          <Stack component="ul" gap={0} p={0} m={0} style={{ listStyle: 'none' }}>
            {history?.map((entry, i) => {
              const hours = sleepHours(entry.sleep)
              return (
                <Fragment key={entry.date}>
                  {i > 0 && <Divider component="li" />}
                  <Group component="li" justify="space-between" wrap="nowrap" py="xs">
                    <Text>
                      {entry.date}
                      {entry.weightKg !== undefined && ` · ${entry.weightKg} kg`}
                      {hours !== undefined && ` · 睡 ${hours} 小時`}
                    </Text>
                    <Button variant="light" size="compact-sm" onClick={() => setDate(entry.date)}>
                      編輯 {entry.date}
                    </Button>
                  </Group>
                </Fragment>
              )
            })}
          </Stack>
        </Section>

        <AboutSection />
      </Stack>
    </Container>
  )
}
