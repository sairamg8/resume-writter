// R2-147 (a per-skill level) in the editor. A skill group's card lists each skill its text names with a
// level list beside it — Not set, then Beginner to Expert — drawn as the Language row's Proficiency list
// is, and writing the group's `skillLevels` ({ skill: 1-5 }). Not set writes nothing (the key goes); a level
// of a skill that was renamed or deleted goes with the next pick. Section Options → Style offers Bars, the
// style that draws the level (it was stored and printed, never offered). Fictional data only. Real
// components over the fake DOM (tests/pdf/fake-dom.mjs, loaded through Vite).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const leaf = () => loadModule('/src/components/SectionEditorLeafItems.jsx');
const item = (extra = {}) => ({ id: 'sk_1', category: 'Web', skills: 'Alpha, Bravo, Charlie', ...extra });

/** The level lists of a group's card as rendered: { skill, options: [{ value, label, selected }] }. */
async function lists(it) {
  const { SkillItem } = await leaf();
  const html = renderToStaticMarkup(createElement(SkillItem, { item: it, onUpdate() {}, onRemove() {}, defaultOpen: true }));
  return [...html.matchAll(/<select[^>]*aria-label="Level of ([^"]*)"[^>]*>([\s\S]*?)<\/select>/g)].map(([, skill, body]) => ({
    skill,
    options: [...body.matchAll(/<option([^>]*)>([^<]*)<\/option>/g)].map(([, attrs, label]) => ({
      value: /value="([^"]*)"/.exec(attrs)?.[1], label, selected: /\sselected(=|\s|$)/.test(attrs),
    })),
  }));
}

describe('the Skills editor: a level for each skill (R2-147)', () => {
  it('a list per skill the text names, each Not set then Beginner to Expert, in the text\'s order', async () => {
    const got = await lists(item());
    assert.deepEqual(got.map((l) => l.skill), ['Alpha', 'Bravo', 'Charlie']);
    for (const l of got) {
      assert.deepEqual(l.options.map((o) => [o.value, o.label]), [['', 'Not set'], ['1', 'Beginner'], ['2', 'Basic'], ['3', 'Intermediate'], ['4', 'Advanced'], ['5', 'Expert']], l.skill);
      assert.deepEqual(l.options.filter((o) => o.selected).map((o) => o.value), [''], `${l.skill} shows Not set`);
    }
  });

  it('each list shows the stored level; an invalid one, and a skill the text no longer names, show nothing', async () => {
    const got = await lists(item({ skills: 'Alpha, Bravo, Charlie', skillLevels: { Alpha: 5, Bravo: 9, Ghost: 3 } }));
    const shown = Object.fromEntries(got.map((l) => [l.skill, l.options.filter((o) => o.selected).map((o) => o.value)]));
    assert.deepEqual(shown, { Alpha: ['5'], Bravo: [''], Charlie: [''] });
    assert.ok(!got.some((l) => l.skill === 'Ghost'));
  });

  it('a skill named twice is listed once; a group with no skills has no list, and one with skills hidden keeps its lists, dimmed', async () => {
    assert.deepEqual((await lists(item({ skills: 'Alpha, Bravo, Alpha' }))).map((l) => l.skill), ['Alpha', 'Bravo']);
    assert.deepEqual(await lists(item({ skills: '' })), []);
    assert.deepEqual(await lists(item({ skills: ' , ' })), []);
    const { SkillItem } = await leaf();
    const html = renderToStaticMarkup(createElement(SkillItem, { item: item({ hiddenFields: ['skills'], skillLevels: { Alpha: 2 } }), onUpdate() {}, onRemove() {}, defaultOpen: true }));
    assert.match(html, /<div class="opacity-50"><div class="text-xs text-cv-muted mb-1">Skill levels/);
    assert.match(html, /aria-label="Level of Alpha"/);
  });

  it('picking a level writes it to the group, keeping the text and the other levels', async () => {
    const { SkillItem } = await leaf();
    const written = [];
    const view = mount(SkillItem, { item: item({ skillLevels: { Alpha: 2 } }), onUpdate: (next) => written.push(next), onRemove() {}, defaultOpen: true });
    try {
      const select = (skill) => [...elements(view.container)].find((el) => el.tagName === 'SELECT' && el.getAttribute('aria-label') === `Level of ${skill}`);
      assert.ok(select('Charlie'), 'the level list of Charlie');
      view.act(() => reactProps(select('Charlie')).onChange({ target: { value: '5' } }));
      assert.deepEqual(written.at(-1), item({ skillLevels: { Alpha: 2, Charlie: 5 } }));
      // The store hands the written group back; the next pick builds on it.
      view.update({ item: written.at(-1), onUpdate: (next) => written.push(next), onRemove() {}, defaultOpen: true });
      view.act(() => reactProps(select('Alpha')).onChange({ target: { value: '4' } }));
      assert.deepEqual(written.at(-1).skillLevels, { Alpha: 4, Charlie: 5 });
    } finally {
      await view.unmount();
    }
  });

  it('Not set clears it, and the last one takes the key with it', async () => {
    const { SkillItem } = await leaf();
    const written = [];
    const view = mount(SkillItem, { item: item({ skillLevels: { Alpha: 2, Bravo: 3 } }), onUpdate: (next) => written.push(next), onRemove() {}, defaultOpen: true });
    try {
      const select = (skill) => [...elements(view.container)].find((el) => el.tagName === 'SELECT' && el.getAttribute('aria-label') === `Level of ${skill}`);
      view.act(() => reactProps(select('Alpha')).onChange({ target: { value: '' } }));
      assert.deepEqual(written.at(-1).skillLevels, { Bravo: 3 });
      view.update({ item: written.at(-1), onUpdate: (next) => written.push(next), onRemove() {}, defaultOpen: true });
      view.act(() => reactProps(select('Bravo')).onChange({ target: { value: '' } }));
      assert.deepEqual(written.at(-1), item());
      assert.ok(!('skillLevels' in written.at(-1)), 'no empty skillLevels is stored');
    } finally {
      await view.unmount();
    }
  });

  it('a level of a skill that was renamed is dropped with the next pick, not carried to the new name', async () => {
    const { SkillItem } = await leaf();
    const written = [];
    // "Bravo" was retyped as "Bravo2": its level is not Bravo2's.
    const view = mount(SkillItem, { item: item({ skills: 'Alpha, Bravo2', skillLevels: { Alpha: 2, Bravo: 5 } }), onUpdate: (next) => written.push(next), onRemove() {}, defaultOpen: true });
    try {
      const select = (skill) => [...elements(view.container)].find((el) => el.tagName === 'SELECT' && el.getAttribute('aria-label') === `Level of ${skill}`);
      assert.deepEqual(reactProps(select('Bravo2')).value, '', 'Bravo2 shows Not set');
      view.act(() => reactProps(select('Alpha')).onChange({ target: { value: '3' } }));
      assert.deepEqual(written.at(-1).skillLevels, { Alpha: 3 });
    } finally {
      await view.unmount();
    }
  });
});

describe('Section Options → Style offers Bars, the style that draws a level (R2-147)', () => {
  it('Skills\' Style row lists Inline, Stacked, Bullet, Tags and Bars; Bars writes skillsStyle "bars"', async () => {
    const { SectionCustomizer } = await loadModule('/src/components/SectionEditorCustomizer.jsx');
    const writes = [];
    const view = mount(SectionCustomizer, {
      section: { id: 'sec_skills', type: 'skills', title: 'Skills', visible: true, settings: { skillsStyle: 'inline' }, items: [] },
      template: 'classic', settings: {}, updateSectionSettings: (...args) => writes.push(args),
    });
    try {
      const row = [...elements(view.container)].find((el) => el.tagName === 'DIV' && el.childNodes.length === 2 && el.childNodes[0].tagName === 'SPAN' && el.childNodes[0].textContent.trim() === 'Style');
      assert.ok(row, 'the Style row');
      const chips = row.childNodes[1].childNodes.filter((c) => c.tagName === 'BUTTON');
      assert.deepEqual(chips.map((b) => b.textContent.trim()), ['Inline', 'Stacked', 'Bullet', 'Tags', 'Bars']);
      view.act(() => reactProps(chips[4]).onClick());
      assert.deepEqual(writes, [['sec_skills', 'skillsStyle', 'bars']]);
    } finally {
      await view.unmount();
    }
  });
});
