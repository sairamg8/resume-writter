// fetch that asks again when a host is busy (429, 502, 503, 504): waits Retry-After seconds, else 1.5 s, 3 s, ... (capped).
// A thrown error (dead host, timeout) is not retried, so a host that is down costs one timeout, not three.
export const RETRY_STATUSES = new Set([429, 502, 503, 504]);

/** Pause before retry number `attempt` (0 = the first retry): Retry-After seconds if the host sent them, else base * 2^attempt. */
export function retryDelayMs(attempt, retryAfter, { base = 1500, cap = 30000 } = {}) {
  const secs = /^\d+(\.\d+)?$/.test(String(retryAfter ?? '').trim()) ? Number(String(retryAfter).trim()) : null;
  return Math.min(secs === null ? base * 2 ** attempt : secs * 1000, cap);
}

/** fetch(url, init), tried again while the answer is a busy-host status; the LAST response is returned even when it still is one. */
export async function fetchRetry(url, init = {}, { retries = 2, timeoutMs, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), fetchImpl = fetch, base, cap } = {}) {
  for (let attempt = 0; ; attempt++) {
    // one signal per attempt: a signal shared by all of them would already have run out
    const r = await fetchImpl(url, timeoutMs ? { ...init, signal: AbortSignal.timeout(timeoutMs) } : init);
    if (!RETRY_STATUSES.has(r.status) || attempt >= retries) return r;
    try { await r.body?.cancel(); } catch { /* the body is not needed */ }
    await sleep(retryDelayMs(attempt, r.headers?.get('retry-after') ?? null, { base, cap }));
  }
}
