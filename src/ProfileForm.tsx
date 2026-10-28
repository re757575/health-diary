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
      <div className="row">
        <label>
          生日
          <input
            type="date"
            value={form.birthday}
            onChange={(e) => set('birthday', e.target.value)}
          />
        </label>
        <label>
          身高（cm）
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            max="300"
            value={form.heightCm}
            onChange={(e) => set('heightCm', e.target.value)}
          />
        </label>
        <label>
          性別
          <select
            value={form.sex}
            onChange={(e) => set('sex', e.target.value as ProfileFormValues['sex'])}
          >
            <option value="">不填</option>
            {SEXES.map((s) => (
              <option key={s} value={s}>
                {SEX_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button type="submit">儲存基本資料</button>
      <p className="status" role="status">
        {status}
      </p>
    </form>
  )
}
