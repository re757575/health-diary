import { z } from 'zod'

export const SEXES = ['female', 'male', 'other'] as const
export type Sex = (typeof SEXES)[number]

export const SEX_LABELS: Record<Sex, string> = {
  female: '女',
  male: '男',
  other: '其他',
}

/** 基本資料：整個 App 只有一份，全部選填 */
export const profileSchema = z.object({
  /** 生日 YYYY-MM-DD */
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  heightCm: z.number().positive().max(300).optional(),
  sex: z.enum(SEXES).optional(),
})

export type Profile = z.infer<typeof profileSchema>

/** 表單欄位一律是字串，空字串代表沒填 */
export interface ProfileFormValues {
  birthday: string
  heightCm: string
  sex: Sex | ''
}

export const emptyProfileForm = (): ProfileFormValues => ({ birthday: '', heightCm: '', sex: '' })

export function formToProfile(form: ProfileFormValues): Profile {
  return {
    birthday: form.birthday || undefined,
    heightCm: form.heightCm.trim() === '' ? undefined : Number(form.heightCm),
    sex: form.sex || undefined,
  }
}

export function profileToForm(profile: Profile | undefined): ProfileFormValues {
  return {
    birthday: profile?.birthday ?? '',
    heightCm: profile?.heightCm === undefined ? '' : String(profile.heightCm),
    sex: profile?.sex ?? '',
  }
}

/** 到 `today` 為止的足歲；生日在未來或日期不存在（例如 2025-02-30）回傳 undefined */
export function ageOn(birthday: string, today: Date): number | undefined {
  const [y, m, d] = birthday.split('-').map(Number)
  const born = new Date(y, m - 1, d)
  if (born.getFullYear() !== y || born.getMonth() !== m - 1 || born.getDate() !== d) {
    return undefined
  }
  let age = today.getFullYear() - y
  const beforeBirthday =
    today.getMonth() < m - 1 || (today.getMonth() === m - 1 && today.getDate() < d)
  if (beforeBirthday) age -= 1
  return age >= 0 ? age : undefined
}
