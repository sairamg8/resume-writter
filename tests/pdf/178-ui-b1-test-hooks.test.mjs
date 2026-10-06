// UI redesign, batch B1 (docs/tracking/ui-redesign/batches/B1.md, cluster test-spine): the no-visual-change
// data-testid hooks every later restyle selects by, so a screen can change its markup and the helpers keep
// working. The real EditorResumeTab (over the real store, as tests/pdf/resume-tab.mjs wires it), the real
// EditorModeBar and the real ResumeCard are mounted with react-dom/client over fake-dom.mjs, and each id
// must be on screen, once per thing it names: one section-card-<id> and one section-title-input per section,
// one entry-header and one entry-title per entry, one of each tab button, one resume-card and one
// resume-card-rename per card. Fictional people.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, loadModule, resume, section, experience } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { resumeTab, settle } from './resume-tab.mjs';
import { TID, tidOf, withTid } from './ui-selectors.mjs';

before(setup);
after(teardown);

/** Every data-testid under `container`, as a list (a repeat shows twice). */
const testids = (container) => [...elements(container)].map(tidOf).filter(Boolean);
const count = (container, id) => testids(container).filter((t) => t === id).length;

function fixture() {
  return resume({
    sections: [
      experience([{ company: 'Harbor Mutual', role: 'Senior Analyst' }, { company: 'Pinecrest Logistics', role: 'Analyst' }]),
      section('education', [{ institution: 'Lakeshore State University', degree: 'BA' }]),
      section('skills', [{ category: 'Tools', skills: 'SQL, Excel' }]),
    ],
  });
}

describe('B1 test hooks: the Resume tab', () => {
  it('has one section-card-<id> per section, each id once, and one title input in each', async () => {
    const r = fixture();
    const tab = await resumeTab(r);
    try {
      const ids = testids(tab.view.container);
      for (const s of r.sections) {
        assert.equal(ids.filter((t) => t === TID.sectionCard(s.id)).length, 1, `section-card-${s.id} is on screen once`);
      }
      assert.equal(ids.filter((t) => t.startsWith(TID.sectionCardPrefix)).length, r.sections.length, 'no other section-card id');
      assert.equal(ids.filter((t) => t === TID.sectionTitle).length, r.sections.length, 'one section-title-input per section');
      for (const s of r.sections) {
        const card = withTid(elements(tab.view.container), TID.sectionCard(s.id))[0];
        assert.equal(withTid(elements(card), TID.sectionTitle).length, 1, `${s.title}: its card holds its own title input`);
        assert.equal(withTid(elements(card), TID.sectionTitle)[0].value, s.title);
      }
    } finally { await tab.close(); }
  });

  it('has one entry-header and one entry-title per entry; a header opens its entry', async () => {
    const r = fixture();
    const tab = await resumeTab(r);
    try {
      const entries = r.sections.reduce((n, s) => n + s.items.length, 0);
      assert.equal(count(tab.view.container, TID.entryHeader), entries, 'one entry-header per entry');
      assert.equal(count(tab.view.container, TID.entryTitle), entries, 'one entry-title per entry');
      const exp = tab.card(r.sections[0].title);
      assert.equal(withTid(elements(exp), TID.entryTitle).length, 2, 'the Experience card holds its two entries');
      const [header] = withTid(elements(exp), TID.entryHeader);
      const fieldsBefore = [...elements(exp)].length;
      tab.click(header);
      await settle();
      assert.ok([...elements(tab.card(r.sections[0].title))].length > fieldsBefore, 'clicking the header opened the entry');
    } finally { await tab.close(); }
  });
});

describe('B1 test hooks: the editor mode bar', () => {
  it('has design-open, doc-switch-resume, doc-switch-letter and ats-open once each, on buttons that switch tabs', async () => {
    const { EditorModeBar } = await loadModule('/src/components/EditorHeader.jsx');
    const picked = [];
    const view = mount(EditorModeBar, { activeTab: 'resume', setActiveTab: (t) => picked.push(t) });
    try {
      await settle();
      for (const id of [TID.designOpen, TID.docSwitchResume, TID.docSwitchLetter, TID.atsOpen]) {
        const found = withTid(elements(view.container), id);
        assert.equal(found.length, 1, `${id} is on screen once`);
        assert.equal(found[0].tagName, 'BUTTON', `${id} is a button`);
      }
      const click = (id) => {
        const el = withTid(elements(view.container), id)[0];
        view.act(() => reactProps(el).onClick({ preventDefault() {}, stopPropagation() {} }));
      };
      click(TID.docSwitchLetter);
      click(TID.atsOpen);
      click(TID.docSwitchResume);
      assert.deepEqual(picked, ['coverletter', 'ats', 'resume']);
    } finally { await view.unmount(); }
  });
});

describe('B1 test hooks: the dashboard card', () => {
  it('has resume-card and resume-card-rename once on a card; the rename button starts renaming', async () => {
    const { ResumeCard } = await loadModule('/src/components/ResumeCard.jsx');
    const props = {
      resume: { id: 'resume_x', name: 'Harbor Pilot CV', updatedAt: 1, settings: {}, sections: [], personal: { name: 'Wren Calloway' } },
      onOpen() {}, onDuplicate() {}, onDelete() {}, onRename() {},
    };
    const view = mount(ResumeCard, props);
    try {
      await settle();
      const [card] = withTid(elements(view.container), TID.resumeCard);
      assert.equal(count(view.container, TID.resumeCard), 1, 'one resume-card');
      assert.ok(card.contains(withTid(elements(view.container), TID.resumeCardRename)[0]), 'the rename button is inside the card');
      assert.equal(count(view.container, TID.resumeCardRename), 1, 'one resume-card-rename');
      const rename = withTid(elements(view.container), TID.resumeCardRename)[0];
      view.act(() => reactProps(rename).onClick({ preventDefault() {}, stopPropagation() {} }));
      assert.equal(count(view.container, TID.resumeCardRename), 0, 'the rename box replaces the pencil');
      assert.ok([...elements(view.container)].some((el) => el.tagName === 'INPUT'), 'a name box is open');
    } finally { await view.unmount(); }
  });

  it('two cards each carry their own pair of ids', async () => {
    const { ResumeCard } = await loadModule('/src/components/ResumeCard.jsx');
    const card = (id, name) => createElement(ResumeCard, {
      key: id,
      resume: { id, name, updatedAt: 1, settings: {}, sections: [], personal: { name: 'Wren Calloway' } },
      onOpen() {}, onDuplicate() {}, onDelete() {}, onRename() {},
    });
    const Two = () => createElement('div', null, card('resume_a', 'First CV'), card('resume_b', 'Second CV'));
    const view = mount(Two, {});
    try {
      await settle();
      assert.equal(count(view.container, TID.resumeCard), 2);
      assert.equal(count(view.container, TID.resumeCardRename), 2);
    } finally { await view.unmount(); }
  });
});
