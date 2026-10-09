// The workspace pages over odd saved data: a hunt-H4 sweep, kept as a regression test. Projects and jobs are
// written to storage with extreme or hostile values (very long or markup-like text, emoji and right-to-left
// text, __proto__ keys, odd or huge numbers and times, dates at the ends of the calendar, references to parts
// that are gone, a thousand issues) and every page is rendered through the app's own loading and normalising
// (react-dom/server over Vite's loader, as 82-board-pages does). A page that throws is reported with its seed,
// the page and the error; a crash on a saved list put the ErrorBoundary over the whole page for good.
import { before, after, beforeEach, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

const BOARDS_KEY = 'cpwtcv_boards_v2';
const JOBS_KEY = 'cpwtcv_jobs_v1';

let pages;
let boardStore;
let jobStore;
before(async () => {
  await setup();
  const p = async (file, name) => (await loadModule(`/src/pages/${file}.jsx`))[name];
  pages = {
    Boards: await p('Boards', 'Boards'), Board: await p('Board', 'Board'), Backlog: await p('Backlog', 'Backlog'),
    BoardSettings: await p('BoardSettings', 'BoardSettings'), YourWork: await p('YourWork', 'YourWork'),
    ProjectSummary: await p('ProjectSummary', 'ProjectSummary'), ProjectTimeline: await p('ProjectTimeline', 'ProjectTimeline'),
    ProjectCalendar: await p('ProjectCalendar', 'ProjectCalendar'), ProjectList: await p('ProjectList', 'ProjectList'),
    JobTracker: await p('JobTracker', 'JobTracker'), JobDetail: await p('JobDetail', 'JobDetail'), JobForm: await p('JobForm', 'JobForm'),
  };
  boardStore = await loadModule('/src/hooks/useBoardStore.js');
  jobStore = await loadModule('/src/hooks/useJobStore.js');
});
after(teardown);

class Storage {
  constructor(entries = []) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}
beforeEach(() => { boardStore._resetBoardStoreForTest(); jobStore._resetJobStoreForTest(); });
afterEach(() => { delete globalThis.localStorage; delete globalThis.sessionStorage; });

// ── a seeded generator ───────────────────────────────────────────────────────────────────────
function rng(seed) {
  let s = seed >>> 0;
  const next = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const pick = (list) => list[Math.floor(next() * list.length)];
  return { next, pick, int: (n) => Math.floor(next() * n), chance: (p) => next() < p };
}

const TEXTS = [
  '', ' ', 'a', 'Google', 'x'.repeat(3000), '<script>alert(1)</script>', '</p><p>', '<img src=x onerror=alert(1)>', '"quoted" & <b>', '__proto__', 'constructor', 'toString',
  '😀'.repeat(40), 'العربية مع English ‏text', 'é'.repeat(30), '\u0000\u0001', 'line\nbreak', '  padded  ', 'https://example.com/' + 'p'.repeat(500),
  'javascript:alert(1)', '{{x}}', '${x}', '%s %d', 'ß'.repeat(20), '0', '-1', 'NaN', 'null',
];
const DAYS = ['', '2026-10-15', '9999-12-31', '1000-01-01', '2026-02-28', '2024-02-29', '2026-13-01', 'next week', '2026-1-5'];
const NUMS = [0, 1, 1.5, 2, 13, 100, 1e6, 1e15, 8.64e15, -1, 1760000000000];

function board(r, n) {
  const ids = (prefix, count) => Array.from({ length: count }, (_, i) => `${prefix}${i}`);
  const cols = ids('c', 1 + r.int(5));
  const columns = cols.map((id, i) => ({ id, title: r.pick(TEXTS), category: i === cols.length - 1 ? 'done' : r.pick(['todo', 'inprogress', 'done']), wipLimit: r.pick([null, 1, 2, 5, 0]) }));
  const labels = ids('l', r.int(4)).map((id) => ({ id, name: r.pick(TEXTS), color: r.pick(['#fff', '#6b7280', 'red', 'url(javascript:1)']) }));
  const sprints = ids('s', r.int(4)).map((id, i) => ({
    id, name: r.pick(TEXTS), goal: r.pick(TEXTS), state: i === 0 ? r.pick(['active', 'future']) : r.pick(['future', 'closed']), startDate: r.pick(DAYS), endDate: r.pick(DAYS), completedAt: r.pick([null, 1760000000000]),
  }));
  const count = r.chance(0.1) ? 1000 : r.int(40);
  const issues = Array.from({ length: count }, (_, i) => ({
    id: `i${i}`, number: i + 1, type: r.pick(['task', 'bug', 'story', 'epic']), title: r.pick(TEXTS), description: r.pick(['', '<p>hi</p>', ...TEXTS]),
    columnId: r.pick([...cols, 'gone']), priority: r.pick(['highest', 'high', 'medium', 'low', 'lowest']),
    labelIds: r.chance(0.5) ? [r.pick([...ids('l', 4), 'gone'])] : [], due: r.pick(DAYS), startDate: r.pick(DAYS),
    estimate: r.chance(0.3) ? r.pick(NUMS) : null, epicId: r.chance(0.3) ? `i${r.int(Math.max(count, 1))}` : null,
    sprintId: r.chance(0.5) ? r.pick([...ids('s', 4), 'gone']) : null,
    checklist: r.chance(0.2) ? Array.from({ length: r.int(30) }, (_, k) => ({ id: `k${i}-${k}`, text: r.pick(TEXTS), done: r.chance(0.5) })) : [],
    comments: r.chance(0.2) ? Array.from({ length: r.int(20) }, (_, k) => ({ id: `m${i}-${k}`, text: r.pick(TEXTS.filter(Boolean)), createdAt: r.pick(NUMS), editedAt: null })) : [],
    activity: r.chance(0.2) ? Array.from({ length: r.int(30) }, (_, k) => ({ id: `a${i}-${k}`, at: r.pick(NUMS), kind: 'field', field: r.pick(['status', 'title', 'sprint', 'labels', 'x']), from: r.pick([null, 'a', 1]), to: r.pick([null, 'b', 2]) })) : [],
    recurrence: r.pick(['none', 'daily', 'weekly', 'monthly', 'weekdays']), createdAt: r.pick(NUMS), updatedAt: r.pick(NUMS), resolvedAt: r.pick([null, ...NUMS]),
  }));
  return {
    id: `b${n}`, key: r.pick(['ABC', 'PROJ', 'X1']) , title: r.pick(TEXTS), mode: r.pick(['kanban', 'scrum']), color: r.pick(['#6366f1', 'red', '']),
    description: r.pick(TEXTS), starred: r.chance(0.3), columns, labels, sprints, issues, nextNumber: count + 1, hideDoneAfterDays: r.pick([null, 0, 14, 365]),
    createdAt: r.pick(NUMS), updatedAt: r.pick(NUMS), dataVersion: 2,
  };
}

function job(r, n) {
  const j = { id: r.chance(0.9) ? `j${n}` : r.pick(['__proto__', 'constructor', '']) };
  const put = (k, v) => { if (r.chance(0.8)) j[k] = v; };
  put('company', r.pick(TEXTS)); put('role', r.pick(TEXTS)); put('location', r.pick(TEXTS)); put('salary', r.pick([...TEXTS, '$120k–150k', '₹30 LPA', '1,20,000']));
  put('contact', r.pick(TEXTS)); put('notes', r.pick(['', '<p>x</p>', '<ul><li>a</li></ul>', ...TEXTS])); put('url', r.pick(['', 'https://jobs.example.com/1', ...TEXTS]));
  put('appliedDate', r.pick(DAYS)); put('deadline', r.pick(DAYS)); put('followUpDate', r.pick(DAYS)); put('stage', r.pick(TEXTS)); put('resumeId', r.pick(['', 'gone', 'r1']));
  put('status', r.pick(['saved', 'applied', 'phone_screen', 'interview', 'offer', 'rejected', 'withdrawn', 'on_hold', 'ghosted']));
  put('source', r.pick(['linkedin', 'LinkedIn', 'x', ''])); put('workMode', r.pick(['remote', 'onsite', 'x'])); put('excitement', r.pick([0, 3, 9, '4', null]));
  put('todos', Array.from({ length: r.int(8) }, (_, k) => ({ id: `t${k}`, text: r.pick(TEXTS.filter(Boolean)), done: r.chance(0.5), completedAt: r.pick(NUMS) })));
  put('statusHistory', Array.from({ length: r.int(8) }, () => ({ status: r.pick(['saved', 'applied', 'offer', 'rejected', 'zzz']), changedAt: r.pick(NUMS) })));
  put('interviews', Array.from({ length: r.int(4) }, () => ({ date: r.pick(DAYS), time: r.pick(TEXTS), kind: r.pick(TEXTS), notes: r.pick(TEXTS) })));
  put('createdAt', r.pick(NUMS)); put('updatedAt', r.pick(NUMS));
  return j;
}

// ── rendering ────────────────────────────────────────────────────────────────────────────────
const resumes = [{ id: 'r1', name: 'Main CV', kind: 'resume' }, { id: 'l1', name: 'Letter', kind: 'letter' }];
function render(path, routes) {
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] },
    createElement(Routes, null, ...routes.map(([pattern, Page, props]) => createElement(Route, { key: pattern, path: pattern, element: createElement(Page, props) })))));
}
const BOARD_ROUTES = () => [
  ['/boards', pages.Boards], ['/work', pages.YourWork], ['/boards/:id', pages.Board], ['/boards/:id/backlog', pages.Backlog],
  ['/boards/:id/settings', pages.BoardSettings], ['/boards/:id/summary', pages.ProjectSummary], ['/boards/:id/timeline', pages.ProjectTimeline],
  ['/boards/:id/calendar', pages.ProjectCalendar], ['/boards/:id/list', pages.ProjectList],
];
const JOB_ROUTES = () => {
  const props = { store: { appState: { resumes, activeId: 'r1' } } };
  return [['/jobs', pages.JobTracker, props], ['/jobs/new', pages.JobForm, props], ['/jobs/:id/edit', pages.JobForm, props], ['/jobs/:id', pages.JobDetail, props]];
};

/** Run `go()` for each case; the distinct failures, with the first seed that met each. */
function sweep(cases) {
  const seen = new Map();
  for (const [where, go] of cases) {
    try { go(); } catch (e) {
      const key = `${where.split(' ')[0]}: ${e?.message ?? e}`.slice(0, 300);
      if (!seen.has(key)) seen.set(key, where);
    }
  }
  return [...seen].map(([k, w]) => `${k}  (first at ${w})`);
}

it('every project page renders over odd saved projects (a thousand issues, hostile text, dangling references)', () => {
  const cases = [];
  const quiet = console.error;
  for (let seed = 1; seed <= 60; seed += 1) {
    const r = rng(seed * 7919);
    const boards = Array.from({ length: 1 + r.int(3) }, (_, n) => board(r, n));
    const raw = JSON.stringify({ boards, dataVersion: 2 });
    const withProto = r.chance(0.3) ? raw.replace('{"id":"b0"', '{"__proto__":{"polluted":1},"id":"b0"') : raw;
    for (const board0 of boards) {
      for (const [pattern] of BOARD_ROUTES()) {
        if (!pattern.includes(':id')) continue;
        const path = pattern.replace(':id', board0.id);
        cases.push([`seed ${seed} ${path}`, () => {
          boardStore._resetBoardStoreForTest();
          globalThis.localStorage = new Storage([[BOARDS_KEY, withProto]]);
          globalThis.sessionStorage = new Storage();
          boardStore.subscribe(() => {});
          render(path, BOARD_ROUTES());
        }]);
      }
    }
    cases.push([`seed ${seed} /boards`, () => { boardStore._resetBoardStoreForTest(); globalThis.localStorage = new Storage([[BOARDS_KEY, withProto]]); boardStore.subscribe(() => {}); render('/boards', BOARD_ROUTES()); }]);
    cases.push([`seed ${seed} /work`, () => { boardStore._resetBoardStoreForTest(); globalThis.localStorage = new Storage([[BOARDS_KEY, withProto]]); boardStore.subscribe(() => {}); render('/work', BOARD_ROUTES()); }]);
  }
  console.error = () => {};
  let failures;
  try { failures = sweep(cases); } finally { console.error = quiet; }
  assert.deepEqual(failures, [], `${failures.length} page(s) threw`);
  assert.equal({}.polluted, undefined, 'a saved __proto__ key polluted Object.prototype');
});

it('the job pages render over odd saved jobs (hostile text, odd times and days, dangling references)', async () => {
  // The job store has no server snapshot, so these pages are mounted over fake-dom, not rendered to markup.
  const dom = await import('./fake-dom.mjs');
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  const seen = new Map();
  const quiet = console.error;
  console.error = () => {};
  try {
    for (let seed = 1; seed <= 40; seed += 1) {
      const r = rng(seed * 104729);
      const jobs = Array.from({ length: r.int(25) }, (_, n) => job(r, n));
      const raw = JSON.stringify({ jobs, dataVersion: 2 });
      const paths = ['/jobs?view=summary', '/jobs?view=kanban', '/jobs?view=list', '/jobs/new'];
      for (const j of jobs.slice(0, 3)) {
        if (typeof j.id === 'string' && j.id) paths.push(`/jobs/${encodeURIComponent(j.id)}`, `/jobs/${encodeURIComponent(j.id)}/edit`);
      }
      for (const path of paths) {
        jobStore._resetJobStoreForTest();
        globalThis.localStorage = new Storage([[JOBS_KEY, raw]]);
        globalThis.sessionStorage = new Storage();
        let view = null;
        try {
          view = dom.mount(() => createElement(MemoryRouter, { initialEntries: [path] },
            createElement(Routes, null, ...JOB_ROUTES().map(([pattern, Page, props]) => createElement(Route, { key: pattern, path: pattern, element: createElement(Page, props) })))), {});
        } catch (e) {
          const key = `${path.split('?')[0].replace(/\/[^/]*\/(edit)?$/, '/:id/$1')}: ${e?.message ?? e}`.slice(0, 300);
          if (!seen.has(key)) seen.set(key, `seed ${seed} ${path}`);
        }
        if (view) await view.unmount();
        delete globalThis.localStorage;
        delete globalThis.sessionStorage;
      }
    }
  } finally {
    console.error = quiet;
  }
  const failures = [...seen].map(([k, w]) => `${k}  (first at ${w})`);
  assert.deepEqual(failures, [], `${failures.length} page(s) threw`);
  assert.equal({}.polluted, undefined);
});
