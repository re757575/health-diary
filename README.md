# 健康日記

每日記錄飲食與健康狀況（體重、睡眠、排便、飲水、心情、症狀、備註），方便日後分析與追蹤問題。

- 體重不用天天量：沒填的日子視為維持上一次的數值，不算漏填，AI 提示詞也會註明是沿用哪天的；和上次差超過 10% 時（多半是 70 打成 700 這類打錯），儲存前會先請你確認
- 每一餐是一項項的食物，各有數量與單位（預設 1 份）；舊版整段文字的餐點會自動拆成食物，地點等說明移到備註
- 常吃的食物：在「設定」貼上或從 .txt、.csv 匯入食物清單，也能匯出成 .txt（一行一個，可再匯入）（每日紀錄存檔時新吃的食物也會自動加入），三餐可以直接點選，依各餐吃過的次數排序、可邊打字邊篩選
- 用照片記錄食物：拍照後一鍵連同提示詞分享給 AI App，再按「貼上並解析」讀回 AI 的回覆，檢查後選一餐匯入，不用一項項自己輸入（見下方「用照片辨識食物」）；已加入的食物名稱隨時可以修改
- 食物可以拖曳換餐或調整順序：按住食物前面的拖曳把手（點陣圖示）拖到想放的位置放開，插入的位置會畫線提示（手機也能拖，拖到畫面邊緣會自動捲動）；也可以聚焦把手後按鍵盤上下鍵往上或往下移一格，移到餐的盡頭就換到前一餐或後一餐。份量與單位跟著走，換到的那餐已有同名食物時不會移動
- 藥物與保健食品：每天固定吃的在「設定」登記一次，之後每天都當作有吃，沒吃的那天在紀錄裡點一下標出；臨時吃的藥（例如止痛藥）可以在當天加記，都會帶入 AI 提示詞
- 可填寫基本資料（生日、身高、性別）與已知疾病（狀態、開始年月、用藥等備註），會一併帶入 AI 提示詞
- 體重與睡眠時數的趨勢圖，可切換最近 30 天、90 天、1 年（手寫 SVG、不需圖表套件；沒紀錄的日子留白，可展開資料表檢視）
- 資料只存在這台裝置的瀏覽器（IndexedDB），不上傳任何伺服器；啟動時會請瀏覽器把資料設為持久保存，避免被自動清除
- 沒儲存的輸入會隨時存成草稿：App 在背景被系統關掉、或頁面重新整理，再打開那一天會自動還原
- 可安裝到手機主畫面（PWA），離線也能開啟與記錄。每次回到 App 都會檢查新版；新版下載好後，沒有未儲存的修改就趁切到背景時自動更新，也可以點提示立即更新，不會在填寫途中被重新整理
- 可匯出／匯入 JSON 備份（換裝置或備份用）；手機上匯出會開啟系統的分享選單，可以直接存到 iCloud 雲碟、Google 雲端硬碟或傳給自己；超過 7 天沒備份會在「今天」分頁提醒，可一鍵匯出。匯入會覆蓋內容不同的日子時，會先列出日期請你確認
- 一鍵產生給 AI 分析的提示詞，並複製到剪貼簿
- 就醫紀錄：每次看診記一筆（日期、診所／醫院、科別、醫師、症狀、檢查、診斷、醫囑、處方、下次回診、備註），診所、科別、醫師可以點選以前填過的，症狀可以從當天的每日紀錄帶入；會一併帶入 AI 提示詞，回診前 3 天在「今天」分頁提醒
- 就醫報告：選一段期間，整理給醫生看的重點（基本資料、未痊癒的疾病、用藥與服藥天數、這段期間的就醫紀錄、期間摘要、趨勢圖、有狀況的日子），可直接出示或列印、存成 PDF

## 用照片辨識食物

App 本身不會呼叫任何 AI、也不上傳照片；照片只在你和 AI 的對話裡，App 只收你貼回來的文字。拍的照片只暫存在這個畫面的記憶體，匯入或移除後就丟掉，不會存進資料庫。

### 使用方式

在「今天」的「飲食」區塊，按「用照片辨識食物」展開面板：

1. 拍照：按「拍照」（手機直接開後鏡頭；電腦會變成選檔），或按「選擇照片」從相簿挑。照片會先縮到長邊 1280 像素以內的 JPEG（AI 認食物夠用，檔案小很多，分享也快），畫面上會顯示預覽與大小。
2. 給 AI：
   - 手機上按「分享給 AI App」，在系統的分享選單選 ChatGPT、Claude、Gemini 等 App，照片和提示詞會一起送過去。同時提示詞也會複製到剪貼簿：有些 App 收到圖片會丟掉文字，輸入框沒有帶入提示詞時，長按貼上即可。
   - 電腦上（或瀏覽器不支援分享檔案）沒有分享按鈕，改按「複製提示詞」，連同照片貼給 AI。複製失敗時，面板會直接列出提示詞讓你手動複製。
3. 複製 AI 的回覆，回到 App 按「貼上並解析」，會讀剪貼簿的內容、填進「貼上 AI 的回覆」並直接解析。也可以直接長按輸入框貼上，貼完就會自動解析（插在游標處，原本的文字不會被蓋掉）；手動打字或修改內容後，按「解析回覆」。
4. 在辨識結果檢查並修改名稱、數量、單位與備註，不要的項目按 × 移除。
5. 在「匯入到」選一餐（預設是正在填的那一餐，沒有就依現在時間猜），按「匯入」。食物會加進那一餐，記得再按「儲存」。

匯入後的食物和手動輸入的一樣，名稱、數量、單位都還能修改。這餐已有同名的食物（全形半形、大小寫不同也算同名）會略過，不會蓋掉已填的份量；辨識結果的備註會接在這餐原本的備註後面。

### 提示詞與 JSON 格式

提示詞由 `src/domain/photo-meal.ts` 的 `buildPhotoPrompt` 產生，內容包含：

- 任務說明：看照片、列出每一項食物與估計份量，且**只**回覆 JSON、不加說明文字
- 輸出格式與欄位規則（見下）
- 你的常吃食物（最多 60 個，依吃的次數排序）：照片裡的食物若和清單相同，請 AI 沿用同樣的名稱，之後的統計才會算在一起

AI 要回覆的 JSON：

```json
{
  "items": [
    { "name": "燕麥粥", "amount": 1, "unit": "碗" },
    { "name": "水煮蛋", "amount": 2, "unit": "顆" }
  ],
  "note": "家裡煮"
}
```

| 欄位     | 型別          | 說明                                                                                       |
| -------- | ------------- | ------------------------------------------------------------------------------------------ |
| `items`  | 陣列          | 照片裡每一項食物各一筆；一道菜（例如番茄炒蛋）算一筆。沒有食物給 `[]`                      |
| `name`   | 字串          | 繁體中文常見名稱，不超過 30 字                                                             |
| `amount` | 數字          | 依照片估計的份量，可有小數（0.5）                                                          |
| `unit`   | 字串          | 份、碗、盤、杯、瓶、顆、個、片、塊、根、條、盒、包、匙、g、ml 其中之一，沒有合適的用「份」 |
| `note`   | 字串或 `null` | 整餐備註，只有照片明顯看得出來才填（例如便當盒、餐廳）                                     |

解析時很寬鬆，不必要求 AI 回覆得一字不差：

- 回覆包在 ` ```json ` 程式碼區塊、前後夾著說明文字都可以；最外層直接給陣列（沒有 `note`）也可以
- `amount` 寫成字串（`"1.5"`）可以；缺少、不是數字或不是正數時當 1，沒有 `unit` 時當「份」。`unit` 不在上列選項時照原樣保留
- 名稱重複的只留第一項；名稱空白或超過 30 字的略過
- 至少要有一項可用的食物，否則會顯示錯誤（找不到 JSON、格式不符、AI 沒有找到食物等），不會匯入任何東西

## 技術

React 19 + TypeScript + Vite、Dexie（IndexedDB）、Zod、Vitest + Testing Library、Playwright。

## 開發

```bash
npm install
npx playwright install chromium   # 第一次跑 E2E 前
npm run dev                       # http://localhost:5173/health-diary/
```

| 指令                    | 說明                                         |
| ----------------------- | -------------------------------------------- |
| `npm test`              | 單元測試（Vitest）                           |
| `npm run test:coverage` | 單元測試＋覆蓋率（domain 層）                |
| `npm run e2e`           | E2E（會先 build 再用 `vite preview` 啟動）   |
| `npm run lint`          | ESLint + Prettier 檢查                       |
| `npm run typecheck`     | TypeScript 型別檢查                          |
| `npm run build`         | 建置到 `dist/`                               |
| `npm run release`       | 發布新版本：決定版號、更新 CHANGELOG、打 tag |

## Commit 前檢查

`git commit` 會觸發 Husky 的 pre-commit（`.husky/pre-commit`），依序執行：

1. `lint-staged`：只對暫存檔跑 Prettier 與 ESLint `--fix`
2. `npm run typecheck`
3. `npm test`：單元測試
4. `npm run e2e`：E2E

任何一步失敗都會中止 commit。

## 版本發布

頁面最下方的「關於」會顯示目前的 App 版本，版本號取自 `package.json` 的 `version`，建置時注入。版本號與 `CHANGELOG.md` 都由 [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) 依 commit 訊息（[Conventional Commits](https://www.conventionalcommits.org/)）自動產生，不手動修改 `version` 或編輯 `CHANGELOG.md`。

```bash
npm run release          # 依 commit 型別自動判斷版號
npm run release:patch    # 強制升 patch 版號
npm run release:minor    # 強制升 minor 版號
npm run release:major    # 強制升 major 版號
```

執行前工作區要乾淨。它會更新 `package.json`（與 `package-lock.json`）的版本號、產生 `CHANGELOG.md`、建立 `chore(release): x.y.z` commit 並打上 `vX.Y.Z` tag，完成後再自行 push（`git push --follow-tags`）。

## 部署（GitHub Pages）

1. 建立 GitHub repo `health-diary` 並 push `main`
2. Settings → Pages → Source 選「GitHub Actions」
3. 之後每次 push 到 `main`，`.github/workflows/deploy.yml` 會跑 lint → typecheck → build 後自動部署

網址：`https://<username>.github.io/health-diary/`。repo 改名時，同步修改 `vite.config.ts` 的 `BASE` 與 `playwright.config.ts` 的 `BASE_PATH`。

## 目錄結構

```
src/
  domain/   純 TypeScript：資料結構（Zod）、表單轉換、備份匯出入、AI 提示詞（不可 import React／Dexie）
  data/     Dexie 資料庫與 repository
  App.tsx, EntryForm.tsx, DataTools.tsx   UI
public/
  favicon.svg   App 圖示的來源，build 時依 pwa-assets.config.ts 產生各尺寸 PNG（不用提交產物）
e2e/        Playwright 測試
```
