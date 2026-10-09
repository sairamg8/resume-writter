import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ExternalLink, Map as MapIcon, Upload } from 'lucide-react';
import { useJobMapAccess } from '@/hooks/useJobMapAccess';
import AppBar from '@/components/AppBar';
import AuthBar from '@/components/AuthBar';
import BottomTabBar from '@/components/BottomTabBar';
import { Button, Select } from '@/components/ui';
import { controlClass } from '@/components/ui/Field.jsx';
import { ROW, FUNCTION_LABELS, checkData, filterRows, filtersFor, distinct, roleHref, startCountry } from '@/utils/jobMapData';

/**
 * The account menu's Job Map item (AuthBar loads this page's code only when the menu opens, so the page and the item
 * are ONE chunk and one start-up import map entry): shown once the server lets the account use the Job Map.
 */
export function JobMapMenuItem({ user, onPick, className = 'w-full flex items-center gap-2.5 h-9 px-3 rounded-lg text-sm font-semibold text-cv-ink hover:bg-cv-sunken transition-colors' }) {
  const allowed = useJobMapAccess(user);
  if (allowed !== true) return null;
  return (
    <Link to="/job-map" onClick={onPick} className={className}>
      <MapIcon size={16} aria-hidden="true" /> Job Map
    </Link>
  );
}

const SHOWN = 100;
const LOADING = 'min-h-screen bg-cv-ground flex items-center justify-center text-sm text-cv-faint';

/**
 * The page when the access check itself failed (offline, unavailable): nothing is known about the account, so it is
 * neither sent to the Dashboard nor shown the data. A clean refusal still redirects.
 */
export function JobMapAccessFailed({ auth, sync, onRetry }) {
  return (
    <div className="min-h-screen bg-cv-ground text-cv-body pb-20 md:pb-0">
      <AppBar active={null} account={<AuthBar {...auth} {...sync} compact />} />
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
        <h1 className="text-2xl font-bold text-cv-ink mb-4">Job Map</h1>
        <p className="text-sm text-cv-muted mb-3">Could not check whether this account can use the Job Map. Check your connection and try again.</p>
        <Button variant="primary" onClick={onRetry}>Retry</Button>
      </main>
      <BottomTabBar />
    </div>
  );
}

/** Open roles across companies and countries, for the accounts the owner allowed (firestore.rules). Its data is loaded from the account, never shipped in the app. */
export default function JobMap({ auth, sync }) {
  const [attempt, setAttempt] = useState(0);
  const allowed = useJobMapAccess(auth.user, attempt);
  const [meta, setMeta] = useState(null);       // null: not asked yet; false: nothing loaded
  // The country picked in the select; until one is (or when the data no longer has it) the page starts on the data's own.
  const [picked, setPicked] = useState(null);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [f, setF] = useState({ fn: '', level: '', track: '', q: '' });
  const [more, setMore] = useState(SHOWN);
  const file = useRef(null);

  async function refresh() {
    const io = await import('@/utils/jobMapIo');
    setMeta((await io.loadMeta()) || false);
  }
  const country = picked && meta?.counts?.[picked] ? picked : startCountry(meta?.counts);
  useEffect(() => { if (allowed === true) refresh().catch((e) => setStatus(e.message)); }, [allowed]);
  useEffect(() => {
    if (!meta || !meta.counts[country]) { setRows([]); return undefined; }
    let live = true;
    setStatus('Loading…');
    import('@/utils/jobMapIo').then((io) => io.loadCountry(country, meta.counts[country])).then(
      (r) => { if (live) { setRows(r); setStatus(''); setMore(SHOWN); } },
      (e) => { if (live) setStatus(e.message); },
    );
    return () => { live = false; };
  }, [meta, country]);

  const companies = meta?.companies ?? [];
  const active = useMemo(() => filtersFor(rows, f), [rows, f]); // what the selects show, and what filters
  const shown = useMemo(() => filterRows(rows, companies, active), [rows, companies, active]);
  if (auth.authLoading) return <div className={LOADING}>Loading…</div>;
  if (!auth.user || allowed === false) return <Navigate to="/" replace />;
  if (allowed === null) return <div className={LOADING}>Loading…</div>;
  if (allowed === 'failed') return <JobMapAccessFailed auth={auth} sync={sync} onRetry={() => setAttempt((n) => n + 1)} />;

  async function onFile(e) {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    try {
      const data = JSON.parse(await picked.text());
      const bad = checkData(data);
      if (bad) { setStatus(bad); return; }
      const io = await import('@/utils/jobMapIo');
      await io.saveData(data, (d, t) => setStatus(`Saving ${d} of ${t}…`));
      setStatus('Saved.');
      await refresh();
    } catch (err) { setStatus(err.message); }
  }

  const countries = Object.entries(meta?.counts ?? {}).sort((a, b) => b[1] - a[1]);
  const set = (k) => (e) => { setF((o) => ({ ...o, [k]: e.target.value })); setMore(SHOWN); };

  return (
    <div className="min-h-screen bg-cv-ground text-cv-body pb-20 md:pb-0">
      <AppBar active={null} account={<AuthBar {...auth} {...sync} compact />} />
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold text-cv-ink flex-1">Job Map</h1>
          <Button size="sm" leftIcon={Upload} onClick={() => file.current?.click()}>Load data file</Button>
          <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
        </div>
        {status && <p className="text-xs text-cv-muted mb-3">{status}</p>}
        {meta === false && <p className="text-sm text-cv-muted">No data yet. Build it with the job-map tool (<code>node build-data.mjs</code>) and choose jobmap-data.json above.</p>}
        {meta && (
          <>
            <p className="text-xs text-cv-muted mb-3">{companies.length} companies · crawled {meta.crawled}</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
              <Select size="sm" value={country} onChange={(e) => setPicked(e.target.value)} aria-label="Country" className="min-w-0">
                {countries.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
              </Select>
              <Select size="sm" value={active.fn} onChange={set('fn')} aria-label="Function" className="min-w-0">
                <option value="">Any function</option>
                {distinct(rows, ROW.fn).map((v) => <option key={v} value={v}>{FUNCTION_LABELS[v] ?? v}</option>)}
              </Select>
              <Select size="sm" value={active.level} onChange={set('level')} aria-label="Level" className="min-w-0">
                <option value="">Any level</option>
                {distinct(rows, ROW.level).map((v) => <option key={v} value={v}>{v}</option>)}
              </Select>
              <Select size="sm" value={active.track} onChange={set('track')} aria-label="Stack" className="min-w-0">
                <option value="">Any stack</option>
                {distinct(rows, ROW.track).map((v) => <option key={v} value={v}>{v}</option>)}
              </Select>
              <input value={f.q} onChange={set('q')} placeholder="Search title, company, place" className={`${controlClass({ size: 'sm' })} h-8 pointer-coarse:h-11 px-3 min-w-0 col-span-2 sm:col-span-1`} aria-label="Search" />
            </div>
            <p className="text-xs text-cv-muted mb-2">{shown.length} roles</p>
            <ul className="space-y-1.5">
              {shown.slice(0, more).map((r, i) => (
                <li key={`${r[ROW.url]}-${i}`}>
                  <a href={roleHref(r[ROW.url]) || undefined} target="_blank" rel="noopener noreferrer" className="cv-card flex items-start gap-2 px-3 py-2 hover:border-cv-brand">
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-cv-ink">{r[ROW.title]}</span>
                      <span className="block text-xs text-cv-muted">{companies[r[ROW.company]]?.[0]} · {r[ROW.location] || 'Location not stated'} · {r[ROW.level]}{r[ROW.position] ? ` · ${r[ROW.position]}` : ''}</span>
                    </span>
                    <ExternalLink size={13} className="mt-1 text-cv-faint shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
            {shown.length > more && <Button variant="ghost" className="mt-3" onClick={() => setMore((m) => m + SHOWN)}>Show more</Button>}
          </>
        )}
      </main>
      <BottomTabBar />
    </div>
  );
}
