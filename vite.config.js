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
    rolldownOptions: {
      output: {
        // Named vendor chunks (R2-014). Rolldown pulls a group's dependencies into its chunk, so the
        // old manualChunks put React inside react-pdf-*.js: the entry imported React from there and
        // every page — the Dashboard, #/terms — downloaded the 1.4 MB PDF engine before its first
        // paint. React gets its own group, claimed first; the others only name libraries that
        // nothing on the start-up path imports (react-pdf, docx) or that it needs anyway (firebase).
        // tests/pdf/71-startup-chunks.test.mjs builds and walks the start-up path.
        codeSplitting: {
          groups: [
            // react-dom's own scheduler is nested under it; the top-level one is react-pdf's reconciler's.
            { name: 'react', test: /node_modules[\\/](react|react-dom)[\\/]/, priority: 30 },
            { name: 'react-pdf', test: /node_modules[\\/](@react-pdf|fontkit|yoga-layout)[\\/]/, priority: 20 },
            { name: 'docx', test: /node_modules[\\/](docx|pizzip|jszip)[\\/]/, priority: 10 },
            { name: 'firebase', test: /node_modules[\\/](firebase|@firebase)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
})
