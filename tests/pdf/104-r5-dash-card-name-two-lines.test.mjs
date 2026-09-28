// R4-DVIS-28 (R5 follow-up to 8a17031): a résumé card's name was one `truncate` line, its full text only
// in a hover title. A touch screen (an iPad in landscape, the row's device) never shows a title, so a
// name past ~35 characters and its "<name> (Copy)" read the same cut text on the card. The name now wraps
// to two lines (line-clamp-2), and a copy's ending — " (Copy)", " (Copy) (Copy)", " (conflict copy)" —
// is its own unclamped element beside the clamped base, so it shows however long the name. The title
// stays, for a mouse. The ending sits on the base's last line, right after the name (the row lines its
// parts up at the bottom, items-end), not beside the first line of a two-line name; it takes at most
// half the row and wraps, and three or more of one ending in a row read as one with a count
// (" (Copy ×5)"), so pressing Copy on the newest copy again and again never pushes the base off the
// card. The fake DOM has no layout, so this pins the classes and the split on the real ResumeCard,
// mounted with react-dom/client over tests/pdf/fake-dom.mjs, with fictional résumés.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, mount } from './fake-dom.mjs';

before(setup);
after(teardown);

const tokens = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
const ONE_LINE = ['truncate', 'whitespace-nowrap', 'line-clamp-1', 'text-ellipsis'];

// Past two lines of a ~312 px card, so only an ending kept out of the clamp still shows.
const LONG = 'Senior Harbor Pilot, Northern Coast Region, Tugboat and Pilotage Operations Lead CV';

/** The card's name: its <p> (the title), the clamped part, and the ending beside it (or null). */
async function nameOf(name) {
  const { ResumeCard } = await loadModule('/src/components/ResumeCard.jsx');
  const cv = { id: 'resume_x', name, updatedAt: 1, settings: {}, sections: [], personal: { name: 'Wren Calloway' } };
  const view = mount(ResumeCard, { resume: cv, onOpen() {}, onDuplicate() {}, onDelete() {}, onRename() {} });
  try {
    const p = [...elements(view.container)].find((el) => el.tagName === 'P' && el.getAttribute('title') === name);
    assert.ok(p, `the name's <p>, titled "${name}"`);
    const inside = [...elements(p)].filter((el) => el !== p);
    const clamped = [p, ...inside].find((el) => tokens(el).includes('line-clamp-2'));
    assert.ok(clamped, `the name wraps to two lines (line-clamp-2): ${[p, ...inside].map((el) => tokens(el).join(' ')).join(' | ')}`);
    for (const el of [p, ...inside]) {
      for (const t of ONE_LINE) assert.ok(!tokens(el).includes(t), `no part of the name is cut to one line (${t}): ${tokens(el).join(' ')}`);
    }
    const ending = inside.find((el) => el !== clamped && !clamped.contains(el) && !el.contains(clamped) && el.textContent.trim()) ?? null;
    return { title: p.getAttribute('title'), text: p.textContent, rowTokens: tokens(p), clamped: clamped.textContent, clampedTokens: tokens(clamped), ending: ending && { text: ending.textContent, tokens: tokens(ending) } };
  } finally { await view.unmount(); }
}

it('a long name wraps to two lines and keeps its full text in the title', async () => {
  const shown = await nameOf(LONG);
  assert.equal(shown.title, LONG, 'the full name on hover, for a mouse');
  assert.equal(shown.text, LONG, 'the card holds the whole name');
  assert.equal(shown.clamped, LONG, 'a name with no copy ending is clamped whole');
  assert.ok(shown.clampedTokens.includes('break-words'), 'a long unbroken word wraps rather than overflow');
  assert.equal(shown.ending, null, 'no ending to keep out of the clamp');
});

for (const suffix of [' (Copy)', ' (Copy) (Copy)', ' (conflict copy)']) {
  it(`a copy's "${suffix.trim()}" is never cut, so it and the original differ on a touch screen`, async () => {
    const shown = await nameOf(`${LONG}${suffix}`);
    assert.equal(shown.title, `${LONG}${suffix}`);
    assert.equal(shown.text, `${LONG}${suffix}`, 'the card reads the whole name, the ending right after the base');
    assert.equal(shown.clamped, LONG, 'only the base name is clamped');
    assert.ok(shown.ending, `"${suffix.trim()}" is its own element, outside the clamp`);
    assert.equal(shown.ending.text, suffix, 'the whole ending, its leading space kept');
    assert.ok(shown.ending.tokens.includes('shrink-0'), `the ending never shrinks away: ${shown.ending.tokens.join(' ')}`);
    endsTheName(shown);
  });
}

/** The ending is on the base's last line, right after the name, and can never take the whole row. */
function endsTheName(shown) {
  const row = shown.rowTokens, own = shown.ending.tokens;
  assert.ok(row.includes('items-end') || own.includes('self-end'),
    `the ending lines up with the base's last line, not beside its first: <p> ${row.join(' ')} | ending ${own.join(' ')}`);
  assert.ok(own.some((t) => t.startsWith('max-w-')), `the ending takes at most part of the row: ${own.join(' ')}`);
  for (const t of ['whitespace-pre', 'whitespace-nowrap', 'text-nowrap']) {
    assert.ok(!own.includes(t), `the ending wraps when it must, rather than run off the card (${t})`);
  }
}

it('pressing Copy on the newest copy again and again shows one ending with a count, and the base still shows', async () => {
  for (const [name, ending] of [
    [`${LONG}${' (Copy)'.repeat(6)}`, ' (Copy ×6)'],
    [`${LONG}${' (Copy)'.repeat(3)}`, ' (Copy ×3)'],
    [`Tide Tables CV${' (Copy)'.repeat(12)}`, ' (Copy ×12)'],
    [`${LONG} (conflict copy) (Copy) (Copy) (Copy) (Copy)`, ' (conflict copy) (Copy ×4)'],
    [`${LONG}${' (conflict copy)'.repeat(3)} (Copy)`, ' (conflict copy ×3) (Copy)'],
  ]) {
    const shown = await nameOf(name);
    assert.equal(shown.title, name, 'the full name stays in the title');
    assert.equal(shown.clamped, name.slice(0, name.indexOf(' (')), 'only the base name is clamped');
    assert.ok(shown.ending, `${name}: the ending is its own element`);
    assert.equal(shown.ending.text, ending, `${name}: a run of three or more of one ending reads as one with a count`);
    endsTheName(shown);
  }
});

it('a name that is only an ending stays whole, and "Copy" inside a name is not split off', async () => {
  const bare = await nameOf('(Copy)');
  assert.equal(bare.clamped, '(Copy)', 'nothing to split from');
  assert.equal(bare.ending, null);
  const mid = await nameOf('Copy (Copy) editor CV');
  assert.equal(mid.clamped, 'Copy (Copy) editor CV', 'only an ending counts');
  assert.equal(mid.ending, null);
});
