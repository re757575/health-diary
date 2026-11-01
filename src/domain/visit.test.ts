import { describe, expect, it } from 'vitest'
import {
  collectVisitNames,
  describeDaysLeft,
  describeVisit,
  emptyVisitForm,
  entrySymptomsText,
  formToVisit,
  sortVisits,
  upcomingFollowUps,
  visitDetails,
  visitSchema,
  visitToForm,
  visitsDuring,
  type Visit,
} from './visit'

const visit = (id: string, date: string, extra: Partial<Visit> = {}): Visit => ({
  id,
  date,
  facility: '安心診所',
  ...extra,
})

describe('visitSchema', () => {
  it('只要日期與診所／醫院', () => {
    expect(visitSchema.safeParse(visit('a', '2026-10-28')).success).toBe(true)
    expect(visitSchema.safeParse(visit('a', '2026-10-28', { facility: '  ' })).success).toBe(false)
    expect(visitSchema.safeParse(visit('a', '')).success).toBe(false)
  })

  it('回診日期不能早於就醫日期，同一天可以', () => {
    expect(
      visitSchema.safeParse(visit('a', '2026-10-28', { followUpDate: '2026-10-27' })).success,
    ).toBe(false)
    expect(
      visitSchema.safeParse(visit('a', '2026-10-28', { followUpDate: '2026-10-28' })).success,
    ).toBe(true)
  })
})

describe('表單轉換', () => {
  it('空欄位省略、前後空白去掉；轉回表單內容不變', () => {
    const form = {
      ...emptyVisitForm('2026-10-28'),
      facility: ' 台大醫院 ',
      department: '耳鼻喉科',
      advice: '多喝水\n少熬夜',
      followUpDate: '2026-11-04',
    }
    const v = formToVisit(form, 'id1')
    expect(v).toEqual({
      id: 'id1',
      date: '2026-10-28',
      facility: '台大醫院',
      department: '耳鼻喉科',
      doctor: undefined,
      symptoms: undefined,
      examinations: undefined,
      diagnosis: undefined,
      advice: '多喝水\n少熬夜',
      prescription: undefined,
      followUpDate: '2026-11-04',
      notes: undefined,
    })
    expect(visitToForm(v)).toEqual({ ...form, facility: '台大醫院' })
  })
})

describe('排序與期間', () => {
  const visits = [
    visit('a', '2026-10-01'),
    visit('b', '2026-10-20', { facility: '台大醫院' }),
    visit('c', '2026-10-20', { facility: '安心診所' }),
    visit('d', '2026-11-05'),
  ]

  // 依筆畫排序：「台」5 畫在「安」6 畫前面
  it('由新到舊，同一天依診所名稱', () => {
    expect(sortVisits(visits).map((v) => v.id)).toEqual(['d', 'b', 'c', 'a'])
  })

  it('期間內含頭尾，由舊到新，同一天依診所名稱', () => {
    expect(visitsDuring(visits, '2026-10-01', '2026-10-31').map((v) => v.id)).toEqual([
      'a',
      'b',
      'c',
    ])
    expect(visitsDuring(visits, '2026-10-02', '2026-11-05').map((v) => v.id)).toEqual([
      'b',
      'c',
      'd',
    ])
  })
})

describe('describeVisit 與 visitDetails', () => {
  it('科別與醫師寫在括號裡，沒填就只有診所', () => {
    expect(
      describeVisit(visit('a', '2026-10-28', { department: '家醫科', doctor: '王醫師' })),
    ).toBe('安心診所（家醫科，王醫師）')
    expect(describeVisit(visit('a', '2026-10-28', { doctor: '王醫師' }))).toBe('安心診所（王醫師）')
    expect(describeVisit(visit('a', '2026-10-28'))).toBe('安心診所')
  })

  it('依固定順序列出有填的項目', () => {
    const v = visit('a', '2026-10-28', {
      notes: '自費 200 元',
      diagnosis: '急性咽喉炎',
      symptoms: '喉嚨痛',
      advice: ' ',
      followUpDate: '2026-11-04',
    })
    expect(visitDetails(v)).toEqual([
      { label: '症狀', value: '喉嚨痛' },
      { label: '診斷', value: '急性咽喉炎' },
      { label: '下次回診', value: '2026-11-04' },
      { label: '備註', value: '自費 200 元' },
    ])
  })
})

describe('upcomingFollowUps', () => {
  const today = '2026-11-01'

  it('列出今天以後的回診，近的在前；已過的不列', () => {
    const visits = [
      visit('a', '2026-10-20', { facility: 'A', followUpDate: '2026-11-10' }),
      visit('b', '2026-10-25', { facility: 'B', followUpDate: '2026-11-01' }),
      visit('c', '2026-10-01', { facility: 'C', followUpDate: '2026-10-31' }),
    ]
    expect(upcomingFollowUps(visits, today).map((f) => [f.visit.id, f.daysLeft])).toEqual([
      ['b', 0],
      ['a', 9],
    ])
  })

  it('同一家之後又看過診的，不再提醒之前那次的回診', () => {
    const visits = [
      visit('a', '2026-10-20', { followUpDate: '2026-11-10' }),
      visit('b', '2026-10-28'),
      visit('c', '2026-10-21', { facility: '別家', followUpDate: '2026-11-03' }),
    ]
    expect(upcomingFollowUps(visits, today).map((f) => f.visit.id)).toEqual(['c'])
  })

  it('天數的說法', () => {
    expect([0, 1, 3].map(describeDaysLeft)).toEqual(['今天', '明天', '3 天後'])
  })
})

describe('collectVisitNames', () => {
  it('過去填過的，不重複、依名稱排序，沒填的略過', () => {
    const visits = [
      visit('a', '2026-10-01', { facility: '台大醫院', doctor: '王醫師' }),
      visit('b', '2026-10-02', { facility: '安心診所' }),
      visit('c', '2026-10-03', { facility: '台大醫院', doctor: ' ' }),
    ]
    expect(collectVisitNames(visits, 'facility')).toEqual(['台大醫院', '安心診所'])
    expect(collectVisitNames(visits, 'doctor')).toEqual(['王醫師'])
    expect(collectVisitNames(visits, 'department')).toEqual([])
  })
})

describe('entrySymptomsText', () => {
  it('點選的症狀與程度在前，文字補充在後', () => {
    expect(
      entrySymptomsText({
        date: '2026-10-28',
        meals: [],
        bowel: [],
        symptomItems: [
          { name: '頭痛', severity: 2 },
          { name: '咳嗽', severity: 1 },
        ],
        symptoms: '喉嚨有點癢',
      }),
    ).toBe('頭痛（中）、咳嗽（輕）；喉嚨有點癢')
  })

  it('沒有紀錄或沒有症狀時是空字串', () => {
    expect(entrySymptomsText(undefined)).toBe('')
    expect(entrySymptomsText({ date: '2026-10-28', meals: [], bowel: [] })).toBe('')
  })
})
