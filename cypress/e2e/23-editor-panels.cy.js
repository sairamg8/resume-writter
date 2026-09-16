// Guards for the Editor.jsx split (review R5-12): editor behaviour the split moved between files
// that no other spec pinned. They pass before and after the split, deliberately — a split that
// moved a piece of state into a tab that unmounts, or dropped a handler, turns them red.

const PANEL_WIDTH_KEY = 'cpwtcv-panel-width';

/** The drag handle between the editor panel and the preview (split view only). */
const handle = () => cy.get('[title="Drag to resize panel"]');
/** The editor panel: the handle's left neighbour. */
const panel = () => handle().prev();

/** Drag the handle by `dx` px: mousedown on it, move and release on the window. */
function dragBy(dx) {
  handle().then(($h) => {
    const x = Math.round($h[0].getBoundingClientRect().left) + 2;
    cy.wrap($h).trigger('mousedown', { clientX: x, button: 0 });
    cy.window().then((win) => {
      win.dispatchEvent(new win.MouseEvent('mousemove', { clientX: x + dx, bubbles: true }));
      win.dispatchEvent(new win.MouseEvent('mouseup', { clientX: x + dx, bubbles: true }));
    });
  });
}

const zoomIn = () => cy.contains('button', /^\+$/);
const zoomLabel = () => zoomIn().prev('span');
const resumeTab = () => cy.contains('button', /^\s*Resume\s*$/);
/** The editor panel's scroll box, which every tab shows in. */
const scrollBox = () => panel().children('.overflow-y-auto');

describe('editor — panels and layout (guards for the Editor split)', () => {
  beforeEach(() => cy.visitEditor('classic'));

  it('dragging the panel edge resizes it within 240–640 px, and the width survives a reload', () => {
    panel().invoke('outerWidth').should('eq', 360);

    dragBy(100);
    panel().invoke('outerWidth').should('eq', 460);
    cy.window().its('localStorage').invoke('getItem', PANEL_WIDTH_KEY).should('eq', '460');
    cy.document().its('body.style.cursor').should('eq', ''); // the col-resize cursor is released

    dragBy(1000);
    panel().invoke('outerWidth').should('eq', 640);
    dragBy(-2000);
    panel().invoke('outerWidth').should('eq', 240);
    cy.window().its('localStorage').invoke('getItem', PANEL_WIDTH_KEY).should('eq', '240');

    dragBy(80);
    cy.reload();
    cy.contains('button', 'Export').should('be.visible');
    panel().invoke('outerWidth').should('eq', 320);
  });

  it('Collapse All, a closed Personal Info and an open Add Section picker survive a trip to Design and the letter', () => {
    cy.contains('button', 'Collapse All').click();
    cy.contains('button', 'Add Section').click();
    cy.contains('button', 'Custom Section').should('exist');

    cy.get('button[title="Design & Customize"]').click();
    cy.contains('button', 'Template').should('exist');
    cy.contains('button', 'Cover Letter').click();
    cy.get('#cover-letter-preview').should('exist');
    resumeTab().click();

    cy.contains('button', 'Expand All').should('be.visible'); // each tab opens at its top (NB-4)
    cy.get('input[placeholder="John Doe"]').should('not.exist'); // Personal Info still closed
    cy.contains('button', 'Add Experience').should('not.exist'); // sections still collapsed
    cy.contains('button', 'Custom Section').should('exist'); // the picker is still open
  });

  it('each tab opens at its top: Design after a scrolled Résumé, the Résumé after a scrolled Design (NB-4)', () => {
    cy.contains('button', 'Add Section').click();
    scrollBox().scrollTo('bottom', { ensureScrollable: false });
    scrollBox().its('0.scrollTop').should('be.gt', 100); // the Résumé really is scrolled down

    cy.get('button[title="Design & Customize"]').click();
    cy.contains('button', 'Template').should('be.visible');
    scrollBox().its('0.scrollTop').should('eq', 0);

    scrollBox().scrollTo('bottom', { ensureScrollable: false });
    scrollBox().its('0.scrollTop').should('be.gt', 100);
    resumeTab().click();
    cy.contains('button', 'Collapse All').should('be.visible');
    scrollBox().its('0.scrollTop').should('eq', 0);

    scrollBox().scrollTo('bottom', { ensureScrollable: false });
    cy.contains('button', 'Cover Letter').click();
    cy.get('#cover-letter-preview').should('exist');
    scrollBox().its('0.scrollTop').should('eq', 0);
  });

  it('the preview zoom stays put across the cover letter and an editor-only trip', () => {
    zoomIn().click();
    zoomLabel().should('have.text', '125%');

    cy.contains('button', 'Cover Letter').click();
    cy.get('#cover-letter-preview').should('exist');
    zoomLabel().should('have.text', '125%');

    cy.get('button[title="Editor only"]').filter(':visible').first().click();
    cy.get('button[title="Split view"]').filter(':visible').first().click();
    zoomLabel().should('have.text', '125%');
    cy.get('#cover-letter-preview').should('exist');
  });

  it('the preview footer says when it saved and links Terms and Privacy', () => {
    cy.contains('span', 'Saved Just now').scrollIntoView().should('be.visible');
    cy.contains('button', /^Terms$/).click();
    cy.location('hash').should('eq', '#/terms');
    cy.go('back');
    cy.contains('button', 'Export').should('be.visible');
    cy.contains('button', /^Privacy$/).click();
    cy.location('hash').should('eq', '#/privacy');
  });
});
