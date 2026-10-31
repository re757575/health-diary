import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// build 時由 vite-plugin-pwa 依 public/favicon.svg 產生 App 圖示並寫入 manifest 與 <head>
// maskable（Android）與 apple-touch-icon（iOS）會被裁成圓形或圓角方形，背景補上圖示的底色，
// 不要留白邊；愛心在中央 80% 的安全範圍內，裁切後仍完整
const background = '#0ca678'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background } },
  },
  images: ['public/favicon.svg'],
})
