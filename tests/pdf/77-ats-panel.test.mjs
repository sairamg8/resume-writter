// The ATS Check tab's buttons, clicked, over the real store (R2-163, R2-166): what each one writes is
// what the app saves. tests/pdf/56 and 58 cover the layout and heading fixes; this file covers the rest
// of the tab, each against the row that found it broken:
//   - "Print entries one under another (Grids 1)", the side-by-side warning's fix (R2-021);
//   - the job-description scanner's "+", which wrote into a hidden skill group (R2-024, R2-081);
//   - "Put Job Title First", which rewrote hidden sections the report never inspected (R2-079);
//   - Copy Text and the .txt download, and Copy failing silently where the clipboard is refused, here
//     and in the STAR Optimizer (R2-080).
//
// The panel is mounted as Editor.jsx mounts it — the real useAppStore as its `store`, the résumé that
// store holds as its `resume` — through react-dom/client in tests/pdf/fake-dom.mjs, with an in-memory
// localStorage, as tests/pdf/56-ats-layout-fix-buttons.test.mjs does.
import { before, after, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, resume, section, loadModule, render, read, allText } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const KEY = 'cpwtcv_v1';

/** A localStorage stand-in. */
class MemoryStorage {
  constructor(entries) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

/**
 * The ATS Check tab over a saved `r`. Returns `labels()` (every button's text), `click(label)` (a
 * button by its text), `paste(jd)` (types a job description into the scanner), `chips(kind)`
 * (the scanner's 'missing' keyword buttons or 'matched' keyword chips, by text), `saved()` (the
 * résumé the store now holds), `view` and `unmount()`.
 */
async function atsTab(r) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { default: AtsCheckerPanel } = await loadModule('/src/components/AtsCheckerPanel.jsx');
  globalThis.localStorage = new MemoryStorage([[KEY, JSON.stringify({ resumes: [r], activeId: r.id })]]);
  // The panel's buttons flash "done" for two seconds (setTimeout): the clock is the test's, and runs
  // out before the tab unmounts, so no timer fires after it.
  mock.timers.reset();
  mock.timers.enable({ apis: ['setTimeout'] });
  let store = null;
  function AtsTab() {
    store = useAppStore();
    return createElement(AtsCheckerPanel, { resume: store.activeResume, store });
  }
  const view = mount(AtsTab, {});
  const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
  const all = () => [...elements(view.container)];
  const buttons = () => all().filter((el) => el.tagName === 'BUTTON');
  return {
    view,
    labels: () => buttons().map(text),
    button: (label) => buttons().find((el) => text(el) === label),
    click(label) {
      // By its whole text, or by its start: a category header carries its score.
      const button = buttons().find((el) => text(el) === label) ?? buttons().find((el) => text(el).startsWith(label));
      assert.ok(button, `no button reads "${label}" — the panel offers: ${buttons().map(text).join(' | ')}`);
      view.act(() => reactProps(button).onClick());
    },
    paste(jd) {
      const box = all().find((el) => el.tagName === 'TEXTAREA');
      view.act(() => reactProps(box).onChange({ target: { value: jd } }));
    },
    chips(kind) {
      const els = kind === 'missing'
        ? buttons().filter((el) => el.getAttribute('title') === 'Click to add to Skills')
        : all().filter((el) => el.tagName === 'SPAN' && /bg-emerald-50 text-emerald-800/.test(el.getAttribute('class') || ''));
      return els.map(text);
    },
    saved: () => store.appState.resumes[0],
    async unmount() {
      view.act(() => mock.timers.runAll());
      mock.timers.reset();
      await view.unmount();
      delete globalThis.localStorage;
    },
  };
}

const byId = (r, id) => r.sections.find((s) => s.id === id);

describe('ATS Check → entries printed side by side: its fix sets Grids 1 on those sections only (R2-021)', () => {
  const GRIDS_ONE = 'Print entries one under another (Grids 1)';
  const gridResume = () => resume({
    template: 'classic',
    sections: [
      { ...section('experience', [{ company: 'Acme', role: 'Engineer' }, { company: 'Initech', role: 'Engineer' }], { columns: 2, spacing: 'compact' }), id: 'exp' },
      { ...section('skills', [{ category: 'Tools', skills: 'Go' }, { category: 'Cloud', skills: 'AWS' }], { columns: 2 }), id: 'sk' },
    ],
  });

  it('offers the fix in the quick fixes and on the warning, and it writes Grids 1 on the experience alone', async () => {
    const tab = await atsTab(gridResume());
    try {
      assert.ok(tab.labels().includes(GRIDS_ONE), `the fix is offered — the panel offers: ${tab.labels().join(' | ')}`);
      tab.click('ATS Layout & Parser Safety');
      assert.equal(tab.labels().filter((l) => l === GRIDS_ONE).length, 2, 'in the quick fixes and on the warning');
      const before = tab.saved();
      tab.click(GRIDS_ONE);
      const after = tab.saved();
      assert.deepEqual(byId(after, 'exp').settings, { ...byId(before, 'exp').settings, columns: 1 }, 'Grids 1, every other option kept');
      assert.deepEqual(byId(after, 'sk'), byId(before, 'sk'), 'the skills grid is not the warning\'s');
      assert.equal(after.template, 'classic');
      assert.ok(!tab.labels().includes(GRIDS_ONE), 'the warning and its fix are gone');
    } finally { await tab.unmount(); }
  });
});

describe('Target Job Description Scanner → "+": the keyword goes where the résumé prints it (R2-024, R2-081)', () => {
  const JD = 'Kubernetes Kubernetes Kubernetes';
  const skills = (items, extra = {}) => ({ ...section('skills', items), id: 'sk', ...extra });
  const scanned = (sections) => resume({ template: 'classic', sections });

  /** Pastes the posting, clicks "+" on Kubernetes, and returns the tab. */
  async function addKubernetes(r) {
    const tab = await atsTab(r);
    tab.paste(JD);
    assert.deepEqual(tab.chips('missing'), ['Kubernetes'], 'Kubernetes is missing before the click');
    tab.click('Kubernetes');
    return tab;
  }

  /** Whether the saved résumé's PDF prints "Kubernetes". */
  async function prints(r) {
    return allText(await read(await render(r))).includes('Kubernetes');
  }

  const cases = {
    'the first group hidden with its eye': [
      { id: 'g1', category: 'Tools', skills: 'Go', visible: false },
      { id: 'g2', category: 'Cloud', skills: 'AWS' },
    ],
    'the first group\'s skills hidden with the eye beside them': [
      { id: 'g1', category: 'Tools', skills: 'Go', hiddenFields: ['skills'] },
      { id: 'g2', category: 'Cloud', skills: 'AWS' },
    ],
  };
  for (const [name, items] of Object.entries(cases)) {
    it(`${name}: it is written into the first group that prints, prints, and is matched`, async () => {
      const tab = await addKubernetes(scanned([skills(items)]));
      try {
        const saved = tab.saved();
        const [g1, g2] = byId(saved, 'sk').items;
        assert.equal(g1.skills, 'Go', 'the hidden group is left as it was');
        assert.equal(g2.skills, 'AWS, Kubernetes');
        assert.deepEqual(tab.chips('missing'), [], 'no longer missing');
        assert.deepEqual(tab.chips('matched'), ['Kubernetes']);
        assert.equal(await prints(saved), true, 'the PDF prints it');
      } finally { await tab.unmount(); }
    });
  }

  it('no group prints its skills: a new group is added to the shown section, and prints', async () => {
    const tab = await addKubernetes(scanned([skills([{ id: 'g1', category: 'Tools', skills: 'Go', visible: false }])]));
    try {
      const saved = tab.saved();
      const items = byId(saved, 'sk').items;
      assert.equal(items.length, 2);
      assert.equal(items[0].skills, 'Go');
      assert.equal(items[1].skills, 'Kubernetes');
      assert.deepEqual(tab.chips('matched'), ['Kubernetes']);
      assert.equal(await prints(saved), true);
    } finally { await tab.unmount(); }
  });

  it('a hidden Skills section is passed over for the shown one after it', async () => {
    const tab = await addKubernetes(scanned([
      skills([{ id: 'h1', category: 'Old', skills: 'Perl' }], { id: 'hid', visible: false }),
      skills([{ id: 'g1', category: 'Cloud', skills: 'AWS' }]),
    ]));
    try {
      const saved = tab.saved();
      assert.equal(byId(saved, 'hid').items[0].skills, 'Perl');
      assert.equal(byId(saved, 'sk').items[0].skills, 'AWS, Kubernetes');
      assert.deepEqual(tab.chips('matched'), ['Kubernetes']);
    } finally { await tab.unmount(); }
  });

  it('skills stored as a list (imported data) are kept, with the keyword after them', async () => {
    const tab = await addKubernetes(scanned([skills([{ id: 'g1', category: 'Cloud', skills: ['AWS', 'GCP'] }])]));
    try {
      assert.equal(byId(tab.saved(), 'sk').items[0].skills, 'AWS, GCP, Kubernetes');
      assert.deepEqual(tab.chips('matched'), ['Kubernetes']);
    } finally { await tab.unmount(); }
  });
});

describe('"Put Job Title First": it leads with the role on the sections the report read, and no other (R2-079)', () => {
  const TITLE_FIRST = 'Put Job Title First (Role / Co.)';
  const jobs = [{ company: 'Acme', role: 'Engineer' }];
  const exp = (id, settings = {}, extra = {}) => ({ ...section('experience', jobs, settings, extra), id });
  const order = (r, id) => byId(r, id).settings.titleOrder;

  it('a hidden experience section set to Co. / Role is left as it is', async () => {
    const tab = await atsTab(resume({ template: 'classic', sections: [
      exp('shown', { titleOrder: 'company' }),
      exp('hidden', { titleOrder: 'company' }, { visible: false }),
    ] }));
    try {
      const before = tab.saved();
      tab.click(TITLE_FIRST);
      const after = tab.saved();
      assert.equal(order(after, 'shown'), 'role');
      assert.deepEqual(byId(after, 'hidden'), byId(before, 'hidden'), 'the hidden section is not touched');
      assert.ok(!tab.labels().includes(TITLE_FIRST), 'the warning and its fix are gone');
    } finally { await tab.unmount(); }
  });

  it('a section that already leads with the role, by its own setting or its template\'s, is left as it is', async () => {
    const tab = await atsTab(resume({ template: 'classic', sections: [
      exp('co', { titleOrder: 'company' }),
      exp('role', { titleOrder: 'role' }),
      exp('unset', { titleOrder: undefined }),
    ] }));
    try {
      const before = tab.saved();
      tab.click(TITLE_FIRST);
      const after = tab.saved();
      assert.equal(order(after, 'co'), 'role');
      assert.deepEqual(byId(after, 'role'), byId(before, 'role'));
      assert.equal(order(after, 'unset'), 'role', 'unset on Classic prints the company first, so it is the report\'s too');
    } finally { await tab.unmount(); }
  });

  it('on Executive, whose jobs lead with the role unless set otherwise, only the Co. / Role section changes', async () => {
    const tab = await atsTab(resume({ template: 'executive', sections: [
      exp('co', { titleOrder: 'company' }),
      exp('unset', { titleOrder: undefined }),
    ] }));
    try {
      const before = tab.saved();
      tab.click(TITLE_FIRST);
      const after = tab.saved();
      assert.equal(order(after, 'co'), 'role');
      assert.deepEqual(byId(after, 'unset'), byId(before, 'unset'), 'Executive already prints it role first');
    } finally { await tab.unmount(); }
  });
});

/**
 * `navigator.clipboard` for the length of `fn`: `writeText` resolves and records what it was given,
 * or rejects as a browser that denies clipboard-write does; `clipboard: null` is a page with no
 * clipboard at all (an insecure origin).
 */
async function withClipboard(mode, fn) {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const written = [];
  const clipboard = mode === 'none' ? undefined : {
    writeText: (text) => (mode === 'deny'
      ? Promise.reject(new Error('NotAllowedError: Write permission denied.'))
      : Promise.resolve(written.push(text))),
  };
  Object.defineProperty(globalThis, 'navigator', { value: { clipboard }, configurable: true, writable: true });
  try { await fn(written); } finally { Object.defineProperty(globalThis, 'navigator', saved); }
}

/** Lets the clipboard's promise settle, and React commit what it set. */
const settle = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((r) => { setImmediate(r); });
};

describe('ATS Plain Text: Copy Text and the .txt download (R2-080, R2-166)', () => {
  const plain = () => resume({ template: 'classic', personal: { name: 'Jonas Weber', email: 'jonas@example.com' }, sections: [
    section('experience', [{ company: 'Acme', role: 'Engineer', startDate: '2020-01', current: true }]),
  ] });

  it('Copy Text writes the ATS plain text, and says Copied!', async () => {
    await withClipboard('allow', async (written) => {
      const r = plain();
      const tab = await atsTab(r);
      try {
        const { generateAtsPlainText } = await loadModule('/src/utils/atsChecker.js');
        tab.click('Copy Text');
        await settle();
        assert.deepEqual(written, [generateAtsPlainText(tab.saved())]);
        assert.match(written[0], /JONAS WEBER/);
        assert.ok(tab.labels().includes('Copied!'));
      } finally { await tab.unmount(); }
    });
  });

  for (const [mode, why] of [['deny', 'the browser denies clipboard-write'], ['none', 'the page has no clipboard']]) {
    it(`${why}: the button says the copy failed and points to the download`, async () => {
      await withClipboard(mode, async () => {
        const tab = await atsTab(plain());
        try {
          tab.click('Copy Text');
          await settle();
          assert.ok(tab.labels().includes('Copy failed'), `the panel offers: ${tab.labels().join(' | ')}`);
          assert.match(tab.button('Copy failed').getAttribute('title'), /Download/);
          assert.ok(!tab.labels().includes('Copied!'));
        } finally { await tab.unmount(); }
      });
    });
  }

  /**
   * Clicks the tab's "Download .txt" over `r`: resolves with `clicks` (each download link's href and
   * file name), `blobs` (what each one saved) and the résumé the store holds.
   */
  async function downloadFromTab(r) {
    const tab = await atsTab(r);
    const saved = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    const blobs = [];
    const clicks = [];
    URL.createObjectURL = (blob) => { blobs.push(blob); return 'blob:ats'; };
    URL.revokeObjectURL = () => {};
    const { document } = tab.view;
    const createElement = document.createElement.bind(document);
    document.createElement = (tag) => Object.assign(createElement(tag), tag === 'a' ? { click() { clicks.push({ href: this.href, download: this.download }); } } : {});
    try {
      const button = [...elements(tab.view.container)].find((el) => el.getAttribute?.('title') === 'Download .txt');
      tab.view.act(() => reactProps(button).onClick());
      return { clicks, blobs, saved: tab.saved() };
    } finally {
      Object.assign(URL, { createObjectURL: saved.create, revokeObjectURL: saved.revoke });
      await tab.unmount();
    }
  }

  it('Download saves the ATS plain text, named as Export → ATS text names it: <Name>_<Title>_ATS.txt', async () => {
    const { generateAtsPlainText } = await loadModule('/src/utils/atsChecker.js');
    const { clicks, blobs, saved } = await downloadFromTab(plain());
    assert.deepEqual(clicks, [{ href: 'blob:ats', download: 'Jonas_Weber_Engineer_ATS.txt' }]);
    assert.equal(blobs[0].type, 'text/plain;charset=utf-8');
    assert.equal(await blobs[0].text(), generateAtsPlainText(saved));
  });

  // The same text file was named two ways: the tab's own download as `<name>_ATS.txt`, its spaces
  // made `_` and nothing trimmed, Export → ATS text as `<Name>_<Title>_ATS.txt` (buildExportFilename,
  // tests/pdf/60-export-filename.test.mjs). The tab now names it as the Export menu does, in each of
  // the cases 60 pins for the menu.
  for (const [personal, name, why] of [
    [{ name: '', title: 'Data Engineer' }, 'resume_Data_Engineer_ATS.txt', 'no name: "resume"'],
    [{ name: '   ', title: 'Data Engineer' }, 'resume_Data_Engineer_ATS.txt', 'a blank name: "resume", not "_"'],
    [{ name: '  Jonas   Weber ', title: ' Data Engineer  ' }, 'Jonas_Weber_Data_Engineer_ATS.txt', 'spaces around the name and title: no stray "_"'],
    [{ name: 'Jonas Weber', title: '' }, 'Jonas_Weber_ATS.txt', 'no title: the name alone'],
  ]) {
    it(`Download: ${why}, as the Export menu names it`, async () => {
      const r = plain();
      const { clicks } = await downloadFromTab({ ...r, personal: { ...r.personal, ...personal } });
      assert.deepEqual(clicks.map((c) => c.download), [name]);
    });
  }
});

describe('STAR Optimizer → Copy: a refused clipboard is said, not silent (R2-080)', () => {
  async function optimizer() {
    const { default: BulletOptimizerModal } = await loadModule('/src/components/BulletOptimizerModal.jsx');
    mock.timers.reset();
  mock.timers.enable({ apis: ['setTimeout'] });
    const view = mount(BulletOptimizerModal, { isOpen: true, onClose() {}, onApply() {}, initialText: 'Led 3 migrations' });
    const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
    const buttons = () => [...elements(view.container)].filter((el) => el.tagName === 'BUTTON');
    return {
      labels: () => buttons().map(text),
      button: (label) => buttons().find((el) => text(el) === label),
      click(label) { view.act(() => reactProps(buttons().find((el) => text(el) === label)).onClick()); },
      async unmount() {
        view.act(() => mock.timers.runAll());
        mock.timers.reset();
        await view.unmount();
      },
    };
  }

  it('allowed: it copies the statement and says Copied', async () => {
    await withClipboard('allow', async (written) => {
      const modal = await optimizer();
      try {
        modal.click('Copy');
        await settle();
        assert.deepEqual(written, ['Led 3 migrations']);
        assert.ok(modal.labels().includes('Copied'));
      } finally { await modal.unmount(); }
    });
  });

  for (const mode of ['deny', 'none']) {
    it(`${mode === 'deny' ? 'denied' : 'no clipboard'}: it says Copy failed`, async () => {
      await withClipboard(mode, async () => {
        const modal = await optimizer();
        try {
          modal.click('Copy');
          await settle();
          assert.ok(modal.labels().includes('Copy failed'), `the modal offers: ${modal.labels().join(' | ')}`);
          assert.match(modal.button('Copy failed').getAttribute('title'), /select/i);
        } finally { await modal.unmount(); }
      });
    });
  }
});
