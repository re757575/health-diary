import { useState, type FormEvent } from 'react'
import { saveEntry } from '@/data/repository'
import { MEAL_LABELS, MEAL_TYPES, entrySchema } from '@/domain/entry'
import { formToEntry, type BowelFormValues, type FormValues } from '@/domain/form'

interface Props {
  initial: FormValues
  /** 使用者改選日期時通知上層載入該日的紀錄 */
  onDateChange: (date: string) => void
}

const EMPTY_BOWEL: BowelFormValues = { time: '', bristol: '', note: '' }

export function EntryForm({ initial, onDateChange }: Props) {
  const [form, setForm] = useState(initial)
  const [status, setStatus] = useState('')

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const setBowel = (index: number, patch: Partial<BowelFormValues>) =>
    set(
      'bowel',
      form.bowel.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    )

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = entrySchema.safeParse(formToEntry(form))
    if (!parsed.success) {
      setStatus('有欄位格式不正確，請檢查後再儲存')
      return
    }
    await saveEntry(parsed.data)
    setStatus(`已儲存 ${parsed.data.date} 的紀錄`)
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        日期
        <input
          type="date"
          required
          value={form.date}
          onChange={(e) => e.target.value && onDateChange(e.target.value)}
        />
      </label>

      <div className="row">
        <label>
          體重（kg）
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={form.weightKg}
            onChange={(e) => set('weightKg', e.target.value)}
          />
        </label>
        <label>
          飲水（ml）
          <input
            type="number"
            inputMode="numeric"
            step="50"
            min="0"
            value={form.waterMl}
            onChange={(e) => set('waterMl', e.target.value)}
          />
        </label>
      </div>

      <div className="row">
        <label>
          入睡時間
          <input
            type="time"
            value={form.bedtime}
            onChange={(e) => set('bedtime', e.target.value)}
          />
        </label>
        <label>
          起床時間
          <input
            type="time"
            value={form.wakeTime}
            onChange={(e) => set('wakeTime', e.target.value)}
          />
        </label>
        <label>
          睡眠品質（1–5）
          <input
            type="number"
            min="1"
            max="5"
            value={form.sleepQuality}
            onChange={(e) => set('sleepQuality', e.target.value)}
          />
        </label>
      </div>

      {MEAL_TYPES.map((type) => (
        <label key={type}>
          {MEAL_LABELS[type]}
          <textarea
            rows={2}
            value={form.meals[type]}
            onChange={(e) => set('meals', { ...form.meals, [type]: e.target.value })}
          />
        </label>
      ))}

      <fieldset>
        <legend>排便</legend>
        {form.bowel.map((b, i) => (
          <div className="row" key={i}>
            <label>
              時間
              <input
                type="time"
                value={b.time}
                onChange={(e) => setBowel(i, { time: e.target.value })}
              />
            </label>
            <label>
              布里斯托（1–7）
              <input
                type="number"
                min="1"
                max="7"
                value={b.bristol}
                onChange={(e) => setBowel(i, { bristol: e.target.value })}
              />
            </label>
            <label>
              備註
              <input value={b.note} onChange={(e) => setBowel(i, { note: e.target.value })} />
            </label>
            <button
              type="button"
              aria-label={`移除第 ${i + 1} 次排便`}
              onClick={() =>
                set(
                  'bowel',
                  form.bowel.filter((_, j) => j !== i),
                )
              }
            >
              移除
            </button>
          </div>
        ))}
        <button type="button" onClick={() => set('bowel', [...form.bowel, { ...EMPTY_BOWEL }])}>
          新增排便
        </button>
      </fieldset>

      <label>
        心情／精神（1–5）
        <input
          type="number"
          min="1"
          max="5"
          value={form.mood}
          onChange={(e) => set('mood', e.target.value)}
        />
      </label>
      <label>
        症狀
        <textarea
          rows={2}
          value={form.symptoms}
          onChange={(e) => set('symptoms', e.target.value)}
        />
      </label>
      <label>
        備註
        <textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>

      <button type="submit">儲存</button>
      <p className="status" role="status">
        {status}
      </p>
    </form>
  )
}
