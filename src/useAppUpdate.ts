import { useCallback } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** 背景時每隔多久檢查一次新版；主要靠回到前景時檢查，這是 App 一直開著時的備援 */
const CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * 註冊 service worker 並追蹤新版本。
 * 安裝成 App 後常整天留在背景、不會重新載入，瀏覽器也就不會去檢查新版，
 * 所以回到前景時（以及每小時）主動檢查。新版裝好後先等待，由呼叫端決定何時套用
 */
export function useAppUpdate() {
  const {
    needRefresh: [updateReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // 離線時檢查會失敗，忽略即可，下次再檢查
      const check = () => void registration.update().catch(() => {})
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      setInterval(check, CHECK_INTERVAL_MS)
    },
  })

  /** 讓等待中的新版接手並重新載入頁面 */
  const applyUpdate = useCallback(() => {
    // workbox-window 只在「這次開啟時已有舊版在控制頁面」才會自己重新載入；
    // 第一次安裝的那次開啟中又遇到新版時不會，新版接手了畫面卻還是舊的，所以自己監聽
    navigator.serviceWorker?.addEventListener('controllerchange', () => window.location.reload(), {
      once: true,
    })
    void updateServiceWorker()
  }, [updateServiceWorker])

  return { updateReady, applyUpdate }
}
