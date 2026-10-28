# 健康日記

每日記錄飲食與健康狀況（體重、睡眠、排便、飲水、心情、症狀、備註），方便日後分析與追蹤問題。

- 可填寫基本資料（生日、身高、性別）與已知疾病（狀態、開始年月、用藥等備註），會一併帶入 AI 提示詞
- 體重與睡眠時數的最近 30 天趨勢圖（手寫 SVG、不需圖表套件；沒紀錄的日子留白，可展開資料表檢視）
- 資料只存在這台裝置的瀏覽器（IndexedDB），不上傳任何伺服器
- 可匯出／匯入 JSON 備份（換裝置或備份用）
- 一鍵產生給 AI 分析的提示詞，並複製到剪貼簿

## 技術

React 19 + TypeScript + Vite、Dexie（IndexedDB）、Zod、Vitest + Testing Library、Playwright。

## 開發

```bash
npm install
npx playwright install chromium   # 第一次跑 E2E 前
npm run dev                       # http://localhost:5173/health-diary/
```

| 指令                    | 說明                                       |
| ----------------------- | ------------------------------------------ |
| `npm test`              | 單元測試（Vitest）                         |
| `npm run test:coverage` | 單元測試＋覆蓋率（domain 層）              |
| `npm run e2e`           | E2E（會先 build 再用 `vite preview` 啟動） |
| `npm run lint`          | ESLint + Prettier 檢查                     |
| `npm run typecheck`     | TypeScript 型別檢查                        |
| `npm run build`         | 建置到 `dist/`                             |

## Commit 前檢查

`git commit` 會觸發 Husky 的 pre-commit（`.husky/pre-commit`），依序執行：

1. `lint-staged`：只對暫存檔跑 Prettier 與 ESLint `--fix`
2. `npm run typecheck`
3. `npm test`：單元測試
4. `npm run e2e`：E2E

任何一步失敗都會中止 commit。

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
e2e/        Playwright 測試
```
