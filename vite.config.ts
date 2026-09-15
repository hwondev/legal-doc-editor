import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// dev: index.html 데모 / build: src를 라이브러리로 번들 (react, tiptap은 외부 의존성)
export default defineConfig({
  plugins: [react()],
  // wasm-bindgen 패키지는 사전 번들링하면 import.meta.url 기준 WASM 경로를 잃음 (데모 dev 서버용)
  optimizeDeps: { exclude: ['@rhwp/core'] },
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index', cssFileName: 'style' },
    rollupOptions: { external: [/^react($|\/)/, /^react-dom($|\/)/, /^@tiptap\//, 'docx', 'mammoth', 'hwp-convert', '@rhwp/core', '@file-viewer/doc'] },
  },
})
