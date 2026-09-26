// Regression tests for ids made from the clock (audit main-loop note M17): `${prefix}_${Date.now()}`
// gave two things added in the same millisecond the same id. cy.clock stops Date (only Date — the
// preview's timers keep running), so every add below happens "in the same millisecond".

const active = (s) => s.resumes.find((r) => r.id === s.activeId);
const unique = (ids) => expect(new Set(ids).size, `unique ids: ${ids.join(', ')}`).to.eq(ids.length);
const stopTheClock = () => cy.clock(Date.now(), ['Date']);
const sectionCard = (title) =>
  cy.get('input[type="text"]').filter((_, el) => el.value === title).closest('.rounded-xl');
const formField = (label) => cy.contains('label', label).parent().find('input, select, textarea').first();

describe('regressions — unique ids', () => {
  it('M17: entries and sections added in the same millisecond keep their own ids', () => {
    cy.visitEditor('classic');
    stopTheClock();
    sectionCard('Professional Experience').within(() => {
      cy.contains('button', 'Add Experience').click();
      cy.contains('button', 'Add Experience').click();
    });
    cy.contains('button', 'Add Section').click();
    cy.contains('button', 'Custom Section').click();
    cy.contains('button', 'Add Section').click();
    cy.contains('button', 'Custom Section').click();
    cy.store().should((s) => {
      const r = active(s);
      const exp = r.sections.find((x) => x.type === 'experience');
      expect(exp.items).to.have.length(3);
      unique(exp.items.map((i) => i.id));
      unique(r.sections.map((x) => x.id));
    });

    // Editing the second new entry leaves the first one alone.
    sectionCard('Professional Experience').within(() => {
      // Both new entries open with their fields (R4-ED-07); Acme's card stays collapsed.
      cy.get('input[placeholder="Company Name"]').should('have.length', 2).first().type('Globex');
    });
    cy.store().should((s) => {
      const exp = active(s).sections.find((x) => x.type === 'experience');
      expect(exp.items.map((i) => i.company)).to.deep.eq(['Acme Corp', 'Globex', '']);
    });
  });

  it('M17: two résumés created in the same millisecond stay two résumés', () => {
    cy.visitDashboard(null);
    stopTheClock();
    // New Resume asks first: a blank résumé or a role starter.
    const newBlankResume = () => {
      cy.contains('button', 'New Resume').click();
      cy.contains('button', 'Start from Scratch (Blank)').click();
    };
    newBlankResume();
    cy.get('button[title="Back to dashboard"]').click();
    newBlankResume();
    cy.store().its('resumes').should((rs) => {
      expect(rs).to.have.length(2);
      unique(rs.map((r) => r.id));
    });
  });

  it('M17: two jobs added in the same millisecond stay two jobs', () => {
    cy.seedAndVisit('/#/jobs', null);
    stopTheClock();
    ['Stripe', 'Globex'].forEach((company) => {
      cy.visit('/#/jobs/new');
      formField('Company').type(company);
      cy.contains('button', /^Add Job$/).click();
      cy.contains('h1', company).should('be.visible');
    });
    cy.jobStore().should((s) => {
      expect(s.jobs.map((j) => j.company)).to.deep.eq(['Google', 'Stripe', 'Globex']);
      unique(s.jobs.map((j) => j.id));
    });
  });
});
