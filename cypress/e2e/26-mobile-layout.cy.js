// The editor on a phone (R2-162): below 768 px (useIsMobile) the split view gives way to an
// Edit | Preview switch at the foot of the screen. The Edit tab fills the screen with the form and
// keeps the preview hidden — and unbuilt, its status 'paused' (R2-016) — until Preview is chosen;
// Preview shows the PDF alone, with the latest edits in it. No drag handle and no layout toggle on a
// phone, and nothing wider than the screen. Widening the window past 768 px brings the split view
// back without a reload. The hook itself is tested in tests/unit/media-query.unit.mjs.
import { buildTestState } from '../../tests/helpers.js';
import { CARD } from '../support/selectors.js';

const PHONE = [375, 812];
const NAME = 'input[placeholder="John Doe"]';
/** The Edit | Preview | Design pill: the fixed bar at the foot of the screen (testids editor-pill, pill-editor, pill-preview, pill-design). */
// The pill (z-40): the editor's notice stack is fixed at the bottom too (R2-139 A4).
const PILL = '[data-testid="editor-pill"]';
const PILL_ID = { Edit: 'pill-editor', Preview: 'pill-preview', Design: 'pill-design' };
const switchButton = (label) => cy.get(`${PILL} [data-testid="${PILL_ID[label]}"]`);
/** The pill's lit segment is the brand-filled one (bg-cv-brand). */
const LIT = 'bg-cv-brand';
const handle = '[title="Drag to resize panel"]';

/** Open the seeded Classic résumé in the editor at a phone's size. */
function visitOnPhone() {
  cy.viewport(...PHONE);
  const state = buildTestState('classic');
  cy.seedAndVisit(`/#/resume/${state.activeId}`, state);
  cy.get(NAME).should('be.visible');
}

/** Nothing on the page is wider than the screen: no sideways scroll. */
const fitsTheScreen = () =>
  cy.document().should((doc) => {
    expect(doc.documentElement.scrollWidth, 'page width').to.be.at.most(PHONE[0]);
  });

/** The editor's scroll boxes: the form (EditorTabContent) and the open dock (EditorDock) scroll in one each. */
const TAB_BOX = '.overflow-y-auto.overflow-x-hidden';
/** The preview pane (EditorPreviewPane): the box the PDF's pages sit and scroll in. */
const previewPane = () => cy.get('[data-preview-status]').parent();

/**
 * The same in the editor. The page itself cannot scroll there — the editor is a fixed layer that
 * hides its own overflow (Editor.jsx, fixed inset-0 overflow-hidden), so fitsTheScreen() would pass
 * whatever it held — and so the boxes that scroll are measured: the tab box on Edit, where content
 * wider than it is cut off at the right edge (overflow-x-hidden), and the preview pane on Preview,
 * where it would scroll sideways (overflow-auto). Only a box on screen counts: the one a tab hides
 * is display:none, 0 wide inside and out, and passes whatever it holds.
 */
const editorFitsTheScreen = () =>
  cy.document().should((doc) => {
    const pane = doc.querySelector('[data-preview-status]')?.parentElement;
    const boxes = [...doc.querySelectorAll(TAB_BOX), ...(pane ? [pane] : [])].filter((box) => Cypress.dom.isVisible(box));
    expect(boxes, 'a box on screen, measured').to.have.length.at.least(1);
    boxes.forEach((box) => {
      const what = box === pane ? 'the preview pane' : 'the tab box';
      expect(box.scrollWidth, `${what}: nothing in it wider than it`).to.be.at.most(box.clientWidth);
    });
  });

describe('editor on a phone (375 × 812)', () => {
  beforeEach(visitOnPhone);

  it('opens on Edit: the form fills the screen and the preview is hidden, not even built', () => {
    switchButton('Edit').should('be.visible').and('have.class', LIT);
    switchButton('Preview').should('be.visible').and('not.have.class', LIT);
    switchButton('Design').should('be.visible').and('not.have.class', LIT);

    cy.get('[data-preview-status]').should('have.attr', 'data-preview-status', 'paused')
      .and('have.attr', 'data-preview-pages', '0') // never built: 'paused' alone is also what a preview built once and then hidden says
      .and('not.be.visible');
    cy.get('#resume-preview').should('not.be.visible');

    // The bar spans the screen; the desktop-only controls are not there (no Design button in it: the pill has Design).
    cy.get('[data-testid="editor-bar"]').invoke('outerWidth').should('eq', PHONE[0]);
    cy.get('[data-testid="design-button"]').should('not.be.visible');
    cy.get(handle).should('not.exist');
    cy.get('button[title="Split view"]').should('not.exist');
    cy.get('button[title="Editor only"]').should('not.exist');
    cy.contains('button', 'Export').should('be.visible');
    editorFitsTheScreen();
  });

  it('Preview shows the PDF alone, with the edits made on Edit; Edit brings the form back', () => {
    cy.get(NAME).clear().type('Robin Phone');

    switchButton('Preview').click();
    switchButton('Preview').should('have.class', LIT);
    cy.previewReady();
    cy.previewPages().should('be.visible');
    cy.get('#resume-preview').should('contain.text', 'Robin Phone');
    cy.get(NAME).should('not.be.visible');
    cy.contains('span', /^\s*Résumé · /).should('be.visible'); // the preview's own caption
    cy.get('button[title="Preview only"]').should('not.exist');
    // The pane has the screen to itself, and the page fits it: no sideways scroll to reach its edge.
    cy.get(TAB_BOX).should('not.be.visible');
    previewPane().should('be.visible').invoke('outerWidth').should('eq', PHONE[0]);
    editorFitsTheScreen();

    switchButton('Edit').click();
    cy.get(NAME).should('be.visible').and('have.value', 'Robin Phone');
    cy.get('[data-preview-status]').should('not.be.visible');
  });

  it('the Design dock (the pill) and the ATS dock (the chip) open on the phone as a sheet, full width', () => {
    const fullWidth = (dock) => cy.get(`[data-testid="${dock}"]`).invoke('outerWidth').should('eq', PHONE[0]);
    switchButton('Design').click(); // the pill's Design: the bar's Design button is hidden on a phone
    cy.get('[data-testid="dock-design"]').contains('button', 'Template').should('be.visible');
    fullWidth('dock-design');
    switchButton('Design').should('have.class', LIT);
    editorFitsTheScreen();
    cy.openAts(); // the chip stays in the bar, 44 px, above the sheet; one dock at a time
    cy.get('[data-testid="dock-design"]').should('not.exist');
    cy.contains('h2', 'ATS Score & Parser Checker').should('be.visible');
    fullWidth('dock-ats');
    editorFitsTheScreen();
  });

  it('picking Edit, Preview or a document from a dock lands on that view with the dock closed (MOBI-043)', () => {
    switchButton('Design').click(); // the pill's Design segment (the bar's Design button is hidden on a phone)
    cy.get('[data-testid="dock-design"]').should('exist');
    switchButton('Preview').click();
    cy.get('[data-testid="dock-design"]').should('not.exist');
    switchButton('Preview').should('have.class', LIT);
    cy.get('#resume-preview').should('exist');
    // A document pick from the preview lands on Edit, with the letter's form.
    cy.switchTo('letter');
    switchButton('Edit').should('have.class', LIT);
    cy.contains('p', 'Letter Body').should('exist');
  });

  it('Export, the document switch, the ATS chip, the name and the save chip are in the bar on a phone', () => {
    cy.get('[data-testid="editor-bar"]').within(() => {
      cy.contains('button', 'Export').should('be.visible');
      cy.get('[data-testid="doc-switch-resume"]').should('be.visible').invoke('outerHeight').should('be.gte', 44);
      cy.get('[data-testid="doc-switch-letter"]').should('be.visible');
      cy.get('[data-testid="ats-chip"]').should('be.visible').invoke('outerHeight').should('be.gte', 44);
      cy.get('button[title="Rename resume"]').should('be.visible');
      cy.get('[data-testid="save-status"]').should('be.visible');
    });
    cy.contains('button', 'Export').click();
    cy.contains('button', 'Import as a new résumé').should('be.visible');
    cy.contains('button', 'Share a public link').should('not.exist'); // signed out: no Share (EDIT-014 rule)
  });

  it('widening past 768 px brings back the split view without a reload, and narrowing hides it again', () => {
    cy.window().then((win) => { win.phonePage = true; }); // gone if the page reloads
    cy.viewport(1024, 800);
    cy.get(handle).should('exist');
    cy.get(PILL).should('not.exist');
    cy.previewReady();
    cy.previewPages().should('be.visible');
    cy.get(NAME).should('be.visible');

    cy.viewport(...PHONE);
    cy.get(handle).should('not.exist');
    switchButton('Edit').should('be.visible');
    cy.get(NAME).should('be.visible');
    cy.get('#resume-preview').should('not.be.visible');
    cy.window().its('phonePage').should('eq', true);
  });
});

describe('dashboard on a phone (375 × 812)', () => {
  it('lists the résumés one to a row with every action in reach, and no sideways scroll', () => {
    cy.viewport(...PHONE);
    cy.visitDashboard(buildTestState('classic'));
    cy.contains('Test Classic').should('be.visible');
    // One column: the card spans the row (two to a row start at sm, 640 px).
    cy.get(CARD).first().invoke('outerWidth').should('be.greaterThan', PHONE[0] * 0.8);
    ['Import', 'New Cover', 'New Resume'].forEach((label) => {
      cy.contains('button', label).should('be.visible');
    });
    // The top bar's nav hides below md; the bottom tab bar carries the three areas, /boards as "Projects" (R4-DVIS-14).
    ['documents', 'applications', 'projects'].forEach((tab) => {
      cy.get(`[data-testid="bottom-tab-${tab}"]`).should('be.visible');
    });
    cy.get('[data-testid="app-bar-nav-applications"]').should('not.be.visible');
    fitsTheScreen();
  });
});
