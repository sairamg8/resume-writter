import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Upload } from 'lucide-react';
import { useJobMapAccess } from '@/hooks/useJobMapAccess';
import { ROW, FUNCTION_LABELS, checkData, filterRows, distinct } from '@/utils/jobMapData';

const SHOWN = 100;
const field = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white min-w-0';

/** Open roles across companies and countries, for the accounts the owner allowed (firestore.rules). Its data is loaded from the account, never shipped in the app. */
export default function JobMap({ auth }) {
  const allowed = useJobMapAccess(auth.user);
  const [meta, setMeta] = useState(null);       // null: not asked yet; false: nothing loaded
  const [country, setCountry] = useState('IN');
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [f, setF] = useState({ fn: '', level: '', track: '', q: '' });
  const [more, setMore] = useState(SHOWN);
  const file = useRef(null);

  async function refresh() {
    const io = await import('@/utils/jobMapIo');
    setMeta((await io.loadMeta()) || false);
  }
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
  const shown = useMemo(() => filterRows(rows, companies, f), [rows, companies, f]);
  if (auth.authLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-400">Loading…</div>;
  if (!auth.user || allowed === false) return <Navigate to="/" replace />;
  if (allowed === null) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-400">Loading…</div>;

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <Link to="/" className="p-1.5 rounded-lg hover:bg-gray-200" aria-label="Back"><ArrowLeft size={18} /></Link>
          <h1 className="text-lg font-semibold flex-1">Job Map</h1>
          <button onClick={() => file.current?.click()} className="flex items-center gap-1.5 text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white hover:bg-gray-100">
            <Upload size={13} /> Load data file
          </button>
          <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
        </div>
        {status && <p className="text-xs text-gray-500 mb-3">{status}</p>}
        {meta === false && <p className="text-sm text-gray-600">No data yet. Build it with the job-map tool (<code>node build-data.mjs</code>) and choose jobmap-data.json above.</p>}
        {meta && (
          <>
            <p className="text-xs text-gray-500 mb-3">{companies.length} companies · crawled {meta.crawled}</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
              <select value={country} onChange={(e) => setCountry(e.target.value)} className={field} aria-label="Country">
                {countries.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
              </select>
              <select value={f.fn} onChange={set('fn')} className={field} aria-label="Function">
                <option value="">Any function</option>
                {distinct(rows, ROW.fn).map((v) => <option key={v} value={v}>{FUNCTION_LABELS[v] ?? v}</option>)}
              </select>
              <select value={f.level} onChange={set('level')} className={field} aria-label="Level">
                <option value="">Any level</option>
                {distinct(rows, ROW.level).map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={f.track} onChange={set('track')} className={field} aria-label="Stack">
                <option value="">Any stack</option>
                {distinct(rows, ROW.track).map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <input value={f.q} onChange={set('q')} placeholder="Search title, company, place" className={`${field} col-span-2 sm:col-span-1`} aria-label="Search" />
            </div>
            <p className="text-xs text-gray-500 mb-2">{shown.length} roles</p>
            <ul className="space-y-1.5">
              {shown.slice(0, more).map((r, i) => (
                <li key={`${r[ROW.url]}-${i}`}>
                  <a href={r[ROW.url]} target="_blank" rel="noreferrer noopener" className="flex items-start gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 hover:border-gray-400">
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-gray-900">{r[ROW.title]}</span>
                      <span className="block text-xs text-gray-500">{companies[r[ROW.company]]?.[0]} · {r[ROW.location] || 'Location not stated'} · {r[ROW.level]}{r[ROW.position] ? ` · ${r[ROW.position]}` : ''}</span>
                    </span>
                    <ExternalLink size={13} className="mt-1 text-gray-400 shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
            {shown.length > more && <button onClick={() => setMore((m) => m + SHOWN)} className="mt-3 text-sm text-blue-700 hover:underline">Show more</button>}
          </>
        )}
      </div>
    </div>
  );
}
