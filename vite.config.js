import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { ownerResume } from './vite-plugin-owner-resume.js'

export default defineConfig({
  // ownerResume: the owner's git-ignored résumé on the dev server only; null in every build.
  plugins: [react(), tailwindcss(), ownerResume()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Not app source: scratch renders, gate exports, cloned tools and agent worktrees. Watching them used up the
    // system's inotify watches (ENOSPC) and crashed `yarn dev`.
    watch: { ignored: ['**/qa-visual-compare/**', '**/.claude/**', '**/graphify-out/**', '**/dist/**'] },
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
