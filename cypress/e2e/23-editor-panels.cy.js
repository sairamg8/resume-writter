// Guards for the Editor.jsx split (review R5-12): editor behaviour the split moved between files
// that no other spec pinned. They pass before and after the split, deliberately — a split that
// moved a piece of state into a tab that unmounts, or dropped a handler, turns them red.

const PANEL_WIDTH_KEY = 'cpwtcv-panel-width';

/** The drag handle between the editor panel and the preview (split view only). */
const handle = () => cy.get('[title="Drag to resize panel"]');
/** The editor panel: the handle's left neighbour. */
const panel = () => handle().prev();

/** Drag the handle by `dx` px with a mouse pointer: pointerdown on it, move and release on the window (R2-144). */
function dragBy(dx) {
  handle().then(($h) => {
    const x = Math.round($h[0].getBoundingClientRect().left) + 2;
    cy.wrap($h).trigger('pointerdown', { clientX: x, button: 0, pointerType: 'mouse', pointerId: 1 });
    cy.window().then((win) => {
      win.dispatchEvent(new win.PointerEvent('pointermove', { clientX: x + dx, pointerId: 1, pointerType: 'mouse', bubbles: true }));
      win.dispatchEvent(new win.PointerEvent('pointerup', { clientX: x + dx, pointerId: 1, pointerType: 'mouse', bubbles: true }));
    });
  });
}

/** The preview column: the handle's right neighbour. */
const preview = () => handle().next();
/**
 * The preview's zoom-in "+", looked for in the preview column: the letter's Header Layout shows a
 * "+" of its own earlier on the page, Name ↔ Contacts' stepper under Right of Name (R2-137).
 */
const zoomIn = () => preview().contains('button', /^\+$/);
const zoomLabel = () => zoomIn().prev('span');
/** The editor panel's scroll box, which the Résumé and the Cover Letter show in (the docks have a box of their own). */
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

  it('Personal info stays closed across switch and dock: Collapse All, a closed Personal Info and an open Add Section picker survive the letter and the Design dock', () => {
    cy.contains('button', 'Collapse All').click();
    cy.contains('button', 'Add Section').click();
    cy.contains('button', 'Custom Section').should('exist');

    // The dock opens beside the form: the form is untouched while it is open.
    cy.openDesign();
    cy.get('[data-testid="dock-design"]').contains('button', 'Template').should('exist');
    cy.get('input[placeholder="John Doe"]').should('not.exist');
    cy.contains('button', 'Custom Section').should('exist');
    cy.switchTo('letter');
    cy.get('#cover-letter-preview').should('exist');
    cy.get('[data-testid="dock-design"]').should('not.exist'); // picking the letter closes the dock
    cy.openDesign(); // and the dock opened from the letter lands on the Résumé
    cy.get('[data-testid="dock-design"]').should('exist');
    cy.switchTo('letter');
    cy.switchTo('resume');

    cy.contains('button', 'Expand All').should('be.visible'); // the Résumé opens at its top (NB-4)
    cy.get('input[placeholder="John Doe"]').should('not.exist'); // Personal Info still closed
    cy.contains('button', 'Add Experience').should('not.exist'); // sections still collapsed
    cy.contains('button', 'Custom Section').should('exist'); // the picker is still open
  });

  it('each scroll box opens at its top: the Cover Letter after a scrolled Résumé, a dock after a scrolled dock (NB-4)', () => {
    const dockBox = () => cy.get('[data-testid^="dock-"]:not([data-testid="dock-close"])').children('.overflow-y-auto');
    cy.contains('button', 'Add Section').click();
    scrollBox().scrollTo('bottom', { ensureScrollable: false });
    scrollBox().its('0.scrollTop').should('be.gt', 100); // the Résumé really is scrolled down

    // A dock has a box of its own: opening it leaves the form where it was.
    cy.openDesign();
    cy.get('[data-testid="dock-design"]').contains('button', 'Template').should('be.visible');
    scrollBox().its('0.scrollTop').should('be.gt', 100);
    dockBox().its('0.scrollTop').should('eq', 0);

    // Another dock replaces it and starts at its top, not at the offset the Design dock was scrolled to.
    dockBox().scrollTo('bottom', { ensureScrollable: false });
    dockBox().its('0.scrollTop').should('be.gt', 100);
    cy.openAts();
    cy.get('[data-testid="dock-ats"]').should('exist');
    dockBox().its('0.scrollTop').should('eq', 0);

    // A switch of the document puts the form box back at its top.
    cy.switchTo('letter');
    cy.get('#cover-letter-preview').should('exist');
    scrollBox().its('0.scrollTop').should('eq', 0);
    cy.switchTo('resume');
    cy.contains('button', 'Collapse All').should('be.visible');
    scrollBox().its('0.scrollTop').should('eq', 0);
  });

  it('the preview zoom stays put across the cover letter and an editor-only trip', () => {
    zoomIn().click();
    zoomLabel().should('have.text', '125%');

    cy.switchTo('letter');
    cy.get('#cover-letter-preview').should('exist');
    zoomLabel().should('have.text', '125%');

    cy.get('button[title="Editor only"]').filter(':visible').first().click();
    cy.get('button[title="Split view"]').filter(':visible').first().click();
    zoomLabel().should('have.text', '125%');
    cy.get('#cover-letter-preview').should('exist');
  });

  it('the bar says when it saved and the preview footer links Terms and Privacy', () => {
    cy.get('[data-testid="editor-bar"]').contains('span', 'Saved Just now').should('be.visible');
    cy.contains('button', /^Terms$/).click();
    cy.location('hash').should('eq', '#/terms');
    cy.go('back');
    cy.contains('button', 'Export').should('be.visible');
    cy.contains('button', /^Privacy$/).click();
    cy.location('hash').should('eq', '#/privacy');
  });
});
