// A demo account's Import dialog has two choices, "Choose a file" and "Import as my original" (the owner's screenshot:
// each had its icon ABOVE its label, the label hung below the 32 px button, and the two buttons were different
// widths). The production build the Playwright spec measures has no demo account, so the two side by side are
// measured here, on the e2e build (its fake sign-in, no Firebase), at 320, 375, 594 and 639 px wide (594 is a wide phone
// or a small tablet, 639 the widest width below the sm breakpoint of 640) and at 640 and 1280:
//   - each choice has its icon on the label's row, is 32 px high and lies inside the dialog's content box and the screen
//     (tests/playwright/icon-rows.js, the check the Playwright spec runs too);
//   - below the sm breakpoint (the four phone widths) the two choices are stacked, the same width and as wide as the
//     dialog's content box; from sm (640, 1280) they sit side by side, each narrower than the content box;
//   - the hint under them, and everything else in the dialog's body, is inside the content box; neither the page nor
//     the body scrolls sideways; the panel fits the screen and Cancel is on it.
// Measured after the dialog's 180 ms scale-in has ended (a rect during it is 0.98 of the size). tests/playwright/
// ui-import-dialog-layout.spec.mjs does the same for the plain dialog in a touch browser.
import { OWNER, visitAs, stateWith, openImportDialog } from '../support/demoAccount.js';
import { stackedIcons } from '../../tests/playwright/icon-rows.js';

const PHONES = [[320, 640], [375, 812], [594, 800], [639, 800]];
const CHOICES = ['Choose a file', 'Import as my original'];

/** The dialog's panel once its animation has ended. */
const settledDialog = () => openImportDialog().should(($panel) => {
  expect($panel[0].getAnimations().every((a) => a.playState !== 'running'), 'the dialog has finished animating').to.eq(true);
});

const box = (el) => {
  const r = el.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
};
const at = (r) => `${r.left.toFixed(1)}..${r.right.toFixed(1)}`;

/** The panel's buttons by their labels. */
const choicesOf = (panel) => Object.fromEntries(
  [...panel.querySelectorAll('button')].map((b) => [b.textContent.trim(), b]).filter(([label]) => [...CHOICES, 'Cancel'].includes(label)),
);

/** The body (the scrolling box under the header) and the span its content may use between the padding. */
function contentBox(panel) {
  const body = panel.querySelector(':scope > .overflow-y-auto');
  if (!body) throw new Error('the dialog body (":scope > .overflow-y-auto" of the panel, src/components/ui/Dialog.jsx) was not found: the markup changed, update this spec');
  const style = panel.ownerDocument.defaultView.getComputedStyle(body);
  const r = body.getBoundingClientRect();
  return { body, left: r.left + parseFloat(style.paddingLeft), right: r.right - parseFloat(style.paddingRight) };
}

describe('demo account — the Import dialog\'s two choices on a phone', () => {
  PHONES.forEach(([width, height]) => {
    it(`${width} px wide: both choices have icon and label on one row, the same width, inside the dialog; Cancel is on screen`, () => {
      cy.viewport(width, height);
      visitAs(OWNER, stateWith(['Classic CV']));
      settledDialog().should(($panel) => {
        const panel = $panel[0];
        const win = panel.ownerDocument.defaultView;
        const choices = choicesOf(panel);
        CHOICES.forEach((label) => expect(choices[label], `the ${label} button`).to.exist);
        const { checked, offenders } = stackedIcons(panel);
        expect(checked, 'choices with an icon and a label').to.be.at.least(2);
        expect(offenders, offenders.join('\n')).to.deep.eq([]);

        const content = contentBox(panel);
        const rects = CHOICES.map((label) => box(choices[label]));
        rects.forEach((r, i) => {
          expect(r.height, `${CHOICES[i]} is ${r.height.toFixed(1)} px high`).to.be.within(31, 33);
          expect(r.left, `${CHOICES[i]} ${at(r)} in the content box ${content.left.toFixed(1)}..${content.right.toFixed(1)}`).to.be.at.least(content.left - 0.5);
          expect(r.right, `${CHOICES[i]} ${at(r)} in the content box ${content.left.toFixed(1)}..${content.right.toFixed(1)}`).to.be.at.most(content.right + 0.5);
        });
        expect(Math.abs(rects[0].width - rects[1].width), `widths ${rects[0].width.toFixed(1)} and ${rects[1].width.toFixed(1)} px`).to.be.at.most(1);
        rects.forEach((r, i) => {
          expect(Math.abs(r.width - (content.right - content.left)), `${CHOICES[i]} is ${r.width.toFixed(1)} px wide, the content box ${(content.right - content.left).toFixed(1)}: on a phone it fills the width`).to.be.at.most(1);
        });
        expect(rects[1].top, `the second choice (top ${rects[1].top.toFixed(1)}) is below the first (bottom ${rects[0].bottom.toFixed(1)})`).to.be.at.least(rects[0].bottom - 1);

        const outside = [...content.body.querySelectorAll('*')].filter((e) => {
          const r = e.getBoundingClientRect();
          return e.getClientRects().length > 0 && (r.right > content.right + 1 || r.left < content.left - 1);
        }).map((e) => `${e.tagName.toLowerCase()} "${(e.textContent || '').trim().slice(0, 24)}" ${at(e.getBoundingClientRect())}`);
        expect(outside, `elements wider than the content box ${content.left.toFixed(1)}..${content.right.toFixed(1)}`).to.deep.eq([]);

        const p = box(panel);
        expect(p.left, `panel ${at(p)}`).to.be.at.least(0);
        expect(p.right, `panel ${at(p)} on a ${win.innerWidth} px screen`).to.be.at.most(win.innerWidth);
        expect(p.bottom, `panel bottom ${p.bottom.toFixed(1)} on a ${win.innerHeight} px screen`).to.be.at.most(win.innerHeight);
        expect(panel.ownerDocument.documentElement.scrollWidth, 'the page scrolls sideways').to.be.at.most(win.innerWidth);
        expect(content.body.scrollWidth, 'the dialog body scrolls sideways').to.be.at.most(content.body.clientWidth);

        expect(choices.Cancel, 'Cancel').to.exist;
        const c = box(choices.Cancel);
        expect(c.bottom, `Cancel bottom ${c.bottom.toFixed(1)} on a ${win.innerHeight} px screen`).to.be.at.most(win.innerHeight);
        expect(c.right, `Cancel ${at(c)} on a ${win.innerWidth} px screen`).to.be.at.most(win.innerWidth);
      });
      cy.contains('button', 'Cancel').should('be.visible');
    });
  });

  [640, 1280].forEach((width) => {
    it(`${width} px wide (from sm): both choices side by side, each narrower than the content box, icon and label on one row, 32 px high`, () => {
      cy.viewport(width, 800);
      visitAs(OWNER, stateWith(['Classic CV']));
      settledDialog().should(($panel) => {
        const panel = $panel[0];
        const choices = choicesOf(panel);
        const content = contentBox(panel);
        const rects = CHOICES.map((label) => {
          expect(choices[label], `the ${label} button`).to.exist;
          const r = box(choices[label]);
          expect(r.height, `${label} is ${r.height.toFixed(1)} px high`).to.be.within(31, 33);
          expect(r.width, `${label} is ${r.width.toFixed(1)} px wide, narrower than the content box ${(content.right - content.left).toFixed(1)}`).to.be.below(content.right - content.left - 20);
          return r;
        });
        expect(Math.abs(rects[0].top - rects[1].top), `the choices' tops ${rects[0].top.toFixed(1)} and ${rects[1].top.toFixed(1)}: one row`).to.be.at.most(1);
        const { checked, offenders } = stackedIcons(panel);
        expect(checked, 'choices with an icon and a label').to.be.at.least(2);
        expect(offenders, offenders.join('\n')).to.deep.eq([]);
      });
    });
  });
});
