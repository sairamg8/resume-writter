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
  // The PDF worker (src/utils/pdfWorker.js, R2-142): an ES module worker, so the templates it builds
  // with stay code-split as they are on the main thread, and JSX compiled as the app's is.
  worker: {
    format: 'es',
    plugins: () => [react()],
  },
  build: {
    // Only the PDF engine is past the default 500 kB: react-pdf in the PDF worker (pdfWorker-*.js) and,
    // for a browser with no worker, on the main thread (react-pdf-*.js) — one library, loaded only when a
    // PDF is built, never at start-up. The start-up path has its own budget in 71-startup-chunks.
    chunkSizeWarningLimit: 1600,
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
            // Firestore and the rest of Firebase (app, auth) apart: one 530 kB chunk was over the
            // build's 500 kB warning, and the two load side by side (R2-142, PERF-5).
            { name: 'firestore', test: /node_modules[\\/](@firebase[\\/](firestore|webchannel-wrapper)|firebase[\\/]firestore)[\\/]/, priority: 11 },
            { name: 'firebase', test: /node_modules[\\/](firebase|@firebase)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
})
