import { defineConfig } from 'cypress';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractPdfTextRuns } from './tests/pdf-utils.js';

const DOWNLOADS = 'cypress/downloads';

/**
 * Text of one entry in a zip archive (a .docx is a zip), located through the central
 * directory so data-descriptor entries with zeroed local sizes still read correctly.
 */
function readZipEntry(buffer, name) {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('not a zip archive');
  const count = buffer.readUInt16LE(eocd + 10);
  let p = buffer.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i += 1) {
    const method = buffer.readUInt16LE(p + 10);
    const size = buffer.readUInt32LE(p + 20);
    const nameLen = buffer.readUInt16LE(p + 28);
    const extraLen = buffer.readUInt16LE(p + 30);
    const commentLen = buffer.readUInt16LE(p + 32);
    const local = buffer.readUInt32LE(p + 42);
    if (buffer.toString('utf8', p + 46, p + 46 + nameLen) === name) {
      const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
      const data = buffer.subarray(start, start + size);
      return (method === 8 ? zlib.inflateRawSync(data) : data).toString('utf8');
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

/** Newest finished file in the downloads folder with the given extension, or null. */
function newestDownload(ext) {
  if (!fs.existsSync(DOWNLOADS)) return null;
  const files = fs.readdirSync(DOWNLOADS)
    .filter((f) => f.endsWith(ext))
    .map((f) => ({ f, t: fs.statSync(path.join(DOWNLOADS, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return files[0] ? path.join(DOWNLOADS, files[0].f) : null;
}

export default defineConfig({
  e2e: {
    // `yarn test:e2e` builds + serves the app on 4173; override with CYPRESS_BASE_URL.
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://127.0.0.1:4173',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    viewportWidth: 1440,
    viewportHeight: 900,
    defaultCommandTimeout: 10_000,
    downloadsFolder: DOWNLOADS,
    trashAssetsBeforeRuns: true,
    video: false,
    retries: { runMode: 1, openMode: 0 },
    setupNodeEvents(on, config) {
      on('task', {
        clearDownloads() {
          fs.rmSync(DOWNLOADS, { recursive: true, force: true });
          fs.mkdirSync(DOWNLOADS, { recursive: true });
          return null;
        },
        /** Poll until a download with `ext` exists and its size is stable. */
        async waitForDownload({ ext = '.pdf', timeoutMs = 45_000 } = {}) {
          const start = Date.now();
          let last = -1;
          while (Date.now() - start < timeoutMs) {
            const file = newestDownload(ext);
            if (file) {
              const size = fs.statSync(file).size;
              if (size > 0 && size === last) return file;
              last = size;
            }
            await new Promise((r) => setTimeout(r, 250));
          }
          return null;
        },
        /** Page count, text runs ({ page, str, x, y, fontSize, colorHex }) and document info. */
        async readPdf(file) {
          const buffer = fs.readFileSync(file);
          const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false }).promise;
          const { info } = await doc.getMetadata();
          const page1 = await doc.getPage(1);
          const [, , width, height] = page1.view;
          const runs = await extractPdfTextRuns(buffer);
          return { numPages: doc.numPages, width, height, info, runs, bytes: buffer.length };
        },
        /** Paragraph texts of a .docx (word/document.xml), plus the file size. */
        readDocx(file) {
          const buffer = fs.readFileSync(file);
          const xml = readZipEntry(buffer, 'word/document.xml') || '';
          const paragraphs = xml.split('</w:p>').map((p) =>
            [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')
              .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"))
            .filter(Boolean);
          return { bytes: buffer.length, paragraphs };
        },
        readTextFile(file) {
          return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
        },
      });
      return config;
    },
  },
});
