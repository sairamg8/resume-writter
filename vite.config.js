import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@react-pdf/renderer') || id.includes('pdfkit') || id.includes('fontkit')) {
            return 'react-pdf';
          }
          if (id.includes('docx') || id.includes('pizzip') || id.includes('jszip')) {
            return 'docx';
          }
          if (id.includes('firebase')) {
            return 'firebase';
          }
        },
      },
    },
  },
})
