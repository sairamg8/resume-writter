// UI rebuild B6: every section type's entry form, drawn with the design tokens, still offers exactly the
// fields it did. The expected labels are written out below for each of the 11 types, so a field dropped from
// one type (or one added without a decision) fails here, not just a count that moved. Also: the per-field eye
// where a form uses FieldRow, the month / year selects and the text fallback for a date they cannot hold, the
// "current" box that greys the End Date, Experience's Location, a skill's level list and a language's
// proficiency list.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const OLD_COLOUR = /(^|\s)(?:[a-z-]+:)*(?:text|bg|border|ring)-(?:gray|blue|red|amber)-\d/;
const noop = () => {};
const click = () => ({ preventDefault() {}, stopPropagation() {}, detail: 1, nativeEvent: {} });

/** The labels each type's open entry form shows, in order. Written out; never computed from the source. */
const FIELDS = {
  experience: ['Company', 'Job Title', 'Location', 'Start Date', 'End Date', 'Currently working here', 'Description'],
  education: ['Institution', 'Degree', 'Field of Study', 'Location', 'Start Date', 'End Date', 'Currently studying here', 'GPA (optional)', 'Description'],
  skills: ['Title / Category', 'Skills / Details'],
  projects: ['Project Name', 'URL (optional)', 'Technologies', 'Start Date', 'End Date', 'Ongoing project', 'Description'],
  languages: ['Language', 'Proficiency'],
  certifications: ['Certification Name', 'Issuing Organization', 'Issue Date', 'Expiry Date', 'Credential ID (optional)', 'Link URL (optional)'],
  awards: ['Award Title', 'Issuing Organization', 'Date', 'Description (optional)'],
  volunteering: ['Organization', 'Role', 'Location', 'Start Date', 'End Date', 'Currently volunteering here', 'Description'],
  references: ['Name', 'Job Title', 'Company', 'Relationship', 'Email', 'Phone'],
  interests: ['Interests'],
  custom: ['Title', 'Subtitle', 'Date / Period', 'Location', 'Description'],
};

/**
 * SortableSection for one entry of `type` (merged over the blank one), its first entry opened as Add Section
 * opens it. `calls` collects the store updates; `form()` is what the entry shows.
 */
async function editor(type, item = {}) {
  const { SortableSection } = await loadModule('/src/components/SectionEditor.jsx');
  const r = resume({ sections: [section(type, [item])] });
  const calls = [];
  const props = (s) => ({
    section: s, template: r.template, settings: r.settings, justAdded: true,
    updateSection: noop, updateSectionSettings: noop, removeSection: noop, reorderItems: noop,
    addItem: noop, removeItem: noop, duplicateItem: noop,
    updateItem: (sid, iid, fn) => calls.push(fn(s.items[0])),
  });
  const view = mount(SortableSection, props(r.sections[0]));
  const all = () => [...elements(view.container)];
  const body = () => {
    const head = all().find((e) => e.getAttribute('data-testid') === 'entry-header');
    return head ? head.parentNode : view.container; // the one-line rows have no card
  };
  const label = (name) => all().find((e) => e.tagName === 'LABEL' && text(e) === name);
  /** The control a label names: through its htmlFor, as the browser does. */
  const control = (name) => {
    const l = label(name);
    const id = l && reactProps(l).htmlFor;
    return id && all().find((e) => reactProps(e)?.id === id);
  };
  return { view, calls, item: r.sections[0].items[0], all, body, label, control, section: r.sections[0] };
}

/** The labels of the open form: its <label>s, plus the aria-labelled text boxes and lists of the one-line rows. */
function fieldNames(t) {
  const names = [];
  for (const e of elements(t.body())) {
    if (e.tagName === 'LABEL') names.push(text(e));
    else if ((e.tagName === 'INPUT' || e.tagName === 'SELECT') && e.getAttribute('aria-label')
      && e.getAttribute('aria-label') !== 'Section title'
      && !/ (month|year)$|^(Month|Year)$|^Level of /.test(e.getAttribute('aria-label'))) names.push(e.getAttribute('aria-label'));
  }
  return names;
}

describe('every entry form offers its fields (B6)', () => {
  it('the hard-coded list covers exactly the 11 section types', async () => {
    const { SECTION_TYPE_DEFAULTS } = await loadModule('/src/utils/defaultData.js');
    assert.deepEqual(Object.keys(FIELDS).sort(), Object.keys(SECTION_TYPE_DEFAULTS).sort());
    assert.equal(Object.keys(FIELDS).length, 11);
  });

  for (const type of Object.keys(FIELDS)) {
    it(`${type}: the open entry shows exactly ${FIELDS[type].length} labelled fields`, async () => {
      const t = await editor(type);
      try {
        assert.deepEqual(fieldNames(t), FIELDS[type]);
      } finally { await t.view.unmount(); }
    });
  }

  it('a certification with a link also asks for its label', async () => {
    const t = await editor('certifications', { url: 'https://example.com/c' });
    try {
      assert.deepEqual(fieldNames(t), [...FIELDS.certifications, 'Link label (optional)']);
    } finally { await t.view.unmount(); }
  });

  it('the cards open by a click on the header too, and shut again', async () => {
    const { SortableSection } = await loadModule('/src/components/SectionEditor.jsx');
    const r = resume({ sections: [section('education', [{ institution: 'Harbor College' }])] });
    const view = mount(SortableSection, {
      section: r.sections[0], template: r.template, settings: r.settings, updateSection: noop, updateSectionSettings: noop,
      removeSection: noop, addItem: noop, updateItem: noop, removeItem: noop, reorderItems: noop,
    });
    try {
      const labels = () => [...elements(view.container)].filter((e) => e.tagName === 'LABEL').map(text);
      assert.deepEqual(labels(), []);
      const head = [...elements(view.container)].find((e) => e.getAttribute('data-testid') === 'entry-header');
      view.act(() => reactProps(head).onClick(click()));
      assert.deepEqual(labels(), FIELDS.education);
      view.act(() => reactProps(head).onClick(click()));
      assert.deepEqual(labels(), []);
    } finally { await view.unmount(); }
  });
});

describe('a field text box writes what is typed (B6)', () => {
  it('Experience: Company, Job Title and Location each write their own key and keep the rest', async () => {
    const t = await editor('experience', { company: 'Acme', role: 'Pilot' });
    try {
      for (const [name, key, value] of [['Company', 'company', 'Beta'], ['Job Title', 'role', 'Navigator'], ['Location', 'location', 'Lisbon']]) {
        t.calls.length = 0;
        const box = t.control(name);
        assert.ok(box, `${name} has a text box its label names`);
        t.view.act(() => reactProps(box).onChange({ target: { value } }));
        assert.equal(t.calls[0][key], value, name);
        assert.equal(t.calls[0].id, t.item.id);
      }
    } finally { await t.view.unmount(); }
  });
});

describe('the per-field eye (B6)', () => {
  const EYES = {
    experience: ['company', 'role', 'location', 'startDate', 'endDate', 'description'],
    skills: ['category', 'skills'],
  };

  for (const type of Object.keys(FIELDS)) {
    it(`${type}: ${EYES[type] ? `one eye for each of ${EYES[type].length} fields` : 'no field eyes (the form does not use FieldRow)'}`, async () => {
      const t = await editor(type);
      try {
        const eyes = t.all().filter((e) => e.tagName === 'BUTTON' && /^(Hide field from resume|Show field on resume)$/.test(e.getAttribute('title')));
        assert.equal(eyes.length, (EYES[type] ?? []).length);
      } finally { await t.view.unmount(); }
    });
  }

  it('each eye hides its own field; a hidden field offers "Show field on resume" and is dimmed', async () => {
    const t = await editor('experience', { company: 'Acme', hiddenFields: ['location'] });
    try {
      const eyes = t.all().filter((e) => e.tagName === 'BUTTON' && /field/.test(e.getAttribute('title')));
      assert.deepEqual(eyes.map((e) => e.getAttribute('title')), [
        'Hide field from resume', 'Hide field from resume', 'Show field on resume',
        'Hide field from resume', 'Hide field from resume', 'Hide field from resume',
      ]);
      const row = (eye) => eye.parentNode.parentNode;
      assert.match(row(eyes[2]).getAttribute('class'), /opacity-50/);
      assert.doesNotMatch(row(eyes[0]).getAttribute('class') ?? '', /opacity-50/);
      t.view.act(() => reactProps(eyes[0]).onClick(click()));
      assert.deepEqual(t.calls[0].hiddenFields, ['location', 'company']);
      t.view.act(() => reactProps(eyes[2]).onClick(click()));
      assert.deepEqual(t.calls[1].hiddenFields, [], 'the shown field leaves the list');
    } finally { await t.view.unmount(); }
  });
});

describe('dates: month and year selects, with a text fallback (B6)', () => {
  const selectsOf = (t, name) => t.all().filter((e) => e.tagName === 'SELECT' && e.getAttribute('aria-label')?.startsWith(name));

  it('Start Date and End Date each have a month and a year select; month lists Jan to Dec, year starts newest first', async () => {
    const t = await editor('experience', { startDate: 'Mar 2021' });
    try {
      const [month, year] = selectsOf(t, 'Start Date');
      assert.equal(month.getAttribute('aria-label'), 'Start Date month');
      assert.equal(year.getAttribute('aria-label'), 'Start Date year');
      assert.deepEqual([...elements(month)].filter((e) => e.tagName === 'OPTION').map(text),
        ['Month', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
      const years = [...elements(year)].filter((e) => e.tagName === 'OPTION').map(text);
      assert.equal(years[0], 'Year');
      assert.ok(Number(years[1]) > Number(years[2]) && years.includes('2021') && years.includes('1980'), 'newest first, back past 1980');
      assert.equal(reactProps(month).value, 'Mar');
      assert.equal(reactProps(year).value, '2021');
      assert.equal(selectsOf(t, 'End Date').length, 2);
      t.view.act(() => reactProps(month).onChange({ target: { value: 'Jun' } }));
      assert.equal(t.calls[0].startDate, 'Jun 2021');
      t.view.act(() => reactProps(year).onChange({ target: { value: '2019' } }));
      assert.equal(t.calls[1].startDate, 'Mar 2019');
    } finally { await t.view.unmount(); }
  });

  it('a period the selects cannot hold shows as a text box with the stored text, in every form that has dates', async () => {
    const period = 'Jan 2020 – Mar 2021';
    const keys = {
      experience: ['startDate', 'Start Date'], education: ['startDate', 'Start Date'], projects: ['startDate', 'Start Date'],
      volunteering: ['startDate', 'Start Date'], certifications: ['date', 'Issue Date'], awards: ['date', 'Date'],
      custom: ['date', 'Date / Period'],
    };
    for (const [type, [key, name]] of Object.entries(keys)) {
      const t = await editor(type, { [key]: period });
      try {
        const boxes = t.all().filter((e) => e.tagName === 'INPUT' && reactProps(e)?.value === period);
        assert.equal(boxes.length, 1, `${type}: the text box holding the period`);
        assert.equal(selectsOf(t, name).length, 0, `${type}: and no select for it`);
        t.view.act(() => reactProps(boxes[0]).onChange({ target: { value: '2019 – 2021' } }));
        assert.equal(t.calls[0][key], '2019 – 2021', `${type}: typing writes the text as typed`);
      } finally { await t.view.unmount(); }
    }
  });

  it('a certification has Issue and Expiry; an award one Date; custom a Date / Period', async () => {
    for (const [type, names] of [['certifications', ['Issue Date', 'Expiry Date']], ['awards', ['Date']], ['custom', ['Date / Period']]]) {
      const t = await editor(type);
      try {
        for (const name of names) assert.equal(selectsOf(t, name).length, 2, `${type}: ${name} month and year`);
      } finally { await t.view.unmount(); }
    }
  });
});

describe('the current box (B6)', () => {
  it('"Currently working here" ticked greys out the End Date, which then reads blank; the stored End Date is kept', async () => {
    const t = await editor('experience', { startDate: 'Jan 2020', endDate: 'Jun 2022', current: true });
    try {
      const endMonth = t.all().find((e) => e.getAttribute('aria-label') === 'End Date month');
      const startMonth = t.all().find((e) => e.getAttribute('aria-label') === 'Start Date month');
      const wrap = (select) => select.parentNode.parentNode;
      assert.match(wrap(endMonth).getAttribute('class'), /pointer-events-none/);
      assert.match(wrap(endMonth).getAttribute('class'), /opacity-40/);
      assert.equal(reactProps(endMonth).value, '', 'it shows nothing while current');
      assert.doesNotMatch(wrap(startMonth).getAttribute('class') ?? '', /pointer-events-none/);
      const box = t.all().find((e) => e.tagName === 'INPUT' && e.getAttribute('type') === 'checkbox');
      assert.equal(reactProps(box).checked, true);
      t.view.act(() => reactProps(box).onChange({ target: { checked: false } }));
      assert.equal(t.calls[0].current, false);
      assert.equal(t.calls[0].endDate, 'Jun 2022', 'unticked, the End Date comes back (nothing erased)');
    } finally { await t.view.unmount(); }
  });

  it('unticked, the End Date can be picked; ticking it writes current: true', async () => {
    const t = await editor('experience', { endDate: 'Jun 2022' });
    try {
      const endMonth = t.all().find((e) => e.getAttribute('aria-label') === 'End Date month');
      assert.doesNotMatch(endMonth.parentNode.parentNode.getAttribute('class') ?? '', /pointer-events-none/);
      assert.equal(reactProps(endMonth).value, 'Jun');
      const box = t.all().find((e) => e.tagName === 'INPUT' && e.getAttribute('type') === 'checkbox');
      t.view.act(() => reactProps(box).onChange({ target: { checked: true } }));
      assert.equal(t.calls[0].current, true);
    } finally { await t.view.unmount(); }
  });

  it('education, projects and volunteering have the box too, each worded for its form, and grey their End Date', async () => {
    for (const [type, words] of [['education', 'Currently studying here'], ['projects', 'Ongoing project'], ['volunteering', 'Currently volunteering here']]) {
      const t = await editor(type, { current: true });
      try {
        assert.ok(t.label(words), `${type}: "${words}"`);
        const endMonth = t.all().find((e) => e.getAttribute('aria-label') === 'End Date month');
        assert.match(endMonth.parentNode.parentNode.getAttribute('class'), /pointer-events-none/, type);
      } finally { await t.view.unmount(); }
    }
  });
});

describe('skill levels and the language row (B6)', () => {
  it('a skill group lists a level select for each skill named, once each; none while no skill is named', async () => {
    const none = await editor('skills', { category: 'Front end', skills: '' });
    try {
      assert.equal(none.all().filter((e) => /^Level of /.test(e.getAttribute('aria-label') ?? '')).length, 0);
    } finally { await none.view.unmount(); }
    const t = await editor('skills', { category: 'Front end', skills: 'React, Node, React', skillLevels: { React: 4 } });
    try {
      const levels = t.all().filter((e) => /^Level of /.test(e.getAttribute('aria-label') ?? ''));
      assert.deepEqual(levels.map((e) => e.getAttribute('aria-label')), ['Level of React', 'Level of Node']);
      assert.deepEqual([...elements(levels[0])].filter((e) => e.tagName === 'OPTION').map(text),
        ['Not set', 'Beginner', 'Basic', 'Intermediate', 'Advanced', 'Expert']);
      assert.equal(String(reactProps(levels[0]).value), '4', 'React shows its stored level');
      assert.equal(reactProps(levels[1]).value, '', 'Node is Not set');
      t.view.act(() => reactProps(levels[1]).onChange({ target: { value: '5' } }));
      assert.deepEqual(t.calls[0].skillLevels, { React: 4, Node: 5 });
      t.view.act(() => reactProps(levels[0]).onChange({ target: { value: '' } }));
      assert.deepEqual(t.calls[1].skillLevels, undefined, 'Not set on the only level left drops the key');
      assert.ok(text(t.body()).includes('Skill levels'));
    } finally { await t.view.unmount(); }
  });

  it('a language row has a text box and a proficiency list: Not set, Native to Basic; an unusual level is listed too', async () => {
    const t = await editor('languages', { language: 'Spanish', proficiency: 'Fluent' });
    try {
      const name = t.all().find((e) => e.getAttribute('aria-label') === 'Language');
      const level = t.all().find((e) => e.getAttribute('aria-label') === 'Proficiency');
      assert.equal(reactProps(name).value, 'Spanish');
      assert.deepEqual([...elements(level)].filter((e) => e.tagName === 'OPTION').map(text),
        ['Not set', 'Native', 'Fluent', 'Professional', 'Intermediate', 'Basic']);
      assert.equal(reactProps(level).value, 'Fluent');
      t.view.act(() => reactProps(level).onChange({ target: { value: 'Native' } }));
      assert.equal(t.calls[0].proficiency, 'Native');
      t.view.act(() => reactProps(name).onChange({ target: { value: 'Catalan' } }));
      assert.equal(t.calls[1].language, 'Catalan');
    } finally { await t.view.unmount(); }
    const odd = await editor('languages', { language: 'French', proficiency: 'C1' });
    try {
      const level = odd.all().find((e) => e.getAttribute('aria-label') === 'Proficiency');
      assert.deepEqual([...elements(level)].filter((e) => e.tagName === 'OPTION').map(text).slice(-1), ['C1']);
      assert.equal(reactProps(level).value, 'C1');
    } finally { await odd.view.unmount(); }
  });
});

describe('negative twin: every entry form uses the design tokens (B6)', () => {
  it('no element of any of the 11 open forms carries a grey, blue, red or amber Tailwind colour', async () => {
    for (const type of Object.keys(FIELDS)) {
      const t = await editor(type, { url: 'https://example.com', current: true, skills: 'React', hiddenFields: ['company'] });
      try {
        const old = t.all().filter((el) => OLD_COLOUR.test(el.getAttribute('class') ?? ''));
        assert.deepEqual(old.map((el) => `${type} ${el.tagName} ${el.getAttribute('class')}`), []);
      } finally { await t.view.unmount(); }
    }
  });
});
