import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { deleteCondition, listConditions, saveCondition } from '@/data/repository'
import {
  CONDITION_STATUSES,
  CONDITION_STATUS_LABELS,
  conditionSchema,
  conditionToForm,
  emptyConditionForm,
  formToCondition,
  type Condition,
  type ConditionFormValues,
} from '@/domain/condition'

export function Conditions() {
  const conditions = useLiveQuery(listConditions, [])
  const [form, setForm] = useState<ConditionFormValues>(emptyConditionForm)
  /** 正在編輯的疾病 id；null 代表新增 */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [status, setStatus] = useState('')

  const set = <K extends keyof ConditionFormValues>(key: K, value: ConditionFormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  function resetForm() {
    setForm(emptyConditionForm())
    setEditingId(null)
  }

  function startEdit(condition: Condition) {
    setForm(conditionToForm(condition))
    setEditingId(condition.id)
    setStatus('')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = conditionSchema.safeParse(
      formToCondition(form, editingId ?? crypto.randomUUID()),
    )
    if (!parsed.success) {
      setStatus('請填寫疾病名稱，開始時間格式需為年月')
      return
    }
    await saveCondition(parsed.data)
    setStatus(`已${editingId ? '更新' : '新增'}「${parsed.data.name}」`)
    resetForm()
  }

  async function handleDelete(condition: Condition) {
    await deleteCondition(condition.id)
    // 正在編輯的那筆被刪掉時，不能再讓表單以舊 id 存回去
    if (editingId === condition.id) resetForm()
    setStatus(`已刪除「${condition.name}」`)
  }

  return (
    <section aria-labelledby="conditions-heading">
      <h2 id="conditions-heading">已知疾病</h2>
      {conditions?.length === 0 && <p>尚未填寫。沒有已知疾病可略過。</p>}
      <ul className="history">
        {conditions?.map((c) => (
          <li key={c.id}>
            <span>
              {c.name}
              {` · ${CONDITION_STATUS_LABELS[c.status]}`}
              {c.since && ` · ${c.since} 起`}
              {c.notes && ` · ${c.notes}`}
            </span>
            <span className="row">
              <button type="button" onClick={() => startEdit(c)}>
                編輯 {c.name}
              </button>
              <button type="button" onClick={() => handleDelete(c)}>
                刪除 {c.name}
              </button>
            </span>
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit}>
        <div className="row">
          <label>
            疾病名稱
            <input
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="例如：高血壓、胃食道逆流"
            />
          </label>
          <label>
            開始時間
            <input type="month" value={form.since} onChange={(e) => set('since', e.target.value)} />
          </label>
          <label>
            狀態
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value as ConditionFormValues['status'])}
            >
              {CONDITION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CONDITION_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          疾病備註（用藥、醫囑、控制狀況等）
          <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>
        <div className="row">
          <button type="submit">{editingId ? '更新疾病' : '新增疾病'}</button>
          {editingId && (
            <button type="button" onClick={resetForm}>
              取消編輯
            </button>
          )}
        </div>
        <p className="status" role="status">
          {status}
        </p>
      </form>
    </section>
  )
}
