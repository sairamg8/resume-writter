// The performance harness's pure part (R2-142, PERF-1): what a budget is, how a measurement is held
// to it, what the start-up path of a build weighs, and how a run prints. No clocks of its own, no
// files, no browser and no app code, so tests/unit/perf-budget-check.unit.mjs pins all of it; run.mjs
// only measures and hands the numbers here. The budgets themselves are written in budgets.mjs.

/** The groups of budgets, in the order a run prints them: the runner measures a group at a time. */
export const GROUPS = ['render', 'keystroke', 'startup', 'browser'];
/** What a run measures without --only: the browser group needs a built ./dist and Chromium. */
export const DEFAULT_GROUPS = ['render', 'keystroke', 'startup'];
/** The units a budget is written in. `ms` scales with --slack; sizes and counts do not (they do not vary by machine). */
export const UNITS = ['ms', 'kB', 'count'];

/** A row in these statuses fails the run. */
const FAILING = new Set(['over', 'under', 'missing', 'unbudgeted']);

// ── Statistics ───────────────────────────────────────────────────────────────

/** The middle of `values` (the mean of the two middle ones for an even count); NaN for none. Not sorted in place. */
export function median(values) {
  const xs = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!xs.length) return NaN;
  const mid = xs.length >> 1;
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

/** "median of 7 (min 51, max 88)" for a note beside a timing. */
export function spread(samples, unit = 'ms') {
  const xs = samples.filter(Number.isFinite);
  if (!xs.length) return 'no samples';
  return `median of ${xs.length} (min ${formatValue(Math.min(...xs), unit)}, max ${formatValue(Math.max(...xs), unit)})`;
}

/**
 * Time `fn` (sync or async): `warmups` runs nobody sees — the first render loads fonts and the template
 * chunk — then `runs` timed ones, in ms. `fn` gets the run's index (negative for a warm-up). `now` is
 * injectable so a test can pass a clock it controls.
 */
export async function sample(fn, { runs = 7, warmups = 2, now = () => performance.now() } = {}) {
  for (let i = 0; i < warmups; i += 1) await fn(-1 - i);
  const times = [];
  for (let i = 0; i < runs; i += 1) {
    const started = now();
    await fn(i);
    times.push(now() - started);
  }
  return times;
}

// ── Budgets ──────────────────────────────────────────────────────────────────

/**
 * What is wrong with a budget list, as messages (none: it is well formed). A budget is
 * `{ id, group, label, unit, max | min, target?, note? }`: exactly one of `max` (a ceiling) or `min`
 * (a floor, for a guard such as "the fixture is at least three pages"); `target` is the figure the
 * plan sets for a quiet machine (--strict holds a run to it) and is never above `max`.
 */
export function validateBudgets(budgets) {
  const problems = [];
  const seen = new Set();
  for (const b of budgets) {
    const at = `budget ${JSON.stringify(b?.id)}`;
    if (typeof b?.id !== 'string' || !b.id) { problems.push(`${at}: needs an id`); continue; }
    if (seen.has(b.id)) problems.push(`${at}: id used twice`);
    seen.add(b.id);
    if (!GROUPS.includes(b.group)) problems.push(`${at}: group ${JSON.stringify(b.group)} is not one of ${GROUPS.join(', ')}`);
    if (typeof b.label !== 'string' || !b.label) problems.push(`${at}: needs a label`);
    if (!UNITS.includes(b.unit)) problems.push(`${at}: unit ${JSON.stringify(b.unit)} is not one of ${UNITS.join(', ')}`);
    const limits = ['max', 'min'].filter((k) => b[k] !== undefined);
    if (limits.length !== 1) problems.push(`${at}: needs exactly one of max or min`);
    for (const k of [...limits, ...(b.target === undefined ? [] : ['target'])]) {
      if (!Number.isFinite(b[k]) || b[k] < 0) problems.push(`${at}: ${k} must be a number, zero or more`);
    }
    if (b.target !== undefined && (b.max === undefined || b.target > b.max)) problems.push(`${at}: target needs a max, and is not above it`);
  }
  return problems;
}

/**
 * The number a budget holds a measurement to. A floor is as written. A ceiling is `max`, or in `strict`
 * mode the plan's `target` where the budget has one; a timing's ceiling is then scaled by `slack` (a slow
 * or shared machine: --slack=2 allows twice the time), a size's or a count's never is.
 */
export function limitOf(budget, { strict = false, slack = 1 } = {}) {
  if (budget.min !== undefined) return budget.min;
  const ceiling = strict && budget.target !== undefined ? budget.target : budget.max;
  return budget.unit === 'ms' ? ceiling * slack : ceiling;
}

/**
 * Hold `measured` — `{ [budget id]: number | { value, detail? } }` — to `budgets`. One row per budget, in
 * order, then one per measurement that has no budget (a number nobody wrote a limit for fails, so the
 * budgets cannot fall behind the harness). A budget in a group that was not run is `skipped`; one in a
 * group that was run but has no measurement is `missing`, and fails. `ok` is true when no row failed.
 */
export function checkBudgets(measured, budgets, { strict = false, slack = 1, groups = null } = {}) {
  const valueOf = (m) => (typeof m === 'number' ? m : m?.value);
  const rows = budgets.map((b) => {
    const kind = b.min === undefined ? 'max' : 'min';
    const row = { id: b.id, group: b.group, label: b.label, unit: b.unit, kind, limit: limitOf(b, { strict, slack }), value: null, detail: null };
    if (groups && !groups.includes(b.group)) return { ...row, status: 'skipped' };
    const value = valueOf(measured[b.id]);
    if (!Number.isFinite(value)) return { ...row, status: 'missing' };
    const met = kind === 'max' ? value <= row.limit : value >= row.limit;
    const status = met ? 'ok' : kind === 'max' ? 'over' : 'under';
    return { ...row, value, detail: measured[b.id]?.detail ?? null, status };
  });
  const known = new Set(budgets.map((b) => b.id));
  for (const id of Object.keys(measured)) {
    if (known.has(id)) continue;
    const value = valueOf(measured[id]);
    rows.push({ id, group: null, label: id, unit: '', kind: 'max', limit: null, value: Number.isFinite(value) ? value : null, detail: null, status: 'unbudgeted' });
  }
  const failed = rows.filter((r) => FAILING.has(r.status));
  return { rows, failed, ok: failed.length === 0 };
}

// ── Printing ─────────────────────────────────────────────────────────────────

/** 1234.56 ms → "1,235 ms"; 61.24 ms → "61.2 ms"; a count has no unit. */
export function formatValue(value, unit) {
  if (!Number.isFinite(value)) return '-';
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  const [whole, fraction] = String(rounded).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? `.${fraction}` : '');
  return unit && unit !== 'count' ? `${grouped} ${unit}` : grouped;
}

const STATUS_TEXT = { ok: 'ok', over: 'OVER', under: 'UNDER', skipped: 'skipped', missing: 'MISSING', unbudgeted: 'NO BUDGET' };

/** The table a run prints: one line per budget, the notes under it, and a line saying whether the run passed. */
export function formatTable({ rows, failed, ok }, { strict = false, slack = 1 } = {}) {
  const cells = rows.map((r) => [
    r.label,
    r.status === 'skipped' ? '' : formatValue(r.value, r.unit),
    r.limit === null ? '' : `${r.kind === 'max' ? '<=' : '>='} ${formatValue(r.limit, r.unit)}`,
    STATUS_TEXT[r.status] ?? r.status,
  ]);
  const head = ['Budget', 'Measured', 'Limit', 'Status'];
  const widths = head.map((h, c) => Math.max(h.length, ...cells.map((row) => row[c].length)));
  const line = (row) => row.map((cell, c) => (c === 0 || c === 3 ? cell.padEnd(widths[c]) : cell.padStart(widths[c]))).join('  ').trimEnd();
  const out = [line(head), widths.map((w) => '-'.repeat(w)).join('  '), ...cells.map(line)];
  const notes = rows.filter((r) => r.detail).map((r) => `  ${r.label}: ${r.detail}`);
  if (notes.length) out.push('', ...notes);
  const ran = rows.filter((r) => r.status !== 'skipped').length;
  const mode = `${strict ? 'strict (the plan\'s targets)' : 'CI ceilings'}${slack === 1 ? '' : `, timings x${slack}`}`;
  out.push('', ok
    ? `PASS: ${ran - failed.length} of ${ran} budgets met (${mode}).`
    : `FAIL: ${failed.length} of ${ran} budgets not met (${mode}): ${failed.map((r) => r.id).join(', ')}.`);
  return out.join('\n');
}

// ── Options ──────────────────────────────────────────────────────────────────

export const HELP = `Performance budgets: measures the app's key costs and holds them to tests/perf/budgets.mjs.

  node tests/perf/run.mjs [options]        (yarn test:perf)

  --only=render,keystroke,startup,browser   the groups to measure ("all": every one). Default:
                                            render,keystroke,startup. browser needs a built ./dist
                                            (yarn build) and Chromium (npx playwright install chromium)
  --strict                                  hold timings to the plan's targets (a quiet machine) instead
                                            of the CI ceilings; also PERF_STRICT=1
  --slack=N                                 multiply every timing ceiling by N (a slow machine); also PERF_SLACK=N
  --runs=N  --warmups=N                     timed runs per timing (default 7) and warm-ups before them (2)
  --dist=DIR                                the build the browser group serves (default dist)
  --json                                    print the result as JSON instead of the table

Exit code: 0 all budgets met, 1 a budget missed, 2 the harness itself failed.`;

/** The options of a run from its arguments and environment; throws an Error naming what it does not understand. */
export function parseArgs(argv = [], env = {}) {
  const opts = { groups: [...DEFAULT_GROUPS], strict: env.PERF_STRICT === '1', slack: 1, runs: 7, warmups: 2, dist: 'dist', json: false, help: false };
  const number = (name, raw, { min, max, integer = false }) => {
    const n = Number(raw);
    if (raw === '' || !Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
      throw new Error(`${name} needs ${integer ? 'a whole number' : 'a number'} from ${min} to ${max}, not ${JSON.stringify(raw)}`);
    }
    return n;
  };
  if (env.PERF_SLACK !== undefined && env.PERF_SLACK !== '') opts.slack = number('PERF_SLACK', env.PERF_SLACK, { min: 0.1, max: 100 });
  for (const arg of argv) {
    const [flag, ...rest] = arg.split('=');
    const value = rest.join('=');
    if (flag === '--help' || flag === '-h') opts.help = true;
    else if (flag === '--strict') opts.strict = true;
    else if (flag === '--json') opts.json = true;
    else if (flag === '--only') {
      const names = value === 'all' ? GROUPS : value.split(',').filter(Boolean);
      const unknown = names.filter((n) => !GROUPS.includes(n));
      if (!names.length || unknown.length) throw new Error(`--only needs some of ${GROUPS.join(', ')} (or all), not ${JSON.stringify(unknown.length ? unknown.join(',') : value)}`);
      opts.groups = GROUPS.filter((g) => names.includes(g));
    } else if (flag === '--slack') opts.slack = number('--slack', value, { min: 0.1, max: 100 });
    else if (flag === '--runs') opts.runs = number('--runs', value, { min: 1, max: 99, integer: true });
    else if (flag === '--warmups') opts.warmups = number('--warmups', value, { min: 0, max: 20, integer: true });
    else if (flag === '--dist') {
      if (!value) throw new Error('--dist needs a folder');
      opts.dist = value;
    } else throw new Error(`Unknown option ${JSON.stringify(arg)} (--help lists them)`);
  }
  return opts;
}

// ── The start-up path of a build ─────────────────────────────────────────────

/** Libraries only a dynamic import() may reach: the PDF engine, the preview's pdf.js and the Word writer (71-startup-chunks). */
export const LAZY_LIBS = /node_modules[\\/](@react-pdf|pdfkit|fontkit|yoga-layout|pdfjs-dist|docx|jszip|pizzip)[\\/]/;

/** The `<script src>` and `<link href>` .js files an index.html loads (its entry and its modulepreloads), without the leading slash. */
export function loadedByHtml(html) {
  return [...String(html).matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="\/?([^"]+\.js)"/g)].map((m) => m[1]);
}

/**
 * What the browser downloads before the first paint: every entry chunk and each chunk it imports
 * statically, transitively, plus the files index.html loads (they are fetched whether or not the entry
 * imports them). `chunks`: a build's output chunks, `{ fileName, isEntry, imports, moduleIds }`; `size` and
 * `gzipSize` take a chunk and give its bytes. Returns the chunk names and, in kB, the raw and gzipped
 * weight, the largest chunk, and how many modules of a library only a dynamic import may reach are on
 * the path (none: 71-startup-chunks).
 */
export function startupPath(chunks, { html = '', size, gzipSize }) {
  const byName = new Map(chunks.map((c) => [c.fileName, c]));
  const seen = new Set();
  const stack = [...chunks.filter((c) => c.isEntry).map((c) => c.fileName), ...loadedByHtml(html)];
  while (stack.length) {
    const name = stack.pop();
    if (seen.has(name) || !byName.has(name)) continue;
    seen.add(name);
    stack.push(...(byName.get(name).imports ?? []));
  }
  const names = [...seen].sort();
  const KB = 1024;
  const sizes = names.map((n) => size(byName.get(n)));
  return {
    names,
    rawKb: sizes.reduce((sum, n) => sum + n, 0) / KB,
    gzipKb: names.reduce((sum, n) => sum + gzipSize(byName.get(n)), 0) / KB,
    largestKb: Math.max(0, ...sizes) / KB,
    lazyModules: names.reduce((sum, n) => sum + (byName.get(n).moduleIds ?? []).filter((id) => LAZY_LIBS.test(id)).length, 0),
  };
}
