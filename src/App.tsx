import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { getEntry, getProfile, listEntries } from '@/data/repository'
import { emptyForm, entryToForm, toDateString } from '@/domain/form'
import { sleepHours } from '@/domain/entry'
import { AboutSection } from './AboutSection'
import { Conditions } from './Conditions'
import { DataTools } from './DataTools'
import { EntryForm } from './EntryForm'
import { ProfileForm } from './ProfileForm'
import { TrendCharts } from './TrendCharts'

export default function App() {
  const [date, setDate] = useState(() => toDateString(new Date()))
  // 包一層物件以區分「載入中」（undefined）與「這天沒有紀錄」（{ entry: undefined }）
  const loaded = useLiveQuery(async () => ({ entry: await getEntry(date) }), [date])
  const history = useLiveQuery(listEntries, [])
  // 同樣包一層物件區分「載入中」與「尚未填寫」
  const profile = useLiveQuery(async () => ({ value: await getProfile() }), [])

  return (
    <main>
      <h1>健康日記</h1>

      <section aria-labelledby="profile-heading">
        <h2 id="profile-heading">基本資料</h2>
        {profile && <ProfileForm initial={profile.value} />}
      </section>

      <section aria-labelledby="entry-heading">
        <h2 id="entry-heading">每日紀錄</h2>
        {loaded && (
          <EntryForm
            key={date}
            initial={loaded.entry ? entryToForm(loaded.entry) : emptyForm(date)}
            onDateChange={setDate}
          />
        )}
      </section>

      {history && <TrendCharts entries={history} today={new Date()} />}

      <Conditions />

      <DataTools />

      <section aria-labelledby="history-heading">
        <h2 id="history-heading">歷史紀錄</h2>
        {history?.length === 0 && <p>還沒有紀錄。</p>}
        <ul className="history">
          {history?.map((entry) => {
            const hours = sleepHours(entry.sleep)
            return (
              <li key={entry.date}>
                <span>
                  {entry.date}
                  {entry.weightKg !== undefined && ` · ${entry.weightKg} kg`}
                  {hours !== undefined && ` · 睡 ${hours} 小時`}
                </span>
                <button type="button" onClick={() => setDate(entry.date)}>
                  編輯 {entry.date}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <AboutSection />
    </main>
  )
}
