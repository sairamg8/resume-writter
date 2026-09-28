// R4-DPH-12: on a phone, a job's stage stepper ran its labels together. Each of the five steps is
// ~60 px there, but a step's button kept its one-line label's width (shrink-0, whitespace-nowrap):
// "Phone Screen" (~64 px) ran into "Interview", and the connectors between them shrank to nothing.
// Now the button can shrink to its step and the label wraps under its circle, centred; each connector
// keeps 8 px (min-w-2) and narrower margins below sm; and the steps are top-aligned, the connector on
// the circles' centre line (mt-[17px] on a 36 px circle), so a two-line label moves no circle. The fake
// DOM has no layout, so this reads the classes the browser lays the stepper out by, on the real
// Pipeline (tests/pdf/fake-dom.mjs, loaded through Vite).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const STEPS = ['Saved', 'Applied', 'Phone Screen', 'Interview', 'Offer'];

it('R4-DPH-12: a stepper label wraps under its circle instead of running into the next, and every connector keeps a width', async () => {
  const { Pipeline } = await loadModule('/src/components/job/Pipeline.jsx');
  const dom = await import('./fake-dom.mjs');
  const view = dom.mount(Pipeline, { status: 'applied', onChange: () => {} });
  try {
    const all = [...dom.elements(view.container)];
    const classes = (el) => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
    const buttons = STEPS.map((label) => all.find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === label));
    assert.ok(buttons.every(Boolean), 'the five steps are drawn');

    const row = buttons[0].parentNode.parentNode;
    assert.ok(classes(row).includes('items-start') && !classes(row).includes('items-center'), `the steps are top-aligned: ${classes(row).join(' ')}`);

    buttons.forEach((button, i) => {
      const name = STEPS[i];
      assert.ok(!classes(button).includes('shrink-0'), `${name}: the step's button can shrink to its step: ${classes(button).join(' ')}`);
      const label = button.childNodes.find((el) => el.tagName === 'SPAN');
      assert.equal(label?.textContent, name);
      assert.ok(!classes(label).includes('whitespace-nowrap'), `${name}: the label can wrap: ${classes(label).join(' ')}`);
      assert.ok(classes(label).includes('text-center'), `${name}: a wrapped label is centred under its circle`);

      const step = button.parentNode;
      assert.equal(step.parentNode, row);
      const s = classes(step);
      assert.ok(s.includes('items-start') && s.includes('flex-1') && s.includes('min-w-0'), `${name}: ${s.join(' ')}`);
      if (i === STEPS.length - 1) {
        assert.equal(step.childNodes.length, 1, 'no connector after the last step');
        return;
      }
      const connector = step.childNodes[1];
      const c = classes(connector);
      assert.ok(c.includes('h-0.5') && c.includes('flex-1'), `${name}: the connector follows its button: ${c.join(' ')}`);
      assert.ok(c.includes('min-w-2'), `${name}: the connector never shrinks to nothing: ${c.join(' ')}`);
      assert.ok(c.includes('mx-0.5') && c.includes('sm:mx-1.5') && !c.includes('mx-1.5'), `${name}: narrower margins below sm: ${c.join(' ')}`);
      assert.ok(c.includes('mt-[17px]') && !c.includes('mb-5'), `${name}: on the circles' centre line, whatever the label's height: ${c.join(' ')}`);
    });
  } finally {
    await view.unmount();
  }
});
