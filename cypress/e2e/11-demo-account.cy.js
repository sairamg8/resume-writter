// The owner's login always has the sample résumés (useDemoSeed). An e2e build (`vite build
// --mode e2e`) signs in the fake account these specs put in localStorage and runs that page
// without Firebase, so this is the local-only path; the cloud-side rules are unit-tested in
// tests/unit/demo-seed.unit.mjs.
import { STORAGE_KEY } from '../../tests/helpers.js';
import { CARD, CARD_RENAME } from '../support/selectors.js';
import { dashboardState } from '../support/state.js';

const OWNER = { uid: 'e2e-owner', email: 'sairamgudiputi8@gmail.com', displayName: 'Owner' };
const OTHER = { uid: 'e2e-other', email: 'someone@example.com', displayName: 'Someone' };
const SAMPLES = ['Sample · Classic', 'Sample · Modern', 'Sample · Minimal', 'Sample · Sidebar', 'Sample · Executive'];

/** Open the dashboard signed in as `user` (null = signed out) with `state` as the résumé store. */
function visitAs(user, state = null) {
  cy.visit('/#/', {
    onBeforeLoad(win) {
      win.localStorage.clear();
      if (state) win.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (user) win.localStorage.setItem('cpwtcv_e2e_user', JSON.stringify(user));
    },
  });
  cy.contains('h1', 'My Resumes').should('be.visible');
}

const okEveryConfirm = () => cy.window().then((win) => { cy.stub(win, 'confirm').returns(true); });
const deleteCard = (name) => cy.contains(CARD, name).contains('button', 'Delete').click();
const openCard = (name) => cy.contains(CARD, name).contains('button', 'Edit').click();
/** Assert the card names, in dashboard order (retries until the dashboard settles). */
const expectCards = (names) => cy.get(CARD).should(($cards) => {
  expect([...$cards].map((c) => c.querySelector('.group\\/name p')?.textContent)).to.deep.equal(names);
});

describe('demo account — the owner always has sample résumés', () => {
  it('an empty account gets one sample per template', () => {
    visitAs(OWNER);
    cy.get(CARD).should('have.length', SAMPLES.length);
    expectCards(SAMPLES);
    cy.store().should((s) => {
      expect(s.resumes.map((r) => r.id)).to.deep.eq(['demo_classic', 'demo_modern', 'demo_minimal', 'demo_sidebar', 'demo_executive']);
      expect(s.resumes.map((r) => r.template)).to.deep.eq(['classic', 'modern', 'minimal', 'sidebar', 'executive']);
      expect(s.resumes.every((r) => r.personal.name === 'Jordan Rivera')).to.eq(true);
    });
  });

  it('deleting every résumé brings the samples back', () => {
    visitAs(OWNER);
    cy.get(CARD).should('have.length', SAMPLES.length);
    okEveryConfirm();
    SAMPLES.slice(0, -1).forEach(deleteCard);
    cy.get(CARD).should('have.length', 1);
    deleteCard(SAMPLES.at(-1));
    cy.get(CARD).should('have.length', SAMPLES.length);
    expectCards(SAMPLES);
    cy.store().its('deletedIds').should('deep.equal', []);
  });

  it('edits are kept, and a restore brings back the edited copy', () => {
    visitAs(OWNER);
    openCard('Sample · Classic');
    cy.contains('button', 'Export').should('be.visible');
    cy.contains('label', 'Full Name').parent().next('input').clear().type('Sam Owner');
    cy.get('button[title="Back to dashboard"]').click();
    cy.get(CARD).first().as('card').find(CARD_RENAME).click({ force: true });
    cy.get('@card').find('input').clear().type('My Classic{enter}');

    cy.reload();
    cy.contains(CARD, 'My Classic').should('be.visible');
    okEveryConfirm();
    ['My Classic', ...SAMPLES.slice(1, -1)].forEach(deleteCard);
    cy.get(CARD).should('have.length', 1);
    deleteCard(SAMPLES.at(-1));
    expectCards(['My Classic', ...SAMPLES.slice(1)]);
    cy.store().should((s) => {
      const classic = s.resumes.find((r) => r.id === 'demo_classic');
      expect(classic.name).to.eq('My Classic');
      expect(classic.personal.name).to.eq('Sam Owner');
    });
  });

  it('a deleted sample stays deleted while other samples remain', () => {
    visitAs(OWNER);
    okEveryConfirm();
    deleteCard('Sample · Modern');
    cy.get(CARD).should('have.length', SAMPLES.length - 1);
    cy.reload();
    cy.get(CARD).should('have.length', SAMPLES.length - 1).and('not.contain.text', 'Sample · Modern');
  });

  it('the samples join the owner\'s own résumés, and come back once none of them is left', () => {
    visitAs(OWNER, dashboardState(['classic']));
    expectCards(['Classic CV', ...SAMPLES]);
    okEveryConfirm();
    SAMPLES.slice(0, -1).forEach(deleteCard);
    cy.get(CARD).should('have.length', 2);
    deleteCard(SAMPLES.at(-1));
    expectCards(['Classic CV', ...SAMPLES]);
  });

  it('opens a sample in the editor with its content in the PDF preview', () => {
    visitAs(OWNER);
    openCard('Sample · Sidebar');
    cy.previewReady();
    cy.preview().should('contain.text', 'Jordan Rivera').and('contain.text', 'Northwind Traders');
  });
});

describe('demo account — nobody else gets sample résumés', () => {
  it('another account starts empty', () => {
    visitAs(OTHER);
    cy.get(CARD).should('have.length', 0);
    cy.contains('No resumes yet').should('be.visible');
  });

  it('another account stays empty after deleting its last résumé', () => {
    visitAs(OTHER, dashboardState(['classic']));
    okEveryConfirm();
    deleteCard('Classic CV');
    cy.contains('No resumes yet').should('be.visible');
    cy.store().its('resumes').should('have.length', 0);
  });

  it('a signed-out visitor starts empty', () => {
    visitAs(null);
    cy.get(CARD).should('have.length', 0);
    cy.contains('No resumes yet').should('be.visible');
  });
});
