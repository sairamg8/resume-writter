// R4-DVIS-28 (R5 follow-up to 8a17031): a résumé card's name was one `truncate` line, its full text only
// in a hover title. A touch screen (an iPad in landscape, the row's device) never shows a title, so a
// name past ~35 characters and its "<name> (Copy)" read the same cut text on the card. The name now wraps
// to two lines (line-clamp-2), and a copy's ending — " (Copy)", " (Copy) (Copy)", " (conflict copy)" —
// always shows. The title stays, for a mouse.
//
// Where the ending sits: a name that fits in two lines is one run of text, clamped as a whole, so the
// ending follows the last word ("Region CV (Copy)", not "Region CV        (Copy)" at the row's right
// edge, where a flex item beside a wrapped base put it). A name past two lines would have its ending
// cut, so there only the base is clamped and the ending stands beside the base's last line (items-end),
// taking at most half the row and wrapping; three or more of one ending in a row read as one with a
// count (" (Copy ×5)"). The card measures the one-run layout before paint, and again when the name or
// its width changes.
//
// The fake DOM has no layout, so this file gives it a crude one: text wraps every `cpl` characters, a
// line is 20 px high, and a line-clamp-2 box is at most two lines high. The real ResumeCard is mounted
// with react-dom/client over tests/pdf/fake-dom.mjs, with fictional résumés; a fake ResizeObserver lets
// a test widen or narrow the card.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, mount, fakeWindow, reactProps } from './fake-dom.mjs';

const tokens = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
const ONE_LINE = ['truncate', 'whitespace-nowrap', 'line-clamp-1', 'text-ellipsis'];

// The crude layout: `cpl` characters to a line (~40 on a 312 px lg card), 20 px a line, 8 px a character.
const LINE = 20, CHAR = 8;
let cpl = 40;
const lines = (el) => Math.max(1, Math.ceil(el.textContent.length / cpl));
const LAYOUT = {
  scrollHeight: { get() { return lines(this) * LINE; } },
  clientHeight: { get() { return (tokens(this).includes('line-clamp-2') ? Math.min(lines(this), 2) : lines(this)) * LINE; } },
  clientWidth: { get() { return cpl * CHAR; } },
};
const proto = Object.getPrototypeOf(fakeWindow().document.createElement('div'));
const observers = new Set();
const saved = { ResizeObserver: globalThis.ResizeObserver };

before(async () => {
  await setup();
  for (const [k, d] of Object.entries(LAYOUT)) Object.defineProperty(proto, k, { ...d, configurable: true });
  globalThis.ResizeObserver = class {
    constructor(cb) { this.cb = cb; }
    observe() { observers.add(this); }
    disconnect() { observers.delete(this); }
  };
});
after(async () => {
  for (const k of Object.keys(LAYOUT)) delete proto[k];
  if (saved.ResizeObserver) globalThis.ResizeObserver = saved.ResizeObserver;
  else delete globalThis.ResizeObserver;
  await teardown();
});

// Past two lines of a ~312 px card, so only an ending kept out of the clamp still shows.
const LONG = 'Senior Harbor Pilot, Northern Coast Region, Tugboat and Pilotage Operations Lead CV';
// Two lines with its ending, the second one short: a flex ending sat far from its last word.
const MID = 'Harbor Pilot, Northern Coast Region CV';

const cardProps = (name) => ({
  resume: { id: 'resume_x', name, updatedAt: 1, settings: {}, sections: [], personal: { name: 'Wren Calloway' } },
  onOpen() {}, onDuplicate() {}, onDelete() {}, onRename() {},
});
const settle = async () => { for (let i = 0; i < 3; i += 1) await new Promise((r) => { setImmediate(r); }); };

/** The card's name as it shows: its <p> (the title), the one clamped element, and the ending (or null). */
function read(view, name) {
  const p = [...elements(view.container)].find((el) => el.tagName === 'P' && el.getAttribute('title') === name);
  assert.ok(p, `the name's <p>, titled "${name}"`);
  const all = [...elements(p)];
  const clamps = all.filter((el) => tokens(el).includes('line-clamp-2'));
  assert.equal(clamps.length, 1, `the name wraps to two lines (one line-clamp-2): ${all.map((el) => tokens(el).join(' ')).join(' | ')}`);
  const [clamped] = clamps;
  for (const el of all) {
    for (const t of ONE_LINE) assert.ok(!tokens(el).includes(t), `no part of the name is cut to one line (${t}): ${tokens(el).join(' ')}`);
  }
  assert.ok(tokens(clamped).includes('break-words'), 'a long unbroken word wraps rather than overflow');
  const ending = p.childNodes.length > 1 ? p.lastChild : null;
  return {
    p, title: p.getAttribute('title'), text: p.textContent, rowTokens: tokens(p), clamped,
    ending: ending && { el: ending, text: ending.textContent, tokens: ending.nodeType === 1 ? tokens(ending) : [] },
  };
}

async function nameOf(name) {
  const { ResumeCard } = await loadModule('/src/components/ResumeCard.jsx');
  const view = mount(ResumeCard, cardProps(name));
  try { await settle(); return read(view, name); } finally { await view.unmount(); }
}

/** Base and ending are one run of text, clamped together: the ending follows the base's last word. */
function oneRun(shown, label) {
  assert.equal(shown.clamped, shown.p, `${label}: the whole name is one clamped run, not a base clamped apart from its ending: <p> ${shown.rowTokens.join(' ')}`);
  for (const t of ['flex', 'inline-flex', 'grid']) assert.ok(!shown.rowTokens.includes(t), `${label}: the ending flows after the last word, not as a box at the row's edge (${t})`);
  if (shown.ending) {
    for (const t of shown.ending.tokens) assert.ok(!/^(?:block|flex|inline-block|float-|shrink-|max-w-)/.test(t), `${label}: the ending is plain inline text right after the name (${t})`);
  }
}

/** Only the base is clamped; the ending is on the base's last line and can never take the whole row. */
function splitOff(shown, label) {
  assert.ok(shown.ending, `${label}: the ending is its own element`);
  assert.ok(!shown.clamped.contains(shown.ending.el), `${label}: the ending is outside the clamp, so it is never cut`);
  const row = shown.rowTokens, own = shown.ending.tokens;
  assert.ok(own.includes('shrink-0'), `${label}: the ending never shrinks away: ${own.join(' ')}`);
  const self = own.filter((t) => t.startsWith('self-'));
  assert.ok(self.every((t) => t === 'self-end'), `${label}: nothing moves the ending off the base's last line: ${own.join(' ')}`);
  assert.ok(row.includes('items-end') || self.includes('self-end'),
    `${label}: the ending lines up with the base's last line, not beside its first: <p> ${row.join(' ')} | ending ${own.join(' ')}`);
  const caps = own.filter((t) => t.startsWith('max-w-'));
  assert.ok(caps.length > 0, `${label}: the ending takes at most part of the row: ${own.join(' ')}`);
  for (const t of caps) {
    const frac = /^max-w-(\d+)\/(\d+)$/.exec(t);
    assert.ok(frac && Number(frac[1]) < Number(frac[2]), `${label}: the ending's cap is a part of the row, not all of it (${t})`);
  }
  for (const t of ['whitespace-pre', 'whitespace-nowrap', 'text-nowrap']) {
    assert.ok(!own.includes(t), `${label}: the ending wraps when it must, rather than run off the card (${t})`);
  }
}

it('a long name wraps to two lines and keeps its full text in the title', async () => {
  const shown = await nameOf(LONG);
  assert.equal(shown.title, LONG, 'the full name on hover, for a mouse');
  assert.equal(shown.text, LONG, 'the card holds the whole name');
  assert.equal(shown.clamped.textContent, LONG, 'a name with no copy ending is clamped whole');
  assert.equal(shown.ending, null, 'no ending to keep out of the clamp');
});

it('a copy whose name fits in two lines reads as one run, its "(Copy)" right after the last word', async () => {
  for (const name of [`${MID} (Copy)`, 'Tide Tables CV (Copy)', `${MID} (conflict copy)`, `${MID} (Copy) (Copy)`]) {
    const shown = await nameOf(name);
    assert.equal(shown.title, name);
    assert.equal(shown.text, name, `${name}: the card reads the whole name`);
    assert.ok(shown.ending, `${name}: the ending is there`);
    oneRun(shown, name);
  }
});

for (const suffix of [' (Copy)', ' (Copy) (Copy)', ' (conflict copy)']) {
  it(`a long copy's "${suffix.trim()}" is never cut, so it and the original differ on a touch screen`, async () => {
    const shown = await nameOf(`${LONG}${suffix}`);
    assert.equal(shown.title, `${LONG}${suffix}`);
    assert.equal(shown.text, `${LONG}${suffix}`, 'the card reads the whole name, the ending right after the base');
    assert.equal(shown.clamped.textContent, LONG, 'only the base name is clamped');
    assert.equal(shown.ending?.text, suffix, 'the whole ending, its leading space kept');
    splitOff(shown, suffix);
  });
}

it('pressing Copy on the newest copy again and again shows one ending with a count, and the base still shows', async () => {
  for (const [name, ending, fits] of [
    [`${LONG}${' (Copy)'.repeat(6)}`, ' (Copy ×6)', false],
    [`${LONG}${' (Copy)'.repeat(3)}`, ' (Copy ×3)', false],
    [`Tide Tables CV${' (Copy)'.repeat(12)}`, ' (Copy ×12)', true],
    [`${LONG} (conflict copy) (Copy) (Copy) (Copy) (Copy)`, ' (conflict copy) (Copy ×4)', false],
    [`${LONG}${' (conflict copy)'.repeat(3)} (Copy)`, ' (conflict copy ×3) (Copy)', false],
  ]) {
    const shown = await nameOf(name);
    const base = name.slice(0, name.indexOf(' ('));
    assert.equal(shown.title, name, 'the full name stays in the title');
    assert.equal(shown.text, `${base}${ending}`, `${name}: a run of three or more of one ending reads as one with a count`);
    assert.equal(shown.ending?.text, ending, `${name}: the ending is its own element`);
    if (fits) oneRun(shown, name);
    else {
      assert.equal(shown.clamped.textContent, base, 'only the base name is clamped');
      splitOff(shown, name);
    }
  }
});

it('the card measures again when it is widened or narrowed, or the name changes', async () => {
  const { ResumeCard } = await loadModule('/src/components/ResumeCard.jsx');
  const name = `${LONG} (Copy)`;
  const view = mount(ResumeCard, cardProps(name));
  const resize = async (chars) => {
    cpl = chars;
    view.act(() => { for (const o of observers) o.cb([]); });
    await settle();
  };
  try {
    await settle();
    assert.ok(observers.size > 0, 'the card watches its name\'s width');
    splitOff(read(view, name), 'at 40 characters a line');
    await resize(100);
    oneRun(read(view, name), 'widened to 100: the whole name fits in two lines again');
    await resize(40);
    splitOff(read(view, name), 'narrowed back to 40');
    const short = 'Tide Tables CV (Copy)';
    view.update(cardProps(short));
    await settle();
    oneRun(read(view, short), 'renamed to a short name');
    view.update(cardProps(name));
    await settle();
    splitOff(read(view, name), 'renamed back to the long name');
  } finally {
    cpl = 40;
    await view.unmount();
  }
  assert.equal(observers.size, 0, 'the card stops watching once it is gone');
});

// The width the card last measured must also be the width it compares against. The observer is off
// while Rename is open (the name's <p> is gone) and while the name has no ending, so a width change
// then goes unseen; a card that kept the observer's old width called each new measurement stale and
// measured again before paint, over and over, until React threw "Maximum update depth exceeded" and
// the dashboard went blank (R4-DVIS-28, second review of 1d693cb).
it('a card whose width changed while nothing watched it measures once and still shows the name', async () => {
  const { ResumeCard } = await loadModule('/src/components/ResumeCard.jsx');
  const byTitle = (view, title) => [...elements(view.container)].find((el) => el.getAttribute('title') === title);
  const call = (view, el, handler, event = {}) => {
    const fn = reactProps(el)?.[handler];
    assert.ok(fn, `no ${handler} on <${el?.tagName}>`);
    view.act(() => fn({ preventDefault() {}, stopPropagation() {}, target: el, currentTarget: el, ...event }));
  };
  const errors = [];
  const caught = (e) => { errors.push(e); };
  process.prependListener('uncaughtException', caught);
  const renames = [];
  const props = (name) => ({ ...cardProps(name), onRename: (id, n) => renames.push(n) });
  const first = `${LONG} (Copy)`;
  const view = mount(ResumeCard, props(first));
  const observe = async () => { view.act(() => { for (const o of observers) o.cb([]); }); await settle(); };
  try {
    await settle();
    await observe(); // the observer has seen the card at 40 characters a line
    splitOff(read(view, first), 'at 40 characters a line');

    // Rename opens (the observer stops with the name's <p>), the iPad turns, and the new name is saved.
    call(view, byTitle(view, 'Rename'), 'onClick');
    await settle();
    assert.equal(observers.size, 0, 'nothing watches the name while Rename is open');
    cpl = 100;
    const renamed = `${MID} v2 (Copy)`;
    const box = [...elements(view.container)].find((el) => el.tagName === 'INPUT');
    call(view, box, 'onChange', { target: { value: renamed } });
    call(view, [...elements(view.container)].find((el) => el.getAttribute('aria-label') === 'Save name'), 'onClick');
    await settle();
    assert.deepEqual(renames, [renamed]);
    view.update(props(renamed)); // the store's rename, as the dashboard hands it down
    await settle();
    assert.deepEqual(errors.map((e) => e.message), [], 'the card does not measure itself into a crash');
    oneRun(read(view, renamed), 'renamed after the card widened');

    // The name loses its ending (the observer stops), the window narrows, and it gains one again.
    view.update(props(LONG));
    await settle();
    cpl = 40;
    const conflict = `${LONG} (conflict copy)`;
    view.update(props(conflict));
    await settle();
    assert.deepEqual(errors.map((e) => e.message), [], 'the card does not measure itself into a crash');
    splitOff(read(view, conflict), 'an ending gained after the card narrowed');
    await observe(); // the observer, back on, sees the same width: nothing changes
    splitOff(read(view, conflict), 'after the observer catches up');
  } finally {
    cpl = 40;
    process.removeListener('uncaughtException', caught);
    await view.unmount();
  }
});

it('a name that is only an ending stays whole, and "Copy" inside a name is not split off', async () => {
  const bare = await nameOf('(Copy)');
  assert.equal(bare.clamped.textContent, '(Copy)', 'nothing to split from');
  assert.equal(bare.ending, null);
  const mid = await nameOf('Copy (Copy) editor CV');
  assert.equal(mid.clamped.textContent, 'Copy (Copy) editor CV', 'only an ending counts');
  assert.equal(mid.ending, null);
});
