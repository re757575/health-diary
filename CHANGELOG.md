# 變更紀錄

本檔案由 [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) 依照 [Conventional Commits](https://www.conventionalcommits.org/) 規範的 commit 訊息自動產生，請勿手動編輯內容，執行 `npm run release` 即可更新。

## [0.1.10](https://github.com/re757575/health-diary/compare/v0.1.9...v0.1.10) (2026-10-31)

### Features

* **backup:** 手機上匯出備份改用系統分享選單 ([8600cb4](https://github.com/re757575/health-diary/commit/8600cb41ded8b6f53eda8400964f532fc0a23566))
* **entry:** 體重和上次差太多時，儲存前先確認是否打錯 ([9c2539c](https://github.com/re757575/health-diary/commit/9c2539c3885e6dbafdb066ede7e5e9d156f91ca9))
* **pwa:** 回到 App 時檢查新版，沒有未儲存的修改就在背景自動更新 ([fcb5e28](https://github.com/re757575/health-diary/commit/fcb5e2881a65504cd6dd73081870ecb59974863c))
* **trend:** 趨勢頁可切換 30 天、90 天與 1 年 ([d96925e](https://github.com/re757575/health-diary/commit/d96925eae98db00bb8427bcc4c09142e5071da6a))
## [0.1.9](https://github.com/re757575/health-diary/compare/v0.1.8...v0.1.9) (2026-10-31)

### Features

* **trend:** 體重趨勢圖用虛線畫出沒量、維持上一次數值的日子 ([d7b428e](https://github.com/re757575/health-diary/commit/d7b428eef764b960a84b7abdc17e4d5d87511f42))
## [0.1.8](https://github.com/re757575/health-diary/compare/v0.1.7...v0.1.8) (2026-10-31)

### Features

* **entry:** 沒填體重的日子視為維持上一次的數值 ([56674ab](https://github.com/re757575/health-diary/commit/56674ab466e911d23e4f6ef59a5beb5f7f6559c2))
## [0.1.7](https://github.com/re757575/health-diary/compare/v0.1.6...v0.1.7) (2026-10-31)

### Bug Fixes

* **ui:** 修正手機上被截斷的按鈕與換行混亂的表格，並淡化刪除按鈕 ([69ceb59](https://github.com/re757575/health-diary/commit/69ceb5996992b457c6f3eacf8da3922dc1903b74))
## [0.1.6](https://github.com/re757575/health-diary/compare/v0.1.5...v0.1.6) (2026-10-31)

### Features

* **backup:** 太久沒備份時在今天分頁提醒並可一鍵匯出 ([63c1584](https://github.com/re757575/health-diary/commit/63c1584f6837d949f57def0c60dc992149f6fbfa))
* **backup:** 匯入會覆蓋內容不同的紀錄時先請使用者確認 ([a4a6599](https://github.com/re757575/health-diary/commit/a4a659924e06342d7f80f291e9a7c7952f3e4bfa))
* **entry:** 切換日期或關閉頁面前提醒尚未儲存的修改 ([19ae56c](https://github.com/re757575/health-diary/commit/19ae56ced775ddba2c59f80b270e3f767cb11107))
* **entry:** 新增「當天沒有排便」，AI 提示詞區分沒排便與沒填 ([07fd861](https://github.com/re757575/health-diary/commit/07fd861095c6b5639526389780155a290f4fe170))
* **history:** 歷史紀錄可刪除某天的紀錄並復原 ([733d620](https://github.com/re757575/health-diary/commit/733d6205dd80be4a8e01651abd45517aa6df8d59))
* **pwa:** 支援安裝到主畫面與離線使用，並請求持久保存資料 ([3c424f8](https://github.com/re757575/health-diary/commit/3c424f8fa829eb739b0f50c9228222efb991484d))

### Bug Fixes

* **entry:** 跨過午夜回到 App 時切換到新的一天 ([ce3cb82](https://github.com/re757575/health-diary/commit/ce3cb821228669b81090867f25e1b09c2a5d4ad4))
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
