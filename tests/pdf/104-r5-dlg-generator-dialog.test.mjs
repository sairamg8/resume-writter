// R4-DVIS-25 (the Smart Cover Letter Generator's part), with its R4-DPH-37 and R4-DPH-38 parts: the
// generator was a hand-built modal — a blurred black backdrop, a rounded-2xl box capped at max-h-[90vh]
// in a backdrop that did not scroll (on iOS Safari vh is taller than what shows, so its header and its
// Cancel / Apply row were cut off), a gradient header with a Sparkles badge, a bare ×, a footer that
// could not wrap (at 375 px "Apply to Cover Letter" broke one word per line), animation classes no
// stylesheet defines, and no Escape: pressing Escape did nothing, while the template gallery and the
// Bullet Optimizer opened from the same editor close on it. It is the kit's Dialog at size lg now: in a
// portal, the whole screen below sm and calc(100dvh - 2rem) above, its body scrolling between the title
// and a footer of kit buttons that wraps; Escape, × and Cancel close it; a click beside the box closes
// it only while nothing has been typed over what it opened with (as R4-DUX-09 for the optimizer).
// The real modal is mounted over tests/pdf/fake-dom.mjs (104-r5-dlg-helpers.mjs).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience } from './harness.mjs';
import { reactProps } from './fake-dom.mjs';
import { openModal, classes, pressKey } from './104-r5-dlg-helpers.mjs';

before(setup);
after(teardown);

const PATH = '/src/components/CoverLetterGeneratorModal.jsx';
const person = () => resume({
  personal: { name: 'Robin Vale', title: 'Planner', email: 'robin@example.com' },
  sections: [experience([{ role: 'Planner', company: 'Globex', description: '' }])],
  coverLetter: { company: 'Initech', recipientName: 'Dana Moss' },
});
const generator = (extra = {}) => {
  const r = person();
  return openModal(PATH, { resume: r, coverLetter: r.coverLetter, onApply() {}, ...extra });
};

describe('the Smart Cover Letter Generator is the kit\'s Dialog (R4-DVIS-25)', () => {
  it('is drawn as the other editor dialogs are: a role="dialog" panel in the kit\'s portal, the kit title and close button', async () => {
    const g = await generator();
    try {
      const dialog = g.dialog();
      assert.ok(dialog, 'a role="dialog" panel');
      assert.equal(dialog.getAttribute('aria-modal'), 'true');
      let layer = dialog;
      while (layer && !layer.hasAttribute?.('data-ui-portal')) layer = layer.parentNode;
      assert.ok(layer, 'in the kit\'s portal layer');
      assert.ok(!g.view.container.contains(dialog), 'at the end of <body>, outside the panel that opened it');
      const panel = classes(dialog);
      for (const token of ['rounded-lg', 'ring-1']) assert.ok(panel.includes(token), `the panel has ${token}: ${panel.join(' ')}`);
      assert.ok(!panel.includes('rounded-2xl'), panel.join(' '));
      for (const token of ['backdrop-blur-xs', 'animate-in', 'fade-in', 'bg-gradient-to-r']) {
        assert.equal(g.all().find((el) => classes(el).includes(token)), undefined, `no element has ${token}`);
      }
      const title = g.find('H2', 'Smart Cover Letter Generator');
      assert.ok(title && dialog.contains(title) && classes(title).includes('text-xl'), 'the kit\'s title');
      const close = g.all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('aria-label') === 'Close');
      assert.ok(close && dialog.contains(close), 'the kit\'s close button');
      // Its fields and the letter preview are all there.
      for (const p of ['e.g. Google, Stripe', 'e.g. Hiring Manager']) {
        assert.ok(g.all().some((el) => el.tagName === 'INPUT' && el.getAttribute('placeholder') === p), p);
      }
      assert.ok(g.all().some((el) => /^prose\b/.test(el.getAttribute('class') || '')), 'the live preview');
    } finally { await g.unmount(); }
  });

  it('Escape closes it; an input method\'s Escape (a word being composed) does not', async () => {
    const g = await generator();
    try {
      const company = g.all().find((el) => el.tagName === 'INPUT' && el.getAttribute('placeholder') === 'e.g. Google, Stripe');
      pressKey(g.view, company, 'Escape', { isComposing: true });
      assert.equal(g.closes(), 0, 'composing: kept open');
      assert.ok(pressKey(g.view, company, 'Escape') > 0, 'the key reaches a handler');
      assert.equal(g.closes(), 1, 'Escape closes it');
    } finally { await g.unmount(); }
  });

  it('a click beside the box closes it until a field is typed over; Cancel and × still close it then', async () => {
    const g = await generator();
    try {
      const overlay = g.dialog().parentNode;
      const beside = () => g.view.act(() => {
        reactProps(overlay).onPointerDown({ target: overlay, currentTarget: overlay });
        reactProps(overlay).onPointerUp({ target: overlay, currentTarget: overlay });
        reactProps(overlay).onClick({ target: overlay, currentTarget: overlay });
      });
      const input = (p) => g.all().find((el) => el.tagName === 'INPUT' && el.getAttribute('placeholder') === p);
      assert.equal(reactProps(input('e.g. Google, Stripe')).value, 'Initech', 'it opened on the letter\'s company');
      g.view.act(() => reactProps(input('e.g. Hiring Manager')).onChange({ target: { value: 'Lee Park' } }));
      beside();
      assert.equal(g.closes(), 0, 'a typed recipient is not thrown away by a stray click');
      g.view.act(() => reactProps(input('e.g. Hiring Manager')).onChange({ target: { value: 'Dana Moss' } }));
      beside();
      assert.equal(g.closes(), 1, 'back as it opened: a click beside it closes it');
      g.view.act(() => reactProps(input('e.g. Google, Stripe')).onChange({ target: { value: 'Umbrella' } }));
      g.view.act(() => reactProps(g.find('BUTTON', 'Cancel')).onClick());
      assert.equal(g.closes(), 2, 'Cancel');
      g.view.act(() => reactProps(g.all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('aria-label') === 'Close')).onClick());
      assert.equal(g.closes(), 3, '×');
    } finally { await g.unmount(); }
  });

  it('R4-DPH-37: it fits the screen that shows — dvh, not 90vh — and only its body scrolls, between the title and the actions', async () => {
    const g = await generator();
    try {
      assert.equal(g.all().find((el) => classes(el).some((t) => /^max-h-\[\d+vh\]$/.test(t))), undefined, 'no box capped in vh');
      const dialog = g.dialog();
      const panel = classes(dialog);
      for (const token of ['max-h-[calc(100dvh-2rem)]', 'max-sm:h-dvh', 'max-sm:max-h-dvh', 'flex-col']) {
        assert.ok(panel.includes(token), `the panel has ${token}: ${panel.join(' ')}`);
      }
      assert.ok(classes(dialog.parentNode).includes('overflow-y-auto'), 'the layer around it scrolls');
      let body = g.all().find((el) => el.tagName === 'INPUT');
      while (body && body.parentNode !== dialog) body = body.parentNode;
      for (const token of ['overflow-y-auto', 'min-h-0', 'flex-1']) assert.ok(classes(body).includes(token), `the body scrolls (${token})`);
      const apply = g.find('BUTTON', 'Apply to Cover Letter');
      assert.ok(apply && dialog.contains(apply) && !body.contains(apply), 'Apply stays in view, outside the scrolling body');
      // On a phone the preview grows in the body's one scroll area; from sm it keeps its own box.
      const preview = classes(g.all().find((el) => /^prose\b/.test(el.getAttribute('class') || '')));
      assert.ok(!preview.includes('max-h-56') && !preview.includes('overflow-y-auto'), `no nested scroller on a phone: ${preview.join(' ')}`);
      assert.ok(preview.includes('sm:max-h-56') && preview.includes('sm:overflow-y-auto'), preview.join(' '));
    } finally { await g.unmount(); }
  });

  it('R4-DPH-38: its actions wrap as one row of buttons that never shrink or break their label, the note held at the start', async () => {
    const g = await generator();
    try {
      const cancel = g.find('BUTTON', 'Cancel');
      const apply = g.find('BUTTON', 'Apply to Cover Letter');
      const note = g.all().find((el) => el.tagName === 'P' && el.textContent.trim().startsWith('Replaces existing letter fields'));
      assert.ok(cancel && apply && note, 'Cancel, Apply and the note');
      const row = cancel.parentNode;
      assert.ok(apply.parentNode === row && note.parentNode === row, 'one row, with no group inside it that cannot wrap');
      assert.ok(classes(row).includes('flex-wrap'), `the row wraps: ${classes(row).join(' ')}`);
      for (const [name, el] of [['Cancel', cancel], ['Apply', apply]]) {
        for (const token of ['whitespace-nowrap', 'shrink-0']) assert.ok(classes(el).includes(token), `${name} has ${token}`);
      }
      assert.ok(classes(note).includes('mr-auto'), 'the note stays at the start of the row');
    } finally { await g.unmount(); }
  });
});
