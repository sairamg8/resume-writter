// Regression tests for resume-store data-loss bugs (audit main-loop notes M1–M3).
import { buildTestState, STORAGE_KEY } from '../../tests/helpers.js';
import { CARD } from '../support/selectors.js';

const visitWithRawStore = (raw) =>
  cy.visit('/#/', {
    onBeforeLoad(win) {
      win.localStorage.clear();
      win.localStorage.setItem(STORAGE_KEY, raw);
    },
  });

describe('regressions — resume store', () => {
  it('M1: creating, duplicating or importing a resume keeps the deleted-ids list', () => {
    cy.visitDashboard();
    cy.contains(CARD, 'Dark').contains('button', 'Delete').click();
    cy.store().its('deletedIds').should('have.length', 1);

    cy.contains('button', 'New Resume').click();
    cy.store().its('deletedIds').should('have.length', 1);

    cy.get('button[title="Back to dashboard"]').click();
    cy.contains(CARD, 'Modern').contains('button', 'Copy').click();
    cy.store().its('deletedIds').should('have.length', 1);

    cy.get('button[title="Back to dashboard"]').click();
    cy.get('input[type="file"][accept=".json"]').selectFile({
      contents: Cypress.Buffer.from(JSON.stringify(buildTestState('classic').resumes[0])),
      fileName: 'r.json',
    }, { force: true });
    cy.location('hash').should('match', /^#\/resume\//);
    cy.store().its('deletedIds').should('have.length', 1);
  });

  it('M2: resumes saved under an older data version are kept, not replaced by the demo seed', () => {
    const state = buildTestState('minimal');
    state.dataVersion = 5;
    state.resumes[0].name = 'My Real CV';
    visitWithRawStore(JSON.stringify(state));
    cy.get(CARD).should('have.length', 1).and('contain.text', 'My Real CV');
    cy.store().should((s) => {
      expect(s.dataVersion).to.eq(6);
      expect(s.resumes.map((r) => r.name)).to.deep.eq(['My Real CV']);
    });
  });

  it('M2: an unreadable store is backed up before the demo seed replaces it', () => {
    visitWithRawStore('{ this is not json');
    cy.get(CARD).should('have.length', 6);
    cy.window().then((win) => {
      const backups = Object.keys(win.localStorage).filter((k) => k.startsWith(`${STORAGE_KEY}_backup_`));
      expect(backups).to.have.length(1);
      expect(win.localStorage.getItem(backups[0])).to.eq('{ this is not json');
    });
  });

  it('M3: a full localStorage does not crash the editor and says the change was not saved', () => {
    cy.visitEditor('classic');
    cy.window().then((win) => {
      const original = win.Storage.prototype.setItem;
      cy.stub(win.Storage.prototype, 'setItem').callsFake(function setItem(key, value) {
        if (key === STORAGE_KEY) throw new win.DOMException('The quota has been exceeded.', 'QuotaExceededError');
        return original.call(this, key, value);
      });
    });
    cy.contains('label', 'Full Name').parent().next('input').clear().type('Still Editing');
    cy.preview().should('contain.text', 'Still Editing');
    cy.contains('[role="alert"]', 'Not saved').should('be.visible');
  });
});

describe('regressions — job store', () => {
  it('M3: a full localStorage does not crash the job tracker and says so', () => {
    cy.seedAndVisit('/#/jobs', null);
    cy.window().then((win) => {
      const original = win.Storage.prototype.setItem;
      cy.stub(win.Storage.prototype, 'setItem').callsFake(function setItem(key, value) {
        if (key === 'cpwtcv_jobs_v1') throw new win.DOMException('The quota has been exceeded.', 'QuotaExceededError');
        return original.call(this, key, value);
      });
    });
    cy.on('window:confirm', () => true);
    cy.get('button[title="Clear all job data"]').click();
    cy.contains('span', /^Total$/).prev('span').should('have.text', '0');
    cy.contains('[role="alert"]', 'not being saved').should('be.visible');
  });
});
