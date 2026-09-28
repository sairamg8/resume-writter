// R4-DVIS-30 (Personal Info): a link field's Display label and Link URL boxes went side by side from a
// 640 px window up (`sm:flex-row`), whatever the editor panel's width. With the split panel dragged to
// 240–360 px the row was two text boxes of ~140 px each (no min-w-0) in about 174 px, and the card's
// overflow-hidden cut the URL box. The field is now a size container and the row goes side by side
// only once the field is 24rem wide (`@sm:flex-row`); both boxes can shrink (min-w-0). The container
// is each field, not the whole editor: the icon picker's fixed overlay is rendered at the editor's
// root and stays outside it. The fake DOM has no layout, so this pins the classes on the real
// PersonalInfoEditor, mounted with react-dom/client over tests/pdf/fake-dom.mjs. Fictional data.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, mount } from './fake-dom.mjs';

before(setup);
after(teardown);

const noop = () => {};
const tokens = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

it('a link\'s Display label and Link URL stack until the field itself is wide enough, and both boxes can shrink', async () => {
  const { default: PersonalInfoEditor } = await loadModule('/src/components/PersonalInfoEditor.jsx');
  const view = mount(PersonalInfoEditor, {
    personal: { name: 'Robin Vale', title: 'Harbor Pilot', website: 'robin.example.com', linkedin: 'linkedin.com/in/robin' },
    updatePersonal: noop, toggleFieldVisibility: noop, settings: {}, updateSetting: noop, clearSettings: noop,
    template: 'classic', coverLetter: {},
  });
  try {
    const all = [...elements(view.container)];
    const input = (name) => all.find((el) => el.tagName === 'INPUT' && el.getAttribute('aria-label') === name);
    const root = view.container.firstChild;
    assert.ok(!tokens(root).includes('@container'), 'the editor\'s root is no container: the icon picker\'s fixed overlay sits in it');
    for (const field of ['Website', 'LinkedIn']) {
      const label = input(`${field} display label`);
      const url = input(`${field} link URL`);
      assert.ok(label && url, `${field}: the Display label and Link URL boxes are on the panel`);
      for (const box of [label, url]) {
        const name = box.getAttribute('aria-label');
        assert.ok(tokens(box).includes('flex-1'), `${name}: the two share the row`);
        assert.ok(tokens(box).includes('min-w-0'), `${name}: without min-w-0 a text box keeps ~140 px and runs past a narrow card`);
      }
      const row = label.parentNode;
      assert.ok(url.parentNode === row, `${field}: the two boxes share one row`);
      assert.ok(tokens(row).includes('flex-col'), `${field}: stacked by default: ${tokens(row).join(' ')}`);
      assert.ok(tokens(row).includes('@sm:flex-row'), `${field}: side by side on the field's own width: ${tokens(row).join(' ')}`);
      assert.ok(!tokens(row).includes('sm:flex-row'), `${field}: not on the window's width, which is over 640 px beside a 240 px panel`);
      let container = row.parentNode;
      while (container && container !== root && !tokens(container).includes('@container')) container = container.parentNode;
      assert.ok(container && container !== root, `${field}: the row's size container is inside the editor`);
      const main = [...elements(container)].find((el) => el.tagName === 'INPUT' && el.getAttribute('placeholder') && !el.getAttribute('aria-label'));
      assert.ok(main && main.getAttribute('id')?.endsWith(field.toLowerCase()), `${field}: the container is the field's own block, with its main box`);
    }
  } finally {
    await view.unmount();
  }
});
