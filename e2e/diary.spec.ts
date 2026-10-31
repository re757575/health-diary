import { expect, test, type Page } from '@playwright/test'

const openTab = (page: Page, name: '今天' | '趨勢' | '設定') =>
  page.getByRole('tab', { name }).click()

test('記錄一天 → 重新整理仍在 → 產生 AI 提示詞', async ({ page }) => {
  await page.goto('./')

  await page.getByLabel('體重（kg）').fill('70.5')
  await page.getByLabel('入睡時間').fill('23:30')
  await page.getByLabel('起床時間').fill('07:00')
  await page.getByLabel('早餐').fill('燕麥奶加香蕉')
  await page
    .getByRole('group', { name: '睡眠品質（1–5）' })
    .getByRole('button', { name: '4' })
    .click()
  const moodFive = page
    .getByRole('group', { name: '心情／精神（1–5）' })
    .getByRole('button', { name: '5' })
  await moodFive.hover()
  await expect(page.getByRole('tooltip')).toContainText('很好：心情愉快，精神充沛')
  await moodFive.click()
  await page.getByRole('button', { name: '新增排便' }).click()
  await page
    .getByRole('group', { name: '布里斯托（1–7）' })
    .getByRole('button', { name: '4' })
    .click()
  await page.getByRole('button', { name: '儲存', exact: true }).click()
  await expect(page.getByText(/已儲存 \d{4}-\d{2}-\d{2} 的紀錄/)).toBeVisible()

  // 資料存在裝置上：重新整理後仍在
  await page.reload()
  await expect(page.getByLabel('早餐')).toHaveValue('燕麥奶加香蕉')
  // 評分按鈕：重新整理後仍是選取狀態，再點一次可取消
  const mood = page
    .getByRole('group', { name: '心情／精神（1–5）' })
    .getByRole('button', { name: '5' })
  await expect(mood).toHaveAttribute('aria-pressed', 'true')
  await mood.click()
  await expect(mood).toHaveAttribute('aria-pressed', 'false')

  await openTab(page, '趨勢')
  await expect(
    page.getByRole('region', { name: '歷史紀錄' }).getByText('70.5 kg · 睡 7.5 小時'),
  ).toBeVisible()

  await openTab(page, '設定')
  await page.getByRole('button', { name: '產生 AI 提示詞' }).click()
  const prompt = page.getByLabel('提示詞')
  await expect(prompt).toContainText('體重：70.5 kg')
  await expect(prompt).toContainText('早餐：燕麥奶加香蕉')
  await expect(prompt).toContainText('布里斯托 4 型')
  // 重新整理後取消的是畫面上的選取，已儲存的紀錄不受影響
  await expect(prompt).toContainText('品質 4/5')
  await expect(prompt).toContainText('心情／精神：5/5')
})

test('填寫基本資料與已知疾病 → 重新整理仍在 → 出現在 AI 提示詞', async ({ page }) => {
  await page.goto('./')
  await openTab(page, '設定')

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
  await openTab(page, '設定')
  await expect(page.getByLabel('身高（cm）')).toHaveValue('175')
  await expect(page.getByText('穩定控制中 · 2020-03 起 · 每日服藥')).toBeVisible()

  // 提示詞需要至少一天的紀錄
  await openTab(page, '今天')
  await page.getByLabel('體重（kg）').fill('70')
  await page.getByRole('button', { name: '儲存', exact: true }).click()
  await expect(page.getByText(/已儲存 \d{4}-\d{2}-\d{2} 的紀錄/)).toBeVisible()

  await openTab(page, '設定')
  await page.getByRole('button', { name: '產生 AI 提示詞' }).click()
  const prompt = page.getByLabel('提示詞')
  await expect(prompt).toContainText('- 身高：175 cm')
  await expect(prompt).toContainText('- 高血壓（2020-03 起，穩定控制中）：每日服藥')

  // 刪除後可以復原，內容不變，重新整理後也還在
  await page.getByRole('button', { name: '刪除 高血壓' }).click()
  await expect(page.getByText('尚未填寫。沒有已知疾病可略過。')).toBeVisible()
  await page.getByRole('button', { name: '復原' }).click()
  await expect(page.getByText('已復原「高血壓」')).toBeVisible()
  await page.reload()
  await openTab(page, '設定')
  await expect(page.getByText('穩定控制中 · 2020-03 起 · 每日服藥')).toBeVisible()

  // 不復原就是真的刪掉：重新整理後復原按鈕消失，疾病不會回來
  await page.getByRole('button', { name: '刪除 高血壓' }).click()
  await expect(page.getByText('已刪除「高血壓」')).toBeVisible()
  await page.reload()
  await openTab(page, '設定')
  await expect(page.getByText('尚未填寫。沒有已知疾病可略過。')).toBeVisible()
  await expect(page.getByRole('button', { name: '復原' })).toHaveCount(0)
})

test('匯出備份 → 匯入到全新環境還原資料', async ({ page, browser }) => {
  await page.goto('./')
  await openTab(page, '設定')
  await page.getByLabel('身高（cm）').fill('172')
  await page.getByRole('button', { name: '儲存基本資料' }).click()
  await expect(page.getByText('已儲存基本資料')).toBeVisible()
  await page.getByLabel('疾病名稱').fill('胃食道逆流')
  await page.getByRole('button', { name: '新增疾病' }).click()
  await expect(page.getByText('已新增「胃食道逆流」')).toBeVisible()
  await openTab(page, '今天')
  await page.getByLabel('體重（kg）').fill('68.2')
  await page.getByRole('button', { name: '儲存', exact: true }).click()
  await expect(page.getByText(/已儲存 \d{4}-\d{2}-\d{2} 的紀錄/)).toBeVisible()

  await openTab(page, '設定')
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
  await openTab(fresh, '趨勢')
  await expect(fresh.getByText('還沒有紀錄。')).toBeVisible()

  await openTab(fresh, '設定')
  await fresh.getByLabel('匯入備份').setInputFiles(backupPath)
  await expect(fresh.getByText('已匯入 1 筆紀錄與 1 項疾病')).toBeVisible()
  await expect(
    fresh.getByRole('region', { name: '已知疾病' }).getByText('胃食道逆流'),
  ).toBeVisible()
  await expect(fresh.getByLabel('身高（cm）')).toHaveValue('172')
  await openTab(fresh, '趨勢')
  await expect(fresh.getByRole('region', { name: '歷史紀錄' }).getByText('68.2 kg')).toBeVisible()
  await context.close()
})

test('分頁：切換不丟輸入；歷史紀錄按編輯回到今天並載入那一天；前一天後一天', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('tab', { name: '今天' })).toHaveAttribute('aria-selected', 'true')

  // 還沒儲存的輸入，切到別的分頁再回來仍在
  await page.getByLabel('體重（kg）').fill('70')
  await openTab(page, '設定')
  await expect(page.getByRole('region', { name: '每日紀錄' })).toBeHidden()
  await openTab(page, '今天')
  await expect(page.getByLabel('體重（kg）')).toHaveValue('70')
  await page.getByRole('button', { name: '儲存', exact: true }).click()
  await expect(page.getByText(/已儲存 \d{4}-\d{2}-\d{2} 的紀錄/)).toBeVisible()

  // 前一天沒有紀錄：表單是空的，補填後存起來
  const today = await page.getByLabel('日期').inputValue()
  await page.getByRole('button', { name: '前一天', exact: true }).click()
  await expect(page.getByLabel('日期')).not.toHaveValue(today)
  await expect(page.getByLabel('體重（kg）')).toHaveValue('')
  await page.getByLabel('體重（kg）').fill('69')
  await page.getByRole('button', { name: '儲存', exact: true }).click()
  await expect(page.getByText(/已儲存 \d{4}-\d{2}-\d{2} 的紀錄/)).toBeVisible()
  const yesterday = await page.getByLabel('日期').inputValue()

  // 後一天載入的是今天的紀錄，不是前一天的
  await page.getByRole('button', { name: '後一天', exact: true }).click()
  await expect(page.getByLabel('日期')).toHaveValue(today)
  await expect(page.getByLabel('體重（kg）')).toHaveValue('70')

  // 到「趨勢」的歷史紀錄編輯前一天：切回「今天」並載入 69
  await openTab(page, '趨勢')
  await page.getByRole('button', { name: `編輯 ${yesterday}` }).click()
  await expect(page.getByRole('tab', { name: '今天' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByLabel('日期')).toHaveValue(yesterday)
  await expect(page.getByLabel('體重（kg）')).toHaveValue('69')
})

test('睡眠時數：即時顯示；超過 12 小時要確認、不畫進趨勢圖，改正時間後可直接儲存', async ({
  page,
}) => {
  await page.goto('./')

  await page.getByLabel('入睡時間').fill('23:50')
  await page.getByLabel('起床時間').fill('07:40')
  await expect(page.getByText('睡 7.8 小時')).toBeVisible()

  // 入睡時間誤填成上午 11:50
  await page.getByLabel('入睡時間').fill('11:50')
  await expect(page.getByText(/睡 19\.8 小時，時間是不是填錯了/)).toBeVisible()
  await page.getByRole('button', { name: '儲存', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('請確認入睡與起床時間')

  // 第一次沒有寫入：重新整理後欄位是空的
  await page.reload()
  await expect(page.getByLabel('入睡時間')).toHaveValue('')

  // 時間確實是這樣（例如夜班）：確認後才儲存
  await page.getByLabel('入睡時間').fill('11:50')
  await page.getByLabel('起床時間').fill('07:40')
  await page.getByRole('button', { name: '儲存', exact: true }).click()
  await page.getByRole('button', { name: '睡眠 19.8 小時無誤，儲存' }).click()
  await expect(page.getByText(/已儲存 \d{4}-\d{2}-\d{2} 的紀錄/)).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('入睡時間')).toHaveValue('11:50')

  // 趨勢頁：疑似填錯的睡眠不畫進圖，並說明原因
  await openTab(page, '趨勢')
  const sleepChart = page.getByRole('figure', { name: '睡眠時數趨勢' })
  await expect(sleepChart).toContainText('最近 30 天還沒有睡眠紀錄')
  await expect(sleepChart).toContainText('1 天的睡眠時數超過 12 小時')
  await openTab(page, '今天')

  // 改正後不再警告，一次儲存
  await page.getByLabel('入睡時間').fill('23:50')
  await expect(page.getByText(/是不是填錯了/)).toHaveCount(0)
  await page.getByRole('button', { name: '儲存', exact: true }).click()
  await expect(page.getByText(/已儲存 \d{4}-\d{2}-\d{2} 的紀錄/)).toBeVisible()

  // 改正後睡眠回到趨勢圖，不再有說明
  await openTab(page, '趨勢')
  await expect(sleepChart).toContainText('最新 7.8 小時')
  await expect(sleepChart).not.toContainText('超過 12 小時')
})

test('快速輸入：飲水 +250、時間「現在」按鈕、複製前一天的餐點', async ({ page }) => {
  await page.goto('./')

  // 飲水 +250 ml 累加
  await page.getByRole('button', { name: '飲水加 250 ml' }).click()
  await page.getByRole('button', { name: '飲水加 250 ml' }).click()
  await expect(page.getByLabel('飲水（ml）')).toHaveValue('500')

  // 「現在」按鈕填入目前時間（HH:mm）
  await page.getByRole('button', { name: '新增排便' }).click()
  await expect(page.getByLabel('時間', { exact: true })).toHaveValue('')
  await page.getByRole('button', { name: '填入現在時刻：第 1 次排便' }).click()
  await expect(page.getByLabel('時間', { exact: true })).toHaveValue(/^\d{2}:\d{2}$/)

  await page.getByLabel('早餐').fill('豆漿 蛋餅')
  await page.getByLabel('午餐').fill('雞腿便當')
  await page.getByLabel('體重（kg）').fill('68')
  await page.getByRole('button', { name: '儲存', exact: true }).click()
  await expect(page.getByText(/已儲存 \d{4}-\d{2}-\d{2} 的紀錄/)).toBeVisible()
  const saved = await page.getByLabel('日期').inputValue()

  // 隔天的表單是空的；複製前一天只帶餐點，體重、飲水、排便不帶，也還沒儲存
  await page.getByRole('button', { name: '後一天', exact: true }).click()
  await expect(page.getByLabel('日期')).not.toHaveValue(saved)
  await expect(page.getByLabel('早餐')).toHaveValue('')
  await page.getByLabel('午餐').fill('自己打的午餐')
  await page.getByRole('button', { name: '複製前一天的餐點' }).click()
  await expect(page.getByRole('status')).toContainText(`已帶入 ${saved} 的 1 個餐別`)
  await expect(page.getByLabel('早餐')).toHaveValue('豆漿 蛋餅')
  await expect(page.getByLabel('午餐')).toHaveValue('自己打的午餐')
  await expect(page.getByLabel('體重（kg）')).toHaveValue('')
  await expect(page.getByLabel('飲水（ml）')).toHaveValue('')
  await expect(page.getByRole('button', { name: /^填入現在時刻：第/ })).toHaveCount(0)

  // 帶入後按儲存才寫入，重新整理後仍在
  await page.getByRole('button', { name: '儲存', exact: true }).click()
  await expect(page.getByText(/已儲存 \d{4}-\d{2}-\d{2} 的紀錄/)).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: '後一天', exact: true }).click()
  await expect(page.getByLabel('早餐')).toHaveValue('豆漿 蛋餅')
  await expect(page.getByLabel('午餐')).toHaveValue('自己打的午餐')
})

test('症狀：點選＋輕中重 → 自訂症狀 → 趨勢頁出現天數 → 隔天清單有自訂症狀 → 進 AI 提示詞', async ({
  page,
}) => {
  await page.goto('./')

  const symptoms = page.getByRole('group', { name: '症狀', exact: true })
  await symptoms.getByRole('button', { name: '頭痛' }).click()
  await page
    .getByRole('group', { name: '頭痛的嚴重程度' })
    .getByRole('button', { name: '重' })
    .click()
  await symptoms.getByRole('button', { name: '鼻塞' }).click()
  // 自訂症狀：Enter 是新增，不會送出表單
  await page.getByLabel('新增其他症狀').fill('耳鳴')
  await page.getByLabel('新增其他症狀').press('Enter')
  await expect(symptoms.getByRole('button', { name: '耳鳴' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByText(/已儲存/)).toHaveCount(0)
  await page.getByLabel('症狀補充').fill('下午開車時腰椎酸痛')
  await page.getByRole('button', { name: '儲存', exact: true }).click()
  await expect(page.getByText(/已儲存 \d{4}-\d{2}-\d{2} 的紀錄/)).toBeVisible()

  // 重新整理後仍是選取狀態，嚴重程度也在
  await page.reload()
  await expect(
    page.getByRole('group', { name: '症狀', exact: true }).getByRole('button', { name: '頭痛' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(
    page.getByRole('group', { name: '頭痛的嚴重程度' }).getByRole('button', { name: '重' }),
  ).toHaveAttribute('aria-pressed', 'true')

  // 趨勢頁：各症狀出現天數
  await openTab(page, '趨勢')
  const chart = page.getByRole('figure', { name: '症狀出現天數' })
  await expect(chart.getByRole('listitem').filter({ hasText: '頭痛' })).toContainText(
    '1 天（重 1）',
  )
  await expect(chart.getByRole('listitem').filter({ hasText: '鼻塞' })).toContainText(
    '1 天（輕 1）',
  )
  await expect(chart.getByRole('listitem').filter({ hasText: '耳鳴' })).toContainText(
    '1 天（輕 1）',
  )

  // 隔天的清單裡有自訂的「耳鳴」，但沒選
  await openTab(page, '今天')
  await page.getByRole('button', { name: '後一天', exact: true }).click()
  await expect(
    page.getByRole('group', { name: '症狀', exact: true }).getByRole('button', { name: '耳鳴' }),
  ).toHaveAttribute('aria-pressed', 'false')

  // AI 提示詞：症狀附上程度
  await openTab(page, '設定')
  await page.getByRole('button', { name: '產生 AI 提示詞' }).click()
  await expect(page.getByLabel('提示詞')).toContainText(
    '症狀：頭痛（重）、鼻塞（輕）、耳鳴（輕）；下午開車時腰椎酸痛',
  )
})

test('運動與今天的狀況：填寫後重新整理仍在，自訂標籤隔天出現在清單，進 AI 提示詞', async ({
  page,
}) => {
  await page.goto('./')

  await page.getByLabel('運動（分鐘）').fill('120')
  const tags = page.getByRole('group', { name: '今天的狀況' })
  await tags.getByRole('button', { name: '空氣品質差' }).click()
  await tags.getByRole('button', { name: '久坐' }).click()
  await page.getByLabel('新增其他狀況').fill('出差')
  await page.getByRole('button', { name: '新增狀況' }).click()
  await expect(tags.getByRole('button', { name: '出差' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '儲存', exact: true }).click()
  await expect(page.getByText(/已儲存 \d{4}-\d{2}-\d{2} 的紀錄/)).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('運動（分鐘）')).toHaveValue('120')
  await expect(tags.getByRole('button', { name: '空氣品質差' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(tags.getByRole('button', { name: '沒午休' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )

  // 隔天：自訂的「出差」在清單裡但沒選，運動是空的
  await page.getByRole('button', { name: '後一天', exact: true }).click()
  await expect(page.getByLabel('運動（分鐘）')).toHaveValue('')
  await expect(tags.getByRole('button', { name: '出差' })).toHaveAttribute('aria-pressed', 'false')

  await openTab(page, '設定')
  await page.getByRole('button', { name: '產生 AI 提示詞' }).click()
  const prompt = page.getByLabel('提示詞')
  await expect(prompt).toContainText('- 運動：120 分鐘')
  await expect(prompt).toContainText('- 當日狀況：空氣品質差、久坐、出差')
})

test('AI 提示詞的資料品質備註：標出疑似填錯的睡眠與漏填的欄位', async ({ page }) => {
  await page.goto('./')

  // 今天：入睡誤填成上午，確認後儲存
  await page.getByLabel('入睡時間').fill('11:50')
  await page.getByLabel('起床時間').fill('07:40')
  await page.getByRole('button', { name: '儲存', exact: true }).click()
  await page.getByRole('button', { name: '睡眠 19.8 小時無誤，儲存' }).click()
  await expect(page.getByText(/已儲存 \d{4}-\d{2}-\d{2} 的紀錄/)).toBeVisible()

  // 前一天：只填體重，其餘核心欄位算漏填
  await page.getByRole('button', { name: '前一天', exact: true }).click()
  await page.getByLabel('體重（kg）').fill('68')
  await page.getByRole('button', { name: '儲存', exact: true }).click()
  await expect(page.getByText(/已儲存 \d{4}-\d{2}-\d{2} 的紀錄/)).toBeVisible()
  const yesterday = await page.getByLabel('日期').inputValue()

  await openTab(page, '設定')
  await page.getByRole('button', { name: '產生 AI 提示詞' }).click()
  const prompt = page.getByLabel('提示詞')
  await expect(prompt).toContainText('# 資料品質備註')
  await expect(prompt).toContainText('疑似填錯：')
  await expect(prompt).toContainText('睡眠 19.8 小時（11:50 入睡、07:40 起床）')
  // 前一天漏填；今天的紀錄還可能在填，不列入
  await expect(prompt).toContainText(`- 沒填：飲水 1 天（${yesterday}）`)
  await expect(prompt).toContainText(`- 沒填：心情 1 天（${yesterday}）`)
  await expect(prompt).not.toContainText('體重 1 天')
})

test('漏填提示：列出沒填完的日子，補填跳到那天，補完後消失', async ({ page }) => {
  await page.goto('./')
  const notice = page.getByRole('region', { name: '未填完的紀錄' })
  await expect(notice).toHaveCount(0)

  // 前一天只填體重並儲存
  await page.getByRole('button', { name: '前一天', exact: true }).click()
  await page.getByLabel('體重（kg）').fill('68')
  await page.getByRole('button', { name: '儲存', exact: true }).click()
  await expect(page.getByText(/已儲存 \d{4}-\d{2}-\d{2} 的紀錄/)).toBeVisible()
  const yesterday = await page.getByLabel('日期').inputValue()

  // 正在編輯那一天：列出缺漏，但不給補填
  await expect(notice).toContainText('最近有 1 天的紀錄沒填完')
  await expect(notice).toContainText('沒填：飲水、睡眠時間、心情')
  await expect(notice.getByText('編輯中')).toBeVisible()

  // 回到今天：可以按補填跳回前一天，體重還在
  await page.getByRole('button', { name: '後一天', exact: true }).click()
  await page.getByRole('button', { name: `補填 ${yesterday}` }).click()
  await expect(page.getByLabel('日期')).toHaveValue(yesterday)
  await expect(page.getByLabel('體重（kg）')).toHaveValue('68')

  // 補完所有核心欄位後存檔，提示消失
  await page.getByLabel('飲水（ml）').fill('2000')
  await page.getByLabel('入睡時間').fill('23:30')
  await page.getByLabel('起床時間').fill('07:00')
  await page
    .getByRole('group', { name: '心情／精神（1–5）' })
    .getByRole('button', { name: '3' })
    .click()
  await page.getByRole('button', { name: '儲存', exact: true }).click()
  await expect(page.getByText(/已儲存 \d{4}-\d{2}-\d{2} 的紀錄/)).toBeVisible()
  await expect(notice).toHaveCount(0)
})

test('趨勢：睡眠對心情與症狀的對照；睡眠填錯的日子不列入', async ({ page }) => {
  // 以今天往前數 1～6 天；前 3 天睡不夠、心情低、常有症狀，後 3 天睡得夠、心情好、沒症狀
  const dateOf = (daysAgo: number) => {
    const d = new Date()
    d.setDate(d.getDate() - daysAgo)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  const short = { bedtime: '01:00', wakeTime: '06:00' }
  const enough = { bedtime: '23:00', wakeTime: '07:00' }
  const entry = (daysAgo: number, sleep: object, mood: number, symptomItems: object[]) => ({
    date: dateOf(daysAgo),
    sleep,
    mood,
    symptomItems,
    meals: [],
    bowel: [],
  })
  const backup = {
    app: 'health-diary',
    version: 3,
    exportedAt: new Date().toISOString(),
    conditions: [],
    entries: [
      entry(1, short, 2, [{ name: '頭痛', severity: 2 }]),
      entry(2, short, 2, [{ name: '頭痛', severity: 1 }]),
      entry(3, short, 3, []),
      entry(4, enough, 4, []),
      entry(5, enough, 5, []),
      entry(6, enough, 4, [{ name: '鼻塞', severity: 1 }]),
      // 入睡誤填成上午：不列入睡眠對照
      entry(7, { bedtime: '11:50', wakeTime: '07:40' }, 3, []),
    ],
  }

  await page.goto('./')
  await openTab(page, '設定')
  await page.getByLabel('匯入備份').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  })
  await expect(page.getByText('已匯入 7 筆紀錄')).toBeVisible()

  await openTab(page, '趨勢')
  const figure = page.getByRole('figure', { name: '睡眠、心情與症狀對照' })
  await expect(figure.getByRole('img', { name: /共 7 天有紀錄/ })).toBeVisible()
  const table = figure.getByRole('table', { name: '睡眠對照表' })
  await expect(table.getByRole('row', { name: /睡不到 6.5 小時/ })).toContainText('3 天2.32／3 天')
  await expect(table.getByRole('row', { name: /睡 6.5 小時以上/ })).toContainText('3 天4.31／3 天')

  // 資料表：填錯的那天睡眠是「—」
  await figure.getByText('檢視資料表').click()
  const data = figure.getByRole('table', { name: '睡眠、心情與症狀資料表' })
  await expect(data.getByRole('row', { name: new RegExp(dateOf(7)) })).toContainText('—3/5沒有症狀')
})
