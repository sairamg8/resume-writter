// fetch that asks again when a host is busy (429, 502, 503, 504): waits Retry-After seconds, else 1.5 s, 3 s, ... (capped).
// A thrown error (dead host, timeout) is not retried, so a host that is down costs one timeout, not three.
export const RETRY_STATUSES = new Set([429, 502, 503, 504]);

/** Pause before retry number `attempt` (0 = the first retry): Retry-After seconds if the host sent them, else base * 2^attempt. */
export function retryDelayMs(attempt, retryAfter, { base = 1500, cap = 30000 } = {}) {
  const ms = retryAfterMs(retryAfter);
  return Math.min(ms === null ? base * 2 ** attempt : ms, cap);
}

/** Retry-After in ms when it is a number of seconds, else null (a date is not understood). */
export const retryAfterMs = (v) => (/^\d+(\.\d+)?$/.test(String(v ?? '').trim()) ? Number(String(v).trim()) * 1000 : null);

/** fetch(url, init), tried again while the answer is a busy-host status; the LAST response is returned even when it still is one.
 *  A Retry-After above `cap` (30 s) is returned at once: waiting the cap and asking again would only be refused again. */
export async function fetchRetry(url, init = {}, { retries = 2, timeoutMs, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), fetchImpl = fetch, base, cap = 30000 } = {}) {
  for (let attempt = 0; ; attempt++) {
    // one signal per attempt: a signal shared by all of them would already have run out
    const r = await fetchImpl(url, timeoutMs ? { ...init, signal: AbortSignal.timeout(timeoutMs) } : init);
    if (!RETRY_STATUSES.has(r.status) || attempt >= retries) return r;
    const asked = retryAfterMs(r.headers?.get('retry-after') ?? null);
    if (asked !== null && asked > cap) return r;
    try { await r.body?.cancel(); } catch { /* the body is not needed */ }
    await sleep(retryDelayMs(attempt, r.headers?.get('retry-after') ?? null, { base, cap }));
  }
}
