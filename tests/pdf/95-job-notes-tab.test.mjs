// R2-159: a job's Notes tab (NotesTab, a RichTextEditor over a contenteditable) had no test. It runs
// here on the real components in the fake DOM (tests/pdf/fake-dom.mjs, loaded through Vite), with
// innerHTML read and written as a browser does (withInnerHtml) and focus that moves (patchFakeDom).
// Pinned: the stored notes show, sanitized, and a job with none shows the empty editor its
// placeholder needs; typing (and an IME composition, once it ends), each toolbar command, a link, a
// paste and the STAR Optimizer's Apply write the notes through set('notes', html); clearing writes
// ''; another job's notes replace the editor's even while it has focus (key={job.id}). On the job
// page, through the real job store: what is typed is saved without the editor being rewritten under
// the caret, is there again on coming back to the tab, and clearing saves ''.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

let NotesTab;
let sanitizeRichText;
let dom;
before(async () => {
  await setup();
  ({ NotesTab } = await loadModule('/src/components/job/NotesTab.jsx'));
  ({ sanitizeRichText } = await loadModule('/src/utils/richText.js'));
  dom = await import('./fake-dom.mjs');
  dom.withInnerHtml();
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
});
after(teardown);

/** An event as a React handler reads it; records preventDefault. */
const ev = (props = {}) => ({
  defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...props,
});

/** The editor and its toolbar in a mounted view, and a React handler of theirs fired. */
function controls(view) {
  const all = () => [...dom.elements(view.container)];
  return {
    all,
    box: () => all().find((el) => el.getAttribute('role') === 'textbox'),
    tool: (title) => all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === title),
    fire: (el, name, e = ev()) => { view.act(() => dom.reactProps(el)[name](e)); return e; },
  };
}

/** NotesTab for `job`; `writes` collects each set(key, value) it makes, `show(job)` re-renders it. */
function notesTab(job) {
  const writes = [];
  const set = (key, value) => { writes.push([key, value]); };
  const view = dom.mount(NotesTab, { job, set });
  return { view, writes, ...controls(view), show: (next) => view.update({ job: next, set }) };
}

/** The tags under `el`, depth first, e.g. ['P', 'STRONG']. */
const tagsIn = (el) => [...dom.elements(el)].filter((n) => n !== el).map((n) => n.tagName);

/** A new line typed at the end of `box`, as Chrome writes one — a <div> — and its text node. */
function typeLine(box, text) {
  const line = box.appendChild(box.ownerDocument.createElement('div'));
  return line.appendChild(box.ownerDocument.createTextNode(text));
}

/**
 * document.execCommand recorded: each command, its value, and whether `box` had focus as it ran.
 * `bold` also wraps the selected text in <b>, as Chrome does, so the notes written after it show
 * whether they were read after the command ran.
 */
function recordCommands(document, box) {
  const commands = [];
  document.execCommand = (command, _ui, value) => {
    commands.push({ command, value, focused: document.activeElement === box });
    const range = document.getSelection().getRangeAt(0);
    if (command === 'bold' && range) {
      const text = range.startContainer;
      const picked = text.nodeValue.slice(range.startOffset, range.endOffset);
      const rest = text.nodeValue.slice(range.endOffset);
      text.nodeValue = text.nodeValue.slice(0, range.startOffset);
      const b = text.parentNode.insertBefore(document.createElement('b'), text.nextSibling);
      b.appendChild(document.createTextNode(picked));
      if (rest) text.parentNode.insertBefore(document.createTextNode(rest), b.nextSibling);
    }
    return true;
  };
  return commands;
}

it('the stored notes show in the editor, sanitized; a job with none shows it empty, so its placeholder shows', async () => {
  const notes = '<p>Call <strong>Ana</strong> on Monday</p><ul><li>Panel of 3</li><li>Salary: 80k &amp; bonus</li></ul><img src="x" onerror="alert(1)">';
  const t = notesTab({ id: 'a', company: 'Acme', notes });
  try {
    assert.match(t.view.container.textContent, /^Notes/, 'under its heading');
    const box = t.box();
    assert.equal(box.getAttribute('aria-label'), 'Notes');
    assert.equal(box.getAttribute('contenteditable'), 'true');
    assert.deepEqual(tagsIn(box), ['P', 'STRONG', 'UL', 'LI', 'LI']);
    assert.equal(box.textContent, 'Call Ana on MondayPanel of 3Salary: 80k & bonus');
    assert.equal(box.innerHTML, sanitizeRichText(notes));
    assert.doesNotMatch(box.innerHTML, /img|onerror/, 'nothing executable reaches the page');
    assert.deepEqual(t.writes, [], 'showing the notes writes nothing');

    t.show({ id: 'b', company: 'Beta' }); // a job with no notes at all
    assert.equal(t.box().childNodes.length, 0, 'empty, so the CSS placeholder (:empty) shows');
    assert.match(t.box().getAttribute('data-placeholder'), /^Interview format, recruiter details/);
    assert.deepEqual(t.writes, []);
  } finally {
    await t.view.unmount();
  }
});

it('typing writes the notes as the editor holds them, through set("notes", html); an IME composition writes once it ends', async () => {
  const t = notesTab({ id: 'a', notes: '<p>Call Ana</p>' });
  try {
    const box = t.box();
    box.focus();
    box.firstChild.firstChild.nodeValue += ' on Monday';
    t.fire(box, 'onInput');
    const typed = typeLine(box, 'Ask about the team');
    t.fire(box, 'onInput');
    assert.deepEqual(t.writes, [
      ['notes', '<p>Call Ana on Monday</p>'],
      ['notes', '<p>Call Ana on Monday</p><div>Ask about the team</div>'],
    ]);

    // Composing (a Japanese IME, say): nothing is written until the composition ends.
    t.fire(box, 'onCompositionStart');
    typed.nodeValue += ' にほん';
    t.fire(box, 'onInput');
    assert.equal(t.writes.length, 2, 'nothing while composing');
    t.fire(box, 'onCompositionEnd');
    assert.deepEqual(t.writes.at(-1), ['notes', '<p>Call Ana on Monday</p><div>Ask about the team にほん</div>']);
  } finally {
    await t.view.unmount();
  }
});

it('each toolbar button runs its command on the editor — focusing it first — and writes the notes after it', async () => {
  const t = notesTab({ id: 'a', notes: '<p>Call Ana</p>' });
  try {
    const box = t.box();
    const { document } = t.view;
    const commands = recordCommands(document, box);
    const text = box.firstChild.firstChild; // "Call Ana"
    const range = document.createRange();
    range.setStart(text, 5);
    range.setEnd(text, 8);
    document.getSelection().addRange(range);

    const press = t.fire(t.tool('Bold (Ctrl+B)'), 'onMouseDown');
    assert.ok(press.defaultPrevented, 'the press keeps the selection in the editor');
    assert.deepEqual(commands, [{ command: 'bold', value: null, focused: true }]);
    assert.deepEqual(t.writes, [['notes', '<p>Call <b>Ana</b></p>']], 'read after the command, so the bold is in it');

    const buttons = [
      ['Italic (Ctrl+I)', 'italic'], ['Underline (Ctrl+U)', 'underline'],
      ['Bullet list', 'insertUnorderedList'], ['Numbered list', 'insertOrderedList'],
      ['Align left', 'justifyLeft'], ['Align center', 'justifyCenter'], ['Align right', 'justifyRight'], ['Justify', 'justifyFull'],
    ];
    for (const [title, command] of buttons) {
      box.blur(); // the button focuses the editor, so its command lands in the notes and nowhere else
      commands.length = 0;
      const writes = t.writes.length;
      assert.ok(t.fire(t.tool(title), 'onMouseDown').defaultPrevented, title);
      assert.deepEqual(commands, [{ command, value: null, focused: true }], title);
      assert.equal(t.writes.length, writes + 1, `${title} writes the notes`);
    }
  } finally {
    await t.view.unmount();
  }
});

it('Insert link: a web address becomes a link in the notes; one that is not a link is refused with a message; Cancel does nothing', async () => {
  const t = notesTab({ id: 'a', notes: '<p>Portfolio</p>' });
  try {
    const { window, document } = t.view;
    const commands = recordCommands(document, t.box());
    const alerts = [];
    window.alert = (message) => { alerts.push(message); };
    const link = t.tool('Insert link');

    window.prompt = () => 'github.com/ada-dev';
    t.fire(link, 'onMouseDown');
    assert.deepEqual(commands, [{ command: 'createLink', value: 'https://github.com/ada-dev', focused: true }]);
    assert.equal(t.writes.length, 1);

    window.prompt = () => 'javascript:alert(1)';
    t.fire(link, 'onMouseDown');
    window.prompt = () => null; // Cancel
    t.fire(link, 'onMouseDown');
    window.prompt = () => '   ';
    t.fire(link, 'onMouseDown');
    assert.deepEqual(alerts, ['That is not a web, e-mail or phone link.']);
    assert.equal(commands.length, 1, 'no link command for any of them');
    assert.equal(t.writes.length, 1, 'and nothing written');
  } finally {
    await t.view.unmount();
  }
});

it('a paste goes in cleaned — no colours, fonts or scripts, plain text line by line — and the notes are written after it', async () => {
  const t = notesTab({ id: 'a', notes: '<p>Offer</p>' });
  try {
    const box = t.box();
    const commands = recordCommands(t.view.document, box);
    const html = '<span style="color: red; font-family: Papyrus">Salary</span> <b>80k</b><script>alert(1)</script>';
    const clipboard = (data) => ({ clipboardData: { getData: (type) => data[type] ?? '' } });
    const paste = t.fire(box, 'onPaste', ev(clipboard({ 'text/html': html, 'text/plain': 'Salary 80k' })));
    assert.ok(paste.defaultPrevented, 'the browser does not paste the original as well');
    assert.deepEqual(commands.map((c) => [c.command, c.value]), [['insertHTML', 'Salary <strong>80k</strong>']]);
    assert.equal(t.writes.length, 1);

    t.fire(box, 'onPaste', ev(clipboard({ 'text/plain': 'Base 80k\nBonus <10%' })));
    assert.deepEqual(commands[1] && [commands[1].command, commands[1].value], ['insertHTML', 'Base 80k<br>Bonus &lt;10%']);
    assert.equal(t.writes.length, 2);
  } finally {
    await t.view.unmount();
  }
});

it('the STAR Optimizer\'s Apply, with no caret in the notes, adds its statement as a new bullet and writes the notes', async () => {
  const t = notesTab({ id: 'a', notes: '<p>Call Ana</p>' });
  try {
    t.view.document.getSelection().removeAllRanges();
    t.fire(t.tool('Bullet Optimizer & STAR Formula Helper'), 'onMouseDown');
    const area = t.all().find((el) => el.tagName === 'TEXTAREA');
    assert.ok(area, 'the optimizer opens');
    t.fire(area, 'onChange', ev({ target: { value: 'Prepared a 3-person panel, cutting answer time 40%' } }));
    t.fire(t.all().find((el) => el.tagName === 'BUTTON' && el.textContent.includes('Apply to Resume')), 'onClick');

    const box = t.box();
    assert.deepEqual(tagsIn(box), ['P', 'UL', 'LI']);
    assert.equal(box.lastChild.textContent, 'Prepared a 3-person panel, cutting answer time 40%');
    assert.deepEqual(t.writes, [['notes', '<p>Call Ana</p><ul><li>Prepared a 3-person panel, cutting answer time 40%</li></ul>']]);
    assert.equal(t.all().filter((el) => el.tagName === 'TEXTAREA').length, 0, 'and it closes');
  } finally {
    await t.view.unmount();
  }
});

it('clearing the notes writes "" — not the old notes — and the editor is left empty, placeholder showing', async () => {
  const t = notesTab({ id: 'a', notes: '<p>Call Ana</p><ul><li>Panel of 3</li></ul>' });
  try {
    const box = t.box();
    box.focus();
    box.replaceChildren(); // select all, Delete
    t.fire(box, 'onInput');
    assert.deepEqual(t.writes, [['notes', '']]);
    t.show({ id: 'a', notes: '' }); // the store hands the cleared notes back
    assert.equal(t.box().childNodes.length, 0);
  } finally {
    await t.view.unmount();
  }
});

it('another job\'s notes replace the editor\'s even while it has focus: each job gets its own editor (key={job.id})', async () => {
  const t = notesTab({ id: 'a', notes: '<p>Call Ana</p>' });
  try {
    t.box().focus();
    t.show({ id: 'b', notes: '<p>Email Bo</p>' });
    assert.equal(t.box().textContent, 'Email Bo');
    assert.deepEqual(t.writes, [], 'and nothing of one job is written to the other');
  } finally {
    await t.view.unmount();
  }
});

// ── On the job page, through the job store ───────────────────────────────────────────────────

const KEY = 'cpwtcv_jobs_v1';
const acme = {
  id: 'a', company: 'Acme', role: 'Dev', status: 'applied', url: '', location: '', salary: '', contact: '',
  appliedDate: '2026-09-01', deadline: '', resumeId: '', notes: '<p>Call Ana</p>', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt: 1,
};

function memoryStorage(entries = []) {
  const map = new Map(entries);
  return {
    get length() { return map.size; }, key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k),
  };
}

/** The job page of `job`, over storage holding it; `open(tab)` clicks a tab, `stored()` reads the job back. */
async function jobPage(job) {
  const { createElement: h } = await import('react');
  const { MemoryRouter, Routes, Route } = await import('react-router-dom');
  const { JobDetail } = await loadModule('/src/pages/JobDetail.jsx');
  const { _resetJobStoreForTest } = await loadModule('/src/hooks/useJobStore.js');
  globalThis.localStorage = memoryStorage([[KEY, JSON.stringify({ jobs: [job], dataVersion: 2 })]]);
  _resetJobStoreForTest();
  function App() {
    return h(MemoryRouter, { initialEntries: [`/jobs/${job.id}`] }, h(Routes, null,
      h(Route, { path: '/jobs/:id', element: h(JobDetail, { store: { appState: { resumes: [] } } }) })));
  }
  const view = dom.mount(App, {});
  const c = controls(view);
  const tab = (label) => c.all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === label);
  return {
    view, ...c,
    open: (label) => c.fire(tab(label), 'onClick'),
    stored: () => JSON.parse(globalThis.localStorage.getItem(KEY)).jobs.find((j) => j.id === job.id),
    done: async () => { await view.unmount(); delete globalThis.localStorage; },
  };
}

it('job page: typed notes are saved as typed, the editor is not rewritten under the caret, and they are there on coming back to the tab', async () => {
  const page = await jobPage(acme);
  try {
    page.open('Notes');
    const box = page.box();
    assert.equal(box.innerHTML, '<p>Call Ana</p>');
    box.focus();
    const typed = typeLine(box, 'Ask about the team');
    page.fire(box, 'onInput');
    assert.equal(page.stored().notes, '<p>Call Ana</p><div>Ask about the team</div>');
    assert.ok(page.stored().updatedAt > 1, 'saved as an edit');
    // The page re-rendered with the saved notes: rewriting the editor would have replaced the nodes
    // being typed in, and the caret with them.
    assert.ok(page.box() === box && box.contains(typed), 'the line being typed is still the one in the editor');
    assert.equal(box.innerHTML, '<p>Call Ana</p><div>Ask about the team</div>');

    page.open('Tasks');
    assert.ok(!page.box(), 'the Tasks tab has no notes editor');
    page.open('Notes');
    assert.equal(page.box().textContent, 'Call AnaAsk about the team');
    assert.deepEqual(tagsIn(page.box()), ['P', 'P'], 'shown as the editor\'s own HTML: the new line a paragraph');
  } finally {
    await page.done();
  }
});

it('job page: clearing the notes saves "", and the tab opens on an empty editor afterwards', async () => {
  const page = await jobPage(acme);
  try {
    page.open('Notes');
    const box = page.box();
    box.focus();
    box.replaceChildren();
    page.fire(box, 'onInput');
    assert.equal(page.stored().notes, '');
    page.open('Tasks');
    page.open('Notes');
    assert.equal(page.box().childNodes.length, 0, 'empty, placeholder showing — not the old notes');
  } finally {
    await page.done();
  }
});
