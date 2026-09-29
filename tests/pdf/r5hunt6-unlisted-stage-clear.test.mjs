// R5-HUNT6-UNLISTED-STAGE-CLEAR: a job whose interview stage is in neither of this browser's stage
// lists (imported, synced from another device, or a custom stage removed since) had no way to clear
// it on the job form: a stage clears only by clicking its own active button, and the pill was plain
// text. Now the pill of such a stage has a "Clear stage" X that sets the stage to none; a listed
// stage keeps clearing through its own button, with no X on the pill. Rendered on the real
// component (tests/pdf/fake-dom.mjs, loaded through Vite).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

async function render(stage, customStages) {
  const { InterviewStageSelector } = await loadModule('/src/components/job/InterviewStageSelector.jsx');
  const dom = await import('./fake-dom.mjs');
  const changes = [];
  const view = dom.mount(InterviewStageSelector, {
    stage, onStageChange: (s) => changes.push(s), customStages, addCustomStage: () => null, removeCustomStage: () => {},
  });
  const clear = [...dom.elements(view.container)]
    .find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === 'Clear stage');
  return { dom, view, changes, clear };
}

it('R5-HUNT6-UNLISTED-STAGE-CLEAR: a stage in neither list can be cleared from its pill', async () => {
  const { dom, view, changes, clear } = await render('Founder Chat', ['Take-home review']);
  try {
    assert.ok(clear, 'the pill of an unlisted stage has a Clear stage button');
    view.act(() => dom.reactProps(clear).onClick());
    assert.deepEqual(changes, [''], 'clicking it sets the stage to none');
  } finally {
    await view.unmount();
  }
});

it('R5-HUNT6-UNLISTED-STAGE-CLEAR: a listed stage has no pill X (its own button clears it)', async () => {
  for (const [stage, custom] of [['HR Round', []], ['Founder Chat', ['Founder Chat']]]) {
    const { view, clear } = await render(stage, custom);
    try {
      assert.equal(clear, undefined, `no Clear stage on the pill for ${stage}`);
    } finally {
      await view.unmount();
    }
  }
});
