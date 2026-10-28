import { expect, test } from '@playwright/test'

test('記錄一天 → 重新整理仍在 → 產生 AI 提示詞', async ({ page }) => {
  await page.goto('./')

  await page.getByLabel('體重（kg）').fill('70.5')
  await page.getByLabel('入睡時間').fill('23:30')
  await page.getByLabel('起床時間').fill('07:00')
  await page.getByLabel('早餐').fill('燕麥奶加香蕉')
  await page.getByRole('button', { name: '新增排便' }).click()
  await page.getByLabel('布里斯托（1–7）').fill('4')
  await page.getByRole('button', { name: '儲存', exact: true }).click()
  await expect(page.getByText(/已儲存 \d{4}-\d{2}-\d{2} 的紀錄/)).toBeVisible()

  // 資料存在裝置上：重新整理後仍在
  await page.reload()
  await expect(
    page
      .getByRole('region', { name: '歷史紀錄' })
      .getByText(/^\d{4}-\d{2}-\d{2} · 70\.5 kg · 睡 7\.5 小時$/),
  ).toBeVisible()
  await expect(page.getByLabel('早餐')).toHaveValue('燕麥奶加香蕉')

  await page.getByRole('button', { name: '產生 AI 提示詞' }).click()
  const prompt = page.getByLabel('提示詞')
  await expect(prompt).toContainText('體重：70.5 kg')
  await expect(prompt).toContainText('早餐：燕麥奶加香蕉')
  await expect(prompt).toContainText('布里斯托 4 型')
})

test('填寫基本資料與已知疾病 → 重新整理仍在 → 出現在 AI 提示詞', async ({ page }) => {
  await page.goto('./')

  await page.getByLabel('生日').fill('1990-05-20')
  await page.getByLabel('身高（cm）').fill('175')
  await page.getByLabel('性別').selectOption({ label: '男' })
  await page.getByRole('button', { name: '儲存基本資料' }).click()
  await expect(page.getByText('已儲存基本資料')).toBeVisible()

  await page.getByLabel('疾病名稱').fill('高血壓')
  await page.getByLabel('開始時間').fill('2020-03')
  await page.getByLabel(/疾病備註/).fill('每日服藥')
  await page.getByRole('button', { name: '新增疾病' }).click()
  await expect(page.getByText('已新增「高血壓」')).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('身高（cm）')).toHaveValue('175')
  await expect(page.getByText('高血壓 · 穩定控制中 · 2020-03 起 · 每日服藥')).toBeVisible()

  // 提示詞需要至少一天的紀錄
  await page.getByLabel('體重（kg）').fill('70')
  await page.getByRole('button', { name: '儲存', exact: true }).click()
  await expect(page.getByText(/已儲存 \d{4}-\d{2}-\d{2} 的紀錄/)).toBeVisible()

  await page.getByRole('button', { name: '產生 AI 提示詞' }).click()
  const prompt = page.getByLabel('提示詞')
  await expect(prompt).toContainText('- 身高：175 cm')
  await expect(prompt).toContainText('- 高血壓（2020-03 起，穩定控制中）：每日服藥')

  await page.getByRole('button', { name: '刪除 高血壓' }).click()
  await expect(page.getByText('尚未填寫。沒有已知疾病可略過。')).toBeVisible()
})

test('匯出備份 → 匯入到全新環境還原資料', async ({ page, browser }) => {
  await page.goto('./')
  await page.getByLabel('身高（cm）').fill('172')
  await page.getByRole('button', { name: '儲存基本資料' }).click()
  await expect(page.getByText('已儲存基本資料')).toBeVisible()
  await page.getByLabel('疾病名稱').fill('胃食道逆流')
  await page.getByRole('button', { name: '新增疾病' }).click()
  await expect(page.getByText('已新增「胃食道逆流」')).toBeVisible()
  await page.getByLabel('體重（kg）').fill('68.2')
  await page.getByRole('button', { name: '儲存', exact: true }).click()
  await expect(page.getByText(/已儲存 \d{4}-\d{2}-\d{2} 的紀錄/)).toBeVisible()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '匯出備份' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^health-diary-\d{4}-\d{2}-\d{2}\.json$/)
  const backupPath = await download.path()

  // 新的 browser context 沒有任何資料
  const context = await browser.newContext()
  const fresh = await context.newPage()
  await fresh.goto(page.url())
  await expect(fresh.getByText('還沒有紀錄。')).toBeVisible()

  await fresh.getByLabel('匯入備份').setInputFiles(backupPath)
  await expect(fresh.getByText('已匯入 1 筆紀錄與 1 項疾病')).toBeVisible()
  await expect(
    fresh.getByRole('region', { name: '歷史紀錄' }).getByText(/^\d{4}-\d{2}-\d{2} · 68\.2 kg$/),
  ).toBeVisible()
  await expect(fresh.getByText('胃食道逆流 · 穩定控制中')).toBeVisible()
  await expect(fresh.getByLabel('身高（cm）')).toHaveValue('172')
  await context.close()
})
