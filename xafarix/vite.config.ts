import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const stub = fileURLToPath(new URL('./src/pdf/unused-dep-stub.ts', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // See src/pdf/unused-dep-stub.ts — jsPDF's .html() deps, which this app
      // never calls, are excluded to keep the export chunk small.
      html2canvas: stub,
      dompurify: stub,
    },
  },
  build: { outDir: 'dist' },
})
