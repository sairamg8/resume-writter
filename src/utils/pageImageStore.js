// Where the page pictures (pageImage.js) are kept, and the one queue that paints them. A picture is a
// full react-pdf render: they are painted one at a time, only for a card someone can see, and each is
// painted once — kept in memory for the session, and a résumé's own dashboard picture (C1) in its own
// storage key as well, so the dashboard does not repaint every card on every visit.
//
// That key is never synced and never part of the store: a résumé syncs as a document capped at 1 MiB
// (cloudSyncHeld.js), and the store is written on every keystroke. It is a cache: the first thing a
// full storage drops (setItemWithRoom), and it holds only the résumés the store holds — each store
// write prunes it (keepPageImagesOf), so a list that leaves this browser with its account (R2-005)
// takes its pictures with it.
import { printedKey } from './pageFit.js';
import { PAGE_IMAGES_KEY } from './storageBackup.js';
const MEMORY_KEPT = 80;
const SAVED_KEPT = 24;
const GAP_MS = 120; // between two paints: the editor stays responsive while a gallery fills

/**
 * A short fingerprint of what `resume` prints (printedKey, and a letter's text): a picture is stale once
 * it changes.
 */
export function printHash(resume) {
  const text = `${printedKey(resume)}|${JSON.stringify([resume?.kind ?? null, resume?.coverLetter ?? null])}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(36)}.${text.length.toString(36)}`;
}

// ── In memory ────────────────────────────────────────────────────────────

const memory = new Map(); // key → data URL, oldest first

/** The picture painted for `key` this session, or null. */
export const pictureFor = (key) => memory.get(key) ?? null;

function remember(key, url) {
  memory.delete(key);
  memory.set(key, url);
  while (memory.size > MEMORY_KEPT) memory.delete(memory.keys().next().value);
}

// ── The queue ────────────────────────────────────────────────────────────

const queue = []; // { key, make, waiting: Set<fn> }
const inFlight = new Map(); // key → its job, queued or painting
let busy = false;

async function drain() {
  if (busy) return;
  busy = true;
  try {
    while (queue.length) {
      const job = queue.shift();
      if (!job.waiting.size) { inFlight.delete(job.key); continue; }
      let url = null;
      try { url = await job.make(); } catch { url = null; }
      inFlight.delete(job.key);
      if (url) remember(job.key, url);
      for (const done of job.waiting) done(url);
      if (queue.length) await new Promise((r) => { setTimeout(r, GAP_MS); });
    }
  } finally { busy = false; }
}

/**
 * Paint `key` with `make()` (a promise of a data URL) after the paints asked for before it, and call
 * `done(url)` — null when it failed. One paint per key, however many cards ask. Returns a cancel: a card
 * gone before its turn is not painted for.
 */
export function requestPicture(key, make, done) {
  const known = pictureFor(key);
  if (known) { done(known); return () => {}; }
  let job = inFlight.get(key);
  if (!job) {
    job = { key, make, waiting: new Set() };
    inFlight.set(key, job);
    queue.push(job);
  }
  job.waiting.add(done);
  drain();
  return () => { job.waiting.delete(done); };
}

// ── A résumé's dashboard picture, kept across visits (C1) ────────────────

// What is saved, read from storage once and then kept here: the dashboard asks on every render, and
// the store's every write (keepPageImagesOf).
let saved = null;

function readSaved() {
  if (saved) return saved;
  try {
    saved = JSON.parse(localStorage.getItem(PAGE_IMAGES_KEY) || '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  } catch { saved = {}; }
  return saved;
}

function writeSaved(next) {
  saved = next;
  try {
    if (Object.keys(next).length) localStorage.setItem(PAGE_IMAGES_KEY, JSON.stringify(next));
    else localStorage.removeItem(PAGE_IMAGES_KEY);
  } catch { /* a cache: a picture that does not fit is painted again next visit */ }
}

/** Résumé `id`'s saved picture while it still prints `hash` (printHash), else null. */
export function savedPicture(id, hash) {
  const e = readSaved()[id];
  return e && e.h === hash && typeof e.url === 'string' ? e.url : null;
}

/** Keep `url` as résumé `id`'s picture at `hash`; the least recently painted go past SAVED_KEPT. */
export function savePicture(id, hash, url) {
  const next = { ...readSaved(), [id]: { h: hash, url, t: Date.now() } };
  // The one just painted first: several painted in one millisecond tie on `t`.
  const ids = [id, ...Object.keys(next).filter((k) => k !== id).sort((a, b) => (next[b].t || 0) - (next[a].t || 0))];
  writeSaved(Object.fromEntries(ids.slice(0, SAVED_KEPT).map((k) => [k, next[k]])));
}

/** For tests: read storage again on the next ask. */
export function _forgetSavedForTest() { saved = null; }

/** Only the pictures of `resumes` stay: the rest were of résumés this browser no longer holds. */
export function keepPageImagesOf(resumes) {
  const ids = new Set((resumes || []).map((r) => r?.id));
  const all = readSaved();
  if (Object.keys(all).every((id) => ids.has(id))) return;
  writeSaved(Object.fromEntries(Object.entries(all).filter(([id]) => ids.has(id))));
}
