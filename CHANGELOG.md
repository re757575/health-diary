# 變更紀錄

本檔案由 [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) 依照 [Conventional Commits](https://www.conventionalcommits.org/) 規範的 commit 訊息自動產生，請勿手動編輯內容，執行 `npm run release` 即可更新。

## [0.1.5](https://github.com/re757575/health-diary/compare/v0.1.4...v0.1.5) (2026-10-31)

### Features

* **entry:** 在今天分頁提示最近沒填完的紀錄 ([40b922d](https://github.com/re757575/health-diary/commit/40b922dfe4deba02f3d98a2bdb10f01cbfe03e36))
* **entry:** 即時顯示睡眠時數，超過 12 小時要先確認 ([3eaa7d2](https://github.com/re757575/health-diary/commit/3eaa7d2ecee12a5c3ede7f38a1cdfc2a561a876f))
* **entry:** 新增飲水 +250、時間「現在」與複製前一天餐點 ([ed76e9c](https://github.com/re757575/health-diary/commit/ed76e9c3c151d4327032de4efca402e8bbd71bcc))
* **entry:** 新增運動分鐘數與當日狀況標籤 ([9e0ae57](https://github.com/re757575/health-diary/commit/9e0ae572329f2f3ed3c737c7cac4ca4f5b29b1f8))
* **prompt:** 在 AI 提示詞加上資料品質備註 ([e2dc945](https://github.com/re757575/health-diary/commit/e2dc9458338d49f01fa5898536589278ae7901cb))
* **symptom:** 症狀改為點選常用症狀並分輕中重，趨勢頁顯示出現天數 ([d2b3353](https://github.com/re757575/health-diary/commit/d2b3353936be7e57556086ca73e55b80c113bcae))
* **trend:** 趨勢頁新增睡眠、心情與症狀對照 ([1b289e5](https://github.com/re757575/health-diary/commit/1b289e5283a740105acdd9092b7f397e4d068bf3))

### Bug Fixes

* **entry:** 漏填提示預設只列最近 3 天 ([d69d276](https://github.com/re757575/health-diary/commit/d69d276d3bc444e1b01af82862fbb406cc3b0ea4))
* **trend:** 睡眠時數折線圖排除超過 12 小時的疑似填錯日子 ([830bc04](https://github.com/re757575/health-diary/commit/830bc04801e8c9c662fcdad45b1e556fe1453273))
## [0.1.4](https://github.com/re757575/health-diary/compare/v0.1.3...v0.1.4) (2026-10-29)

### Features

* **ui:** 拆成今天、趨勢、設定三個分頁 ([5af5c79](https://github.com/re757575/health-diary/commit/5af5c79a318e6f60cfff983242f6224a489c0866))

### Bug Fixes

* **entry:** 修正切換日期時載入到錯誤的紀錄 ([eec0da9](https://github.com/re757575/health-diary/commit/eec0da9520beb3d2f56cc1122a8d677ea2b7087d))
## [0.1.3](https://github.com/re757575/health-diary/compare/v0.1.2...v0.1.3) (2026-10-29)

### Performance Improvements

* 只引入用到的 Mantine 樣式並拆分 vendor chunk ([6ed1f06](https://github.com/re757575/health-diary/commit/6ed1f06b84289ecf20d29839fc782c8e7cf881f0))
## [0.1.2](https://github.com/re757575/health-diary/compare/v0.1.1...v0.1.2) (2026-10-29)

### Features

* **conditions:** 刪除已知疾病後可以復原 ([b9993c8](https://github.com/re757575/health-diary/commit/b9993c861432c2e844e05f6af0bbc092533c6b00))
* **ui:** 改用 Mantine 重做介面 ([6e70b89](https://github.com/re757575/health-diary/commit/6e70b89682737635dda483e7c5a9296cda89c83d))
* **ui:** 重排版面並加強每日紀錄表單的易用性 ([1e2450d](https://github.com/re757575/health-diary/commit/1e2450d82315507666ad804a444d002b6c5d9b8c))
* **ui:** 評分欄位改為可取消的點選按鈕並加上分數說明 ([46619f7](https://github.com/re757575/health-diary/commit/46619f743fb33e143ddcc0803bc4937cd12bc83b))
## [0.1.1](https://github.com/re757575/health-diary/compare/v0.1.0...v0.1.1) (2026-10-29)

### Build System

* 升級到 Node.js 24，並更新部署用的 GitHub Actions ([26a6511](https://github.com/re757575/health-diary/commit/26a651160a366ddf9d7c1d2d8e9ead38b206e53e))
## 0.1.0 (2026-10-29)

### Features

* 初始化健康日記 Web App ([8ad0a43](https://github.com/re757575/health-diary/commit/8ad0a4365a9291e180bafe0d7701ef6cb03e39db))
* **about:** 頁面顯示 App 版本號，並加入 release 流程 ([b3e7c0a](https://github.com/re757575/health-diary/commit/b3e7c0a9a58022d2285d0ae4a29164b7736c1887))
