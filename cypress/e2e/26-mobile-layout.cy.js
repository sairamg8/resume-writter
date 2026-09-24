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
/** The Edit | Preview switch: the fixed bar at the foot of the screen. */
const switchButton = (label) => cy.contains('div.fixed.bottom-4 button', new RegExp(`^\\s*${label}\\s*$`));
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

/** The editor's tab box (EditorTabContent): the form, Design and ATS Check scroll in it. */
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
    switchButton('Edit').should('be.visible').and('have.class', 'bg-blue-600');
    switchButton('Preview').should('be.visible').and('not.have.class', 'bg-blue-600');

    cy.get('[data-preview-status]').should('have.attr', 'data-preview-status', 'paused')
      .and('have.attr', 'data-preview-pages', '0') // never built: 'paused' alone is also what a preview built once and then hidden says
      .and('not.be.visible');
    cy.get('#resume-preview').should('not.be.visible');

    // The editor column (the header's parent) spans the screen; the desktop-only controls are not there.
    cy.get('button[title="Back to dashboard"]').parent().parent().invoke('outerWidth').should('eq', PHONE[0]);
    cy.get(handle).should('not.exist');
    cy.get('button[title="Split view"]').should('not.exist');
    cy.get('button[title="Editor only"]').should('not.exist');
    cy.contains('button', 'Export').should('be.visible');
    editorFitsTheScreen();
  });

  it('Preview shows the PDF alone, with the edits made on Edit; Edit brings the form back', () => {
    cy.get(NAME).clear().type('Robin Phone');

    switchButton('Preview').click();
    switchButton('Preview').should('have.class', 'bg-blue-600');
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

  it('the Design and ATS Check tabs open on the phone, full width', () => {
    const fullWidth = () => cy.get(`${TAB_BOX}:visible`).should('have.length', 1).invoke('outerWidth').should('eq', PHONE[0]);
    cy.get('button[title="Design & Customize"]').click();
    cy.contains('button', 'Template').should('be.visible');
    fullWidth();
    editorFitsTheScreen();
    cy.contains('button', 'ATS Check').click();
    cy.contains('h2', 'ATS Score & Parser Checker').should('be.visible');
    fullWidth();
    editorFitsTheScreen();
  });

  it('widening past 768 px brings back the split view without a reload, and narrowing hides it again', () => {
    cy.window().then((win) => { win.phonePage = true; }); // gone if the page reloads
    cy.viewport(1024, 800);
    cy.get(handle).should('exist');
    cy.get('div.fixed.bottom-4').should('not.exist');
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
    ['Import', 'Job Tracker', 'Boards', 'New Cover', 'New Resume'].forEach((label) => {
      cy.contains('button', label).should('be.visible');
    });
    fitsTheScreen();
  });
});
