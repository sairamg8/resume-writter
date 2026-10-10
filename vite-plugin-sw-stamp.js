// Stamps the build into public/sw.js. The service worker names its cache after the build
// (`cpwtcv-shell-<id>`), so every deploy is a worker whose bytes differ — the browser installs it — and its
// activation deletes the cache of the build before. The id is a hash of the build's file names (they carry
// their content's hash) and of index.html, so it changes whenever any file the site serves from the build does.
// Vite copies public/sw.js to the output as it is; this rewrites that copy once the bundle is written. A build
// that writes nothing (the node tests build with `write: false`) is left alone.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/** The line of public/sw.js that carries the build. */
export const BUILD_LINE = "var BUILD = '__BUILD_ID__';"

/** A short id for a build: `fileNames` (the bundle's) and the page's source. */
export function buildId(fileNames, html = '') {
  return createHash('sha256').update([...fileNames].sort().join('\n')).update('\0').update(String(html)).digest('hex').slice(0, 10)
}

/** `source` (sw.js) with `id` as its build; throws if the line is not there, so the stamp cannot silently stop. */
export function stampWorker(source, id) {
  if (!source.includes(BUILD_LINE)) throw new Error('public/sw.js has no `' + BUILD_LINE + '` line to stamp')
  return source.replace(BUILD_LINE, "var BUILD = '" + id + "';")
}

export function swStamp() {
  let config
  let id = null
  return {
    name: 'cpwtcv-sw-stamp',
    apply: 'build',
    enforce: 'post',
    configResolved(resolved) { config = resolved },
    generateBundle(_, bundle) {
      const page = bundle['index.html']
      const html = page ? (typeof page.source === 'string' ? page.source : Buffer.from(page.source).toString()) : ''
      id = buildId(Object.keys(bundle), html)
    },
    closeBundle() {
      if (!config || config.build.write === false || !id) return
      const file = path.resolve(config.root, config.build.outDir, 'sw.js')
      if (!fs.existsSync(file)) return
      fs.writeFileSync(file, stampWorker(fs.readFileSync(file, 'utf8'), id))
    },
  }
}
