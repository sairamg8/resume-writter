// R4-DPH-39: on /new at 375 px, "Or start blank, or from a role example" lists the role starters with
// the name and a badge on one row (`flex items-center gap-2`, no wrap), about 244 px wide there. A long
// name and its badge ('Software Engineer (Full Stack)' + 'Tech & Engineering', 'Data Scientist & AI
// Engineer' + 'AI & Data') did not fit, so flex shrank the badge until its rounded pill broke onto two
// lines ('Tech &' / 'Engineering') beside a name that wrapped too. The row now wraps (flex-wrap, gap-x-2
// gap-y-1) and the badge keeps its one line (whitespace-nowrap shrink-0), so on a phone it moves under
// the name whole; where both fit (sm up) nothing moves. The fake DOM has no layout, so this pins the
// classes on the real StarterTemplateModal, inline as /new shows it and as the Dashboard's modal,
// mounted with react-dom/client over tests/pdf/fake-dom.mjs, for every starter of the data.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const tokens = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

for (const inline of [true, false]) {
  it(`${inline ? 'inline on /new' : 'the modal'}: each role starter's badge wraps under its name whole, never broken inside its pill`, async () => {
    const { default: StarterTemplateModal } = await loadModule('/src/components/StarterTemplateModal.jsx');
    const { STARTER_TEMPLATES } = await loadModule('/src/utils/starterTemplates.js');
    const picked = [];
    const view = mount(StarterTemplateModal, { isOpen: true, inline, onClose() {}, onSelectBlank() {}, onSelectStarter: (id) => picked.push(id) });
    try {
      const all = [...elements(view.container)];
      assert.ok(STARTER_TEMPLATES.length >= 3, 'the role starters of the data');
      for (const t of STARTER_TEMPLATES) {
        const name = all.find((el) => el.tagName === 'H3' && text(el) === t.name);
        assert.ok(name, `the "${t.name}" starter`);
        const row = name.parentNode;
        assert.ok(tokens(row).includes('flex-wrap'), `${t.name}: the name row wraps: ${tokens(row).join(' ')}`);
        assert.ok(tokens(row).includes('gap-x-2') && tokens(row).includes('gap-y-1'), `${t.name}: 8 px beside the name, 4 px under it`);
        const badge = row.childNodes.find((el) => el.tagName === 'SPAN' && text(el) === t.badge);
        assert.ok(badge, `${t.name}: its "${t.badge}" badge beside the name`);
        for (const token of ['whitespace-nowrap', 'shrink-0', 'rounded-full']) {
          assert.ok(tokens(badge).includes(token), `${t.name}: the badge has ${token}, so its pill stays one line: ${tokens(badge).join(' ')}`);
        }
      }
      const first = STARTER_TEMPLATES[0];
      const button = all.find((el) => el.tagName === 'BUTTON' && el.contains(all.find((h) => h.tagName === 'H3' && text(h) === first.name)));
      view.act(() => reactProps(button).onClick({ preventDefault() {}, stopPropagation() {} }));
      assert.deepEqual(picked, [first.id], 'a starter still starts the résumé');
    } finally { await view.unmount(); }
  });
}
