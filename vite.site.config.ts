import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 호스팅용 사이트 빌드 (Vercel): index.html + demo/main.tsx를 앱으로 번들해 site/에 냄. npm 라이브러리 빌드는 vite.config.ts
export default defineConfig({
  plugins: [react()],
  optimizeDeps: { exclude: ['@rhwp/core'] },
  build: { outDir: 'site' },
})
