# CLAUDE.md

個人用的每日飲食與健康紀錄 PWA 式 Web App（React 19 + TypeScript），部署在 GitHub Pages，資料只存在使用者裝置（IndexedDB）。

## Commit 前

commit 前必須通過單元測試與 E2E，由 Husky 的 `.husky/pre-commit` 自動執行（lint-staged → typecheck → `npm test` → `npm run e2e`）。失敗就先修好再 commit，**不要用 `--no-verify` 跳過**。只改文件的 commit 也會觸發，屬正常。

多個 worktree 平行跑 E2E 時，用 `E2E_PORT=4181 npm run e2e` 避免 port 衝突。

## 分層

- `src/domain/`：純 TypeScript，不可 import React 或 Dexie（ESLint 強制）。業務規則與資料轉換放這裡，並以單元測試涵蓋。
- `src/data/`：Dexie 與 repository；UI 只透過 repository 存取資料。
- 改動資料結構（`Entry`）時：同步更新 Dexie `version`、備份格式的 `BACKUP_VERSION`，並確保舊備份仍可匯入。

## UI

UI 庫是 Mantine（`@mantine/core`），`MantineProvider` 在 `src/Providers.tsx`，主題在 `src/theme.ts`。

- 日期、時間、數字欄位用 `TextInput type=...`、下拉用 `NativeSelect`，保留原生控制項（手機體驗與測試的 `selectOption` 都依賴它）。
- 區塊用 `Section`（有標題的卡片，標題即 region 名稱）。
- 單元測試要從 `@/test/render` 匯入 `render`，它會包上 Provider；直接用 RTL 的 `render` 會因找不到 `MantineProvider` 而報錯。
- Mantine 樣式在 `src/main.tsx` 按元件引入，不用整包 `@mantine/core/styles.css`（CSS 約少 190 kB）。**新用到 Mantine 元件時，要把它的樣式補進去**，漏掉不會報錯，只是長得不對（沒有背景、版面跑掉）。引入順序要比照 `node_modules/@mantine/core/styles.css`，後面的規則會蓋掉前面的（例如 `UnstyledButton` 要在 `Button` 前面）；有些元件的樣式在別的檔案裡（`NativeSelect` 的下拉箭頭在 `Combobox.css`）。

## Release

**版本號與 `CHANGELOG.md` 一律由 `npm run release` 產生**（commit-and-tag-version，依 Conventional Commits），不手動改 `package.json` 的 `version` 或 `CHANGELOG.md`；release 會建立 commit 與 tag，只在使用者明確要求時執行。指令見 `README.md`「版本發布」。頁面最下方「關於」顯示的版本號就是 `version`。

## 其他

- GitHub Pages 的 base path 是 `/health-diary/`（`vite.config.ts` 的 `BASE`、`playwright.config.ts` 的 `BASE_PATH`），E2E 的 `page.goto` 用相對路徑（`'./'`），不要以 `/` 開頭。
- 介面文字一律繁體中文。
- 要看實際畫面時，用 `npm run preview:fresh`（先 build 再在 4199 起 preview，網址 `http://localhost:4199/health-diary/`）。它會一直跑在前景，背景執行並在看完後 `pkill -f 'preview --port 4199'`。
