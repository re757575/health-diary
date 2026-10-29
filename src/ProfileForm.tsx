import { Button, NativeSelect, Text, TextInput } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { saveProfile } from '@/data/repository'
import {
  SEXES,
  SEX_LABELS,
  formToProfile,
  profileSchema,
  profileToForm,
  type Profile,
  type ProfileFormValues,
} from '@/domain/profile'

interface Props {
  initial: Profile | undefined
}

export function ProfileForm({ initial }: Props) {
  const [form, setForm] = useState(() => profileToForm(initial))
  const [status, setStatus] = useState('')

  // 儲存的資料被外部改動（例如匯入備份覆蓋）時，表單跟著更新；
  // 自己儲存時資料與表單一致，表單內容與提示訊息都不受影響
  const initialJson = JSON.stringify(initial ?? null)
  const [syncedJson, setSyncedJson] = useState(initialJson)
  if (initialJson !== syncedJson) {
    setSyncedJson(initialJson)
    setForm(profileToForm(initial))
  }

  const set = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = profileSchema.safeParse(formToProfile(form))
    if (!parsed.success) {
      setStatus('身高需為 0–300 之間的數字')
      return
    }
    await saveProfile(parsed.data)
    setStatus('已儲存基本資料')
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="fields">
        <TextInput
          label="生日"
          type="date"
          value={form.birthday}
          onChange={(e) => set('birthday', e.target.value)}
        />
        <TextInput
          label="身高（cm）"
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          max="300"
          value={form.heightCm}
          onChange={(e) => set('heightCm', e.target.value)}
        />
        <NativeSelect
          label="性別"
          data={[
            { value: '', label: '不填' },
            ...SEXES.map((s) => ({ value: s, label: SEX_LABELS[s] })),
          ]}
          value={form.sex}
          onChange={(e) => set('sex', e.target.value as ProfileFormValues['sex'])}
        />
      </div>
      <Button type="submit" mt="md">
        儲存基本資料
      </Button>
      <Text role="status" size="sm" c="dimmed" mt="xs">
        {status}
      </Text>
    </form>
  )
}
