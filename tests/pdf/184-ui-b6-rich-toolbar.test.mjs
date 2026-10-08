// UI rebuild B6: the rich-text editor's toolbar, drawn with the design tokens, keeps every control it had —
// Bold, Italic, Underline, the two lists, the link, the four alignments and the STAR Optimizer — and each acts
// on the pointer going down, with the press cancelled so the editor keeps its caret and selection (a button
// that took focus would lose the selection the command is meant for). A link the app cannot print is refused
// with a message. Every rich-text field of an entry form carries the STAR button. A toolbar drawn with an old
// grey / blue / red / amber Tailwind colour is a screen that was not moved onto the tokens (negative twin).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, loadModule } from './harness.mjs';
import { mount, elements, reactProps, withInnerHtml } from './fake-dom.mjs';

let RichTextEditor;
before(async () => {
  await setup();
  withInnerHtml();
  ({ default: RichTextEditor } = await loadModule('/src/components/RichTextEditor.jsx'));
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
});
after(teardown);

const OLD_COLOUR = /(^|\s)(?:[a-z-]+:)*(?:text|bg|border|ring)-(?:gray|blue|red|amber)-\d/;
const noop = () => {};
/** An event as a React handler reads it; records preventDefault. */
const ev = () => ({ defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {} });

/** Every toolbar button, in the order it is drawn: title, then the command it runs. Written out. */
const TOOLS = [
  ['Bold (Ctrl+B)', 'bold'], ['Italic (Ctrl+I)', 'italic'], ['Underline (Ctrl+U)', 'underline'],
  ['Bullet list', 'insertUnorderedList'], ['Numbered list', 'insertOrderedList'],
  ['Insert link', null],
  ['Align left', 'justifyLeft'], ['Align center', 'justifyCenter'], ['Align right', 'justifyRight'], ['Justify', 'justifyFull'],
];
const STAR = 'Bullet Optimizer & STAR Formula Helper';

function field(props = {}) {
  const changes = [];
  const view = mount(RichTextEditor, { label: 'Description', value: '<p>Led the team</p>', onChange: (v) => changes.push(v), ...props });
  const all = () => [...elements(view.container)];
  const tool = (title) => all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === title);
  const box = () => all().find((el) => el.getAttribute('role') === 'textbox');
  const press = (el) => { const e = ev(); view.act(() => reactProps(el).onMouseDown(e)); return e; };
  /** document.execCommand recorded: the command, its value, and whether the editor had focus as it ran. */
  const commands = [];
  view.document.execCommand = (command, _ui, value) => {
    commands.push({ command, value, focused: view.document.activeElement === box() });
    return true;
  };
  return { view, changes, all, tool, box, press, commands };
}

describe('the toolbar keeps every control (B6)', () => {
  it('draws exactly these buttons, in this order, then the STAR Optimizer', async () => {
    const t = field();
    try {
      const titles = t.all().filter((el) => el.tagName === 'BUTTON').map((el) => el.getAttribute('title'));
      assert.deepEqual(titles, [...TOOLS.map(([title]) => title), STAR]);
      const star = t.tool(STAR);
      assert.match(star.textContent, /STAR Optimizer/);
    } finally { await t.view.unmount(); }
  });

  it('is labelled by its field: the label names the editing box; a bare editor takes the aria-label it is given', async () => {
    const t = field();
    try {
      const label = t.all().find((el) => el.tagName === 'LABEL');
      assert.equal(label.textContent, 'Description');
      assert.equal(t.box().getAttribute('aria-labelledby'), label.getAttribute('id') ?? reactProps(label).id);
    } finally { await t.view.unmount(); }
    const bare = field({ label: undefined, ariaLabel: 'Professional summary' });
    try {
      assert.equal(bare.box().getAttribute('aria-label'), 'Professional summary');
      assert.equal(bare.all().filter((el) => el.tagName === 'LABEL').length, 0);
    } finally { await bare.view.unmount(); }
  });
});

describe('each button acts on the pointer going down, without taking focus (B6)', () => {
  for (const [title, command] of TOOLS.filter(([, c]) => c)) {
    it(`${title}: cancels the press, runs ${command} on the focused editor, and stores the field`, async () => {
      const t = field();
      try {
        const btn = t.tool(title);
        assert.equal(btn.getAttribute('type'), 'button', 'it submits no form');
        assert.equal(reactProps(btn).onClick, undefined, 'no click handler: the pointer-down does the work');
        t.box().blur();
        const press = t.press(btn);
        assert.equal(press.defaultPrevented, true, 'preventDefault on the press keeps the caret and selection in the editor');
        assert.deepEqual(t.commands, [{ command, value: null, focused: true }]);
        assert.equal(t.changes.length, 1, 'the field is stored after the command');
      } finally { await t.view.unmount(); }
    });
  }

  it('the STAR button cancels its press too, and opens the optimizer without storing anything', async () => {
    const t = field();
    try {
      const body = () => [...elements(t.view.document.body)];
      assert.equal(body().filter((el) => el.tagName === 'TEXTAREA').length, 0, 'closed to start with');
      const press = t.press(t.tool(STAR));
      assert.equal(press.defaultPrevented, true);
      assert.equal(reactProps(t.tool(STAR)).onClick, undefined);
      assert.equal(body().filter((el) => el.tagName === 'TEXTAREA').length, 1, 'the optimizer opens');
      assert.deepEqual(t.changes, []);
      assert.deepEqual(t.commands, []);
    } finally { await t.view.unmount(); }
  });
});

describe('the link button (B6)', () => {
  it('a web address becomes a link: a bare domain gets https://', async () => {
    const t = field();
    try {
      t.view.window.prompt = () => 'github.com/ada-dev';
      t.press(t.tool('Insert link'));
      assert.deepEqual(t.commands, [{ command: 'createLink', value: 'https://github.com/ada-dev', focused: true }]);
      assert.equal(t.changes.length, 1);
    } finally { await t.view.unmount(); }
  });

  it('an e-mail or a phone link is accepted as it is', async () => {
    const t = field();
    try {
      for (const input of ['mailto:ada@example.com', 'tel:+15550100']) {
        t.view.window.prompt = () => input;
        t.press(t.tool('Insert link'));
      }
      assert.deepEqual(t.commands.map((c) => [c.command, c.value]), [['createLink', 'mailto:ada@example.com'], ['createLink', 'tel:+15550100']]);
    } finally { await t.view.unmount(); }
  });

  it('a script address is refused with "That is not a web, e-mail or phone link."; Cancel and a blank do nothing, quietly', async () => {
    const t = field();
    try {
      const alerts = [];
      t.view.window.alert = (m) => { alerts.push(m); };
      for (const input of ['javascript:alert(1)', 'data:text/html,<b>x</b>', null, '', '   ']) {
        t.view.window.prompt = () => input;
        t.press(t.tool('Insert link'));
      }
      assert.deepEqual(alerts, ['That is not a web, e-mail or phone link.', 'That is not a web, e-mail or phone link.']);
      assert.deepEqual(t.commands, [], 'no link command for any of them');
      assert.deepEqual(t.changes, [], 'and nothing stored');
    } finally { await t.view.unmount(); }
  });

  it('the prompt asks for the URL', async () => {
    const t = field();
    try {
      const asked = [];
      t.view.window.prompt = (q) => { asked.push(q); return null; };
      t.press(t.tool('Insert link'));
      assert.deepEqual(asked, ['Paste URL (e.g. https://github.com/you):']);
    } finally { await t.view.unmount(); }
  });
});

describe('the STAR button is on every rich-text field of the entry forms (B6)', () => {
  // The types whose form has a rich-text field: Experience, Education, Projects, Volunteering, Awards, Custom.
  for (const type of ['experience', 'education', 'projects', 'volunteering', 'awards', 'custom']) {
    it(`${type}: one toolbar with all ${TOOLS.length} controls and the STAR Optimizer for the one description`, async () => {
      const { SortableSection } = await loadModule('/src/components/SectionEditor.jsx');
      const r = resume({ sections: [section(type, [{}])] });
      const view = mount(SortableSection, {
        section: r.sections[0], template: r.template, settings: r.settings, justAdded: true,
        updateSection: noop, updateSectionSettings: noop, removeSection: noop, reorderItems: noop,
        addItem: noop, updateItem: noop, removeItem: noop,
      });
      try {
        const all = [...elements(view.container)];
        assert.equal(all.filter((el) => el.getAttribute('role') === 'textbox').length, 1, `${type}: one rich-text box`);
        const titles = all.filter((el) => el.tagName === 'BUTTON').map((el) => el.getAttribute('title'));
        assert.equal(titles.filter((x) => x === STAR).length, 1, `${type}: the STAR button`);
        for (const [title] of TOOLS) assert.equal(titles.filter((x) => x === title).length, 1, `${type}: ${title}`);
      } finally { await view.unmount(); }
    });
  }
});

describe('negative twin: the toolbar uses the design tokens (B6)', () => {
  it('no element of the editor, its toolbar or its box carries a grey, blue, red or amber Tailwind colour', async () => {
    const t = field({ value: '<p>Led <strong>the</strong> team</p>' });
    try {
      const old = t.all().filter((el) => OLD_COLOUR.test(el.getAttribute('class') ?? ''));
      assert.deepEqual(old.map((el) => `${el.tagName} ${el.getAttribute('class')}`), []);
      assert.match(t.tool('Bold (Ctrl+B)').getAttribute('class'), /text-cv-muted/);
      assert.match(t.tool(STAR).getAttribute('class'), /bg-cv-warn-soft/);
    } finally { await t.view.unmount(); }
  });
});
