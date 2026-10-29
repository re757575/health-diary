import { useId } from 'react'

/** 頁面最下方的「關於」：目前的 App 版本，回報問題或確認已更新到新版時用 */
export function AboutSection() {
  const id = useId()
  const versionId = useId()
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>關於</h2>
      <dl className="row">
        <dt id={versionId}>版本</dt>
        <dd aria-labelledby={versionId}>v{__APP_VERSION__}</dd>
      </dl>
    </section>
  )
}
