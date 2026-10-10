import { useEffect, useState } from 'react';
import { Button, TextField } from '@/components/ui';
import { jobMapAccessIo } from '@/utils/jobMapAccessIo';
import { isOwnAddress, planAdd, planRemove, sortAddresses } from '@/utils/jobMapAccessLogic';

/**
 * "Job Map access", a small panel on the Job Map page for a Job Map admin (firestore.rules, isJobMapAdmin): the
 * addresses in `jobmap_access`, an add box and a remove button with a confirm step. Its own chunk, loaded by the
 * page only for an account that may use the Job Map; it asks the server once, and that one read is the admin
 * check: a refusal (permission-denied) draws nothing and says nothing, any other failure draws a short note
 * with Retry. `email` is the signed-in address (kept in the list: it cannot be removed); `io` is
 * jobMapAccessIo's calls (a test passes a fake's).
 */
export default function JobMapAccessPanel({ email, io = jobMapAccessIo }) {
  // phase: 'loading' | 'admin' | 'denied' | 'failed'
  const [state, setState] = useState({ phase: 'loading', addresses: [] });
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null); // { ok, text }
  const [confirming, setConfirming] = useState(null);
  const { phase, addresses } = state;

  useEffect(() => {
    let live = true;
    setState({ phase: 'loading', addresses: [] });
    io.list().then(
      (r) => { if (live) setState(r.admin ? { phase: 'admin', addresses: r.addresses } : { phase: 'denied', addresses: [] }); },
      () => { if (live) setState({ phase: 'failed', addresses: [] }); },
    );
    return () => { live = false; };
  }, [io, attempt]);

  if (phase === 'loading' || phase === 'denied') return null;
  if (phase === 'failed') {
    return (
      <div className="cv-card flex items-center gap-3 px-3 py-2 mb-4 text-xs text-cv-muted">
        <span className="flex-1">Could not check the Job Map access settings.</span>
        <Button size="sm" onClick={() => setAttempt((n) => n + 1)}>Retry</Button>
      </div>
    );
  }

  async function add(e) {
    e.preventDefault();
    if (busy) return;
    const plan = planAdd(addresses, input);
    if (!plan.ok) { setNotice({ ok: false, text: plan.error }); return; }
    setBusy(true);
    try {
      const created = await io.add(plan.address);
      setState((s) => ({ ...s, addresses: sortAddresses([...s.addresses, plan.address]) }));
      setInput('');
      setNotice({ ok: true, text: created ? `Added ${plan.address}.` : `${plan.address} already had access.` });
    } catch {
      setNotice({ ok: false, text: `Could not add ${plan.address}. Check your connection and try again.` });
    } finally {
      setBusy(false);
    }
  }

  function askRemove(address) {
    const plan = planRemove(addresses, address, email);
    if (!plan.ok) { setNotice({ ok: false, text: plan.error }); return; }
    setNotice(null);
    setConfirming(address);
  }

  async function remove(address) {
    if (busy) return;
    const plan = planRemove(addresses, address, email);
    setConfirming(null);
    if (!plan.ok) { setNotice({ ok: false, text: plan.error }); return; }
    setBusy(true);
    try {
      await io.remove(plan.address);
      setState((s) => ({ ...s, addresses: s.addresses.filter((a) => a !== plan.address) }));
      setNotice({ ok: true, text: `Removed ${plan.address}.` });
    } catch {
      setNotice({ ok: false, text: `Could not remove ${plan.address}. Check your connection and try again.` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cv-card px-3 py-2 mb-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left text-sm font-semibold text-cv-ink">
        <span className="flex-1">Job Map access ({addresses.length})</span>
        <span className="text-xs font-normal text-cv-muted">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="mt-3">
          <p className="text-xs text-cv-muted mb-2">These addresses can open the Job Map. Only an admin sees this list.</p>
          <ul className="space-y-1 mb-3">
            {addresses.map((a) => (
              <li key={a} className="flex items-center gap-2 text-sm">
                <span className="flex-1 min-w-0 truncate text-cv-ink">{a}</span>
                {isOwnAddress(a, email) && <span className="text-xs text-cv-muted">Your address (protected)</span>}
                {!isOwnAddress(a, email) && confirming === a && (
                  <>
                    <span className="text-xs text-cv-muted">Remove this address?</span>
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => remove(a)}>Yes, remove</Button>
                    <Button size="sm" onClick={() => setConfirming(null)}>Cancel</Button>
                  </>
                )}
                {!isOwnAddress(a, email) && confirming !== a && <Button size="sm" disabled={busy} onClick={() => askRemove(a)}>Remove</Button>}
              </li>
            ))}
          </ul>
          <form onSubmit={add} className="flex items-end gap-2">
            <TextField
              label="Add an address"
              size="sm"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="name@example.com"
              autoComplete="off"
              className="flex-1 min-w-0"
            />
            <Button type="submit" variant="primary" size="sm" disabled={busy}>Add</Button>
          </form>
          {notice && <p className={`text-xs mt-2 ${notice.ok ? 'text-cv-good' : 'text-cv-bad'}`}>{notice.text}</p>}
        </div>
      )}
    </section>
  );
}
