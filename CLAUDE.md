# CLAUDE.md

個人用的每日飲食與健康紀錄 PWA 式 Web App（React 19 + TypeScript），部署在 GitHub Pages，資料只存在使用者裝置（IndexedDB）。

## Commit 前

commit 前必須通過單元測試與 E2E，由 Husky 的 `.husky/pre-commit` 自動執行（lint-staged → typecheck → `npm test` → `npm run e2e`）。失敗就先修好再 commit，**不要用 `--no-verify` 跳過**。只改文件的 commit 也會觸發，屬正常。

多個 worktree 平行跑 E2E 時，用 `E2E_PORT=4181 npm run e2e` 避免 port 衝突。

## 分層

- `src/domain/`：純 TypeScript，不可 import React 或 Dexie（ESLint 強制）。業務規則與資料轉換放這裡，並以單元測試涵蓋。
- `src/data/`：Dexie 與 repository；UI 只透過 repository 存取資料。
- 改動資料結構（`Entry`）時：同步更新 Dexie `version`、備份格式的 `BACKUP_VERSION`，並確保舊備份仍可匯入。

## Release

**版本號與 `CHANGELOG.md` 一律由 `npm run release` 產生**（commit-and-tag-version，依 Conventional Commits），不手動改 `package.json` 的 `version` 或 `CHANGELOG.md`；release 會建立 commit 與 tag，只在使用者明確要求時執行。指令見 `README.md`「版本發布」。頁面最下方「關於」顯示的版本號就是 `version`。

## 其他

- GitHub Pages 的 base path 是 `/health-diary/`（`vite.config.ts` 的 `BASE`、`playwright.config.ts` 的 `BASE_PATH`），E2E 的 `page.goto` 用相對路徑（`'./'`），不要以 `/` 開頭。
- 介面文字一律繁體中文。
