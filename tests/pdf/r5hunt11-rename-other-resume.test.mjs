// The editor stays mounted across /resume/:id (AppRoutes mounts one <Editor> with no key), and its
// header's rename box (useRename) kept its open state and draft when another résumé took the page:
// an import that finished while the box was open (useEditorExports navigates to the imported
// résumé), or Back/Forward. Leaving the box then renamed the résumé now open — the imported one lost
// its name to the draft typed for the first (R5-HUNT11-RENAME-BOX-RENAMES-IMPORTED-RESUME).
// Now the box belongs to the résumé it was opened on: another résumé under it closes it, and nothing
// is renamed.
// Mounted with react-dom/client over tests/pdf/fake-dom.mjs; handlers are called as React set them.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const cv = (id, name) => ({ id, name, updatedAt: 1, settings: {}, sections: [], personal: {} });
const input = (view) => [...elements(view.container)].find((el) => el.tagName === 'INPUT');
const byTitle = (view, title) => [...elements(view.container)].find((el) => el.getAttribute('title') === title);
const call = (view, el, name, event = {}) => {
  const handler = reactProps(el)?.[name];
  assert.ok(handler, `no ${name} handler on <${el?.tagName}>`);
  view.act(() => handler({ preventDefault() {}, stopPropagation() {}, target: el, currentTarget: el, ...event }));
};

describe('the editor header’s rename box when another résumé takes the page', () => {
  // As Editor.jsx wires it: the rename goes to the id of the résumé open at that render.
  async function header(resume) {
    const { useRename } = await loadModule('/src/hooks/useRename.js');
    const { EditorHeader } = await loadModule('/src/components/EditorHeader.jsx');
    const { MemoryRouter } = await import('react-router-dom');
    const renames = [];
    function Page({ resume: r }) {
      const rename = useRename(r, (n) => renames.push([r.id, n]));
      return createElement(MemoryRouter, null, createElement(EditorHeader, {
        resume: r, rename, layoutMode: 'split', setLayoutMode() {}, exportMenu: {}, auth: { cloudAvailable: false }, sync: {},
      }));
    }
    const view = mount(Page, { resume });
    return { view, renames, show: (r) => view.update({ resume: r }) };
  }

  for (const leave of ['onBlur', 'Enter']) {
    it(`an import lands while the box is open: the box closes, and ${leave} renames nobody`, async () => {
      const { view, renames, show } = await header(cv('resume_a', 'Resume A'));
      try {
        call(view, byTitle(view, 'Rename resume'), 'onClick');
        call(view, input(view), 'onChange', { target: { value: 'Google PM – A' } });
        show(cv('resume_b', 'Imported B')); // the editor navigates to the imported résumé
        const box = input(view);
        assert.equal(box, undefined, 'before: the box stayed open with A’s draft over résumé B');
        if (box) call(view, box, leave === 'Enter' ? 'onKeyDown' : 'onBlur', leave === 'Enter' ? { key: 'Enter' } : {});
        assert.deepEqual(renames, [], 'before: [["resume_b","Google PM – A"]] — B lost its imported name');
      } finally { await view.unmount(); }
    });
  }

  it('the box opened again on the new résumé starts from its name and renames it', async () => {
    const { view, renames, show } = await header(cv('resume_a', 'Resume A'));
    try {
      call(view, byTitle(view, 'Rename resume'), 'onClick');
      call(view, input(view), 'onChange', { target: { value: 'Draft for A' } });
      show(cv('resume_b', 'Imported B'));
      call(view, byTitle(view, 'Rename resume'), 'onClick');
      assert.equal(input(view).value, 'Imported B');
      call(view, input(view), 'onChange', { target: { value: 'B renamed' } });
      call(view, input(view), 'onKeyDown', { key: 'Enter' });
      assert.deepEqual(renames, [['resume_b', 'B renamed']]);
    } finally { await view.unmount(); }
  });
});
