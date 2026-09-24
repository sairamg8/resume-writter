/**
 * Coalesces writes of a value that changes in bursts (a store saved on every keystroke, R2-077).
 * `schedule(value)` after a quiet spell of `wait` ms writes at once; values scheduled within `wait`
 * of the last write are held and only the latest is written, `wait` ms after the last of them — and
 * at least every `maxWait` ms while they keep coming. `flush()` writes what is held now (leaving the
 * page); `pending()` says whether something is held; `hold(update)` stops the held value's timer until the
 * next `schedule` (a newer value is on its way, and the held one must not be written before it), and
 * makes the held value `update(value)`, so a `flush` before that newer value comes writes it too.
 */
export function coalescedWriter(write, { wait, maxWait }) {
  let timer = null;
  let held = null;       // { value } while a write waits
  let burstStart = 0;    // when the held burst began
  let lastWrite = -Infinity;

  function flush() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (!held) return;
    const { value } = held;
    held = null;
    lastWrite = Date.now();
    write(value);
  }

  function schedule(value) {
    const now = Date.now();
    const quiet = !held && now - lastWrite >= wait;
    if (!held) burstStart = now;
    held = { value };
    if (quiet) { flush(); return; }
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, Math.max(0, Math.min(wait, burstStart + maxWait - now)));
  }

  function hold(update) {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (held && update) held = { value: update(held.value) };
  }

  return { schedule, flush, hold, pending: () => held !== null };
}
