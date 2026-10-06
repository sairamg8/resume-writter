// The preview's status as a state machine (typing-freeze hunt, D-1: "rendering for minutes" after a burst of
// keys while the pane flipped hidden/visible, not reproduced). Seeded random walks over the events the
// component can see: a change typed or a burst of them, an undo back to an input seen before, the pane
// hidden and shown, a build that finishes or fails (a timeout and a dead worker reach the component as a
// failed build: pdfBuild.js rejects, tests/pdf/126), a paint that fails, the page text held and let go
// (it is read after the paint), Retry, and time passing. After every walk everything outstanding is settled
// and the invariants are read: nothing running, queued or timed means the status is never 'rendering'
// ('ready' shows the current input's pages, 'error' has its alert and Retry); and a hidden pane starts no
// build at all, so none is left queued behind it.
// PdfPreview over fake-dom with a stand-in pdf.js and builds the test finishes (preview-stub.mjs).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setupPreview, teardownPreview, settle, pause, versions, name, preview, heldBuild, textGate } from './preview-stub.mjs';

before(setupPreview);
after(teardownPreview);

/** A small seeded generator (mulberry32), so a failing walk can be replayed from its seed. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const STEPS = 18;

async function walk(seed) {
  const rand = rng(seed);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const pool = versions(60);
  let next = 0;
  const fresh = () => pool[next++];
  const { calls, build } = heldBuild();
  const v0 = fresh();
  const p = await preview({ render: build, input: v0 });
  const gate = textGate(p.pdf);
  const log = [];
  const cur = { input: v0, active: true };
  const seen = [v0];
  const done = new Set(); // indexes of calls finished or failed
  const props = () => ({ render: build, input: cur.input, active: cur.active });
  const outstanding = () => calls.map((c, i) => [c, i]).filter(([, i]) => !done.has(i));
  const settleCall = (i, fail) => {
    done.add(i);
    if (fail) calls[i].fail(`build ${i} failed`); else calls[i].finish();
  };
  const hiddenAt = { count: null };
  const check = (when) => {
    if (!cur.active && hiddenAt.count !== null) {
      assert.equal(calls.length, hiddenAt.count, `seed ${seed}: a hidden pane started a build (${when})\n${log.join('\n')}`);
    }
  };
  try {
    await settle();
    settleCall(0, false);
    await settle();
    for (let step = 0; step < STEPS; step++) {
      const event = pick(['type', 'type', 'burst', 'undo', 'hide', 'show', 'finish', 'finish', 'fail', 'hold', 'release', 'retry', 'paintFail', 'wait', 'wait']);
      log.push(`${step}: ${event}`);
      if (event === 'type') {
        cur.input = fresh(); seen.push(cur.input);
        p.set(props());
        await settle();
      } else if (event === 'burst') {
        for (let k = 0; k < 2 + Math.floor(rand() * 4); k++) { cur.input = fresh(); seen.push(cur.input); p.set(props()); }
        await settle();
      } else if (event === 'undo') {
        cur.input = pick(seen);
        p.set(props());
        await settle();
      } else if (event === 'hide' && cur.active) {
        cur.active = false;
        p.set(props());
        await settle();
        hiddenAt.count = calls.length;
      } else if (event === 'show' && !cur.active) {
        cur.active = true;
        hiddenAt.count = null;
        p.set(props());
        await settle();
      } else if (event === 'finish' || event === 'fail') {
        const open = outstanding();
        if (open.length) { settleCall(pick(open)[1], event === 'fail'); await settle(); }
      } else if (event === 'hold') {
        gate.hold();
      } else if (event === 'release') {
        gate.release();
        await settle();
      } else if (event === 'retry') {
        if (p.alert()) { p.retry(); await settle(); }
      } else if (event === 'paintFail') {
        p.pdf.failPaint = !p.pdf.failPaint;
      } else if (event === 'wait') {
        await pause();
      }
      check(`after ${event}`);
    }

    // Settle everything: nothing may stay running, queued or timed.
    gate.release();
    p.pdf.failPaint = false;
    for (let round = 0; round < 12; round++) {
      await pause();
      const open = outstanding();
      if (!open.length) { await settle(); if (!outstanding().length) break; continue; }
      for (const [, i] of open) settleCall(i, rand() < 0.3);
      await settle();
    }
    await pause();
    check('settled');
    assert.equal(outstanding().length, 0, `seed ${seed}: a build is still running or queued\n${log.join('\n')}`);

    const status = p.status();
    const where = `seed ${seed}, input ${name(cur.input)}, ${cur.active ? 'shown' : 'hidden'}\n${log.join('\n')}`;
    assert.notEqual(status, 'rendering', `stuck on 'rendering' with nothing running: ${where}`);
    if (status === 'ready') assert.equal(p.shown(), name(cur.input), `ready on pages that are not the current input's: ${where}`);
    if (status === 'error') assert.ok(p.alert(), `an error with no alert: ${where}`);
    if (cur.active) assert.notEqual(status, 'paused', `shown and still 'paused': ${where}`);

    // Whatever the walk left, one more change builds and the preview recovers: no wedged queue. (Shown
    // again, a pane that was behind builds first, so the builds are settled as they come.)
    if (!cur.active) { cur.active = true; p.set(props()); await settle(); }
    cur.input = fresh();
    p.set(props());
    let started = false;
    for (let round = 0; round < 6; round++) {
      await pause();
      const open = outstanding();
      if (!open.length) break;
      started = true;
      for (const [, i] of open) settleCall(i, false);
      await settle();
    }
    assert.ok(started, `the next change started no build: ${where}`);
    await pause();
    assert.deepEqual([p.shown(), p.status()], [name(cur.input), 'ready'], `no recovery: ${where}`);
  } finally { gate.release(); await p.view.unmount(); }
}

describe('the preview status never stays \'rendering\' once nothing runs, and a hidden pane builds nothing (D-1)', () => {
  for (const seed of SEEDS) {
    it(`seeded walk ${seed}`, async () => { await walk(seed); });
  }
});
