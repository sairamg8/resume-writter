// Section Options (a section's ⋯ → Customize layout): every control shows what the PDF prints,
// template defaults included, and every option it offers changes the PDF.
import { ALL_SECTION_TYPES } from '../../tests/helpers.js';

const active = (s) => s.resumes.find((r) => r.id === s.activeId);
const settingsOf = (s, type) => active(s).sections.find((x) => x.type === type).settings;

/** Acme Corp / Senior Dev, stored with no Order: the template decides which leads. */
const EXPERIENCE = ALL_SECTION_TYPES.find((s) => s.type === 'experience');

/** Open a section's Section Options through its ⋯ menu. */
const openOptions = (title) => {
  cy.get(`input[value="${title}"]`).parent().find('button[title="Section options"]').click();
  cy.contains('button', 'Customize layout').click();
};

/** A chip of one Section Options row ("Order", "Title", …). */
const chip = (row, label) =>
  cy.contains('p', 'Section Options').parent().contains('span', new RegExp(`^${row}$`)).parent().contains('button', label);
const on = (row, label) => chip(row, label).should('have.class', 'bg-blue-600');
const off = (row, label) => chip(row, label).should('not.have.class', 'bg-blue-600');

/** The preview (the PDF's own text) prints `a` before `b`. */
const leads = (a, b) => cy.preview().invoke('text').should((t) => {
  expect(t).to.contain(a).and.to.contain(b);
  expect(t.indexOf(a), `"${a}" before "${b}" in: ${t}`).to.be.lessThan(t.indexOf(b));
});

describe('experience Order shows the order the PDF prints (FIDA-58 / FIDB-72)', () => {
  for (const template of ['executive', 'sidebar']) {
    it(`${template}: with no Order chosen the control shows "Role / Co."; each chip changes the PDF`, () => {
      cy.visitEditor(template, { sections: [EXPERIENCE] });
      leads('Senior Dev', 'Acme Corp');
      openOptions('Professional Experience');
      on('Order', 'Role / Co.');
      off('Order', 'Co. / Role');

      chip('Order', 'Co. / Role').click();
      cy.store().should((s) => expect(settingsOf(s, 'experience').titleOrder).to.eq('company'));
      on('Order', 'Co. / Role');
      off('Order', 'Role / Co.');
      leads('Acme Corp', 'Senior Dev');

      chip('Order', 'Role / Co.').click();
      cy.store().should((s) => expect(settingsOf(s, 'experience').titleOrder).to.eq('role'));
      on('Order', 'Role / Co.');
      leads('Senior Dev', 'Acme Corp');
    });
  }

  it('classic: with no Order chosen the control shows "Co. / Role", the order Classic prints', () => {
    cy.visitEditor('classic', { sections: [EXPERIENCE] });
    leads('Acme Corp', 'Senior Dev');
    openOptions('Professional Experience');
    on('Order', 'Co. / Role');
    off('Order', 'Role / Co.');
    chip('Order', 'Role / Co.').click();
    leads('Senior Dev', 'Acme Corp');
  });

  it('executive: a section with no Title style (older or imported data) shows "Inline", as Executive prints it', () => {
    const { titleStyle: _unset, ...settings } = EXPERIENCE.settings;
    cy.visitEditor('executive', { sections: [{ ...EXPERIENCE, settings }] });
    // Executive's inline title: "Role, Company" on one line.
    cy.preview().invoke('text').should('contain', 'Senior Dev, Acme Corp');
    openOptions('Professional Experience');
    on('Title', 'Inline');
    off('Title', 'Stacked');
    chip('Title', 'Stacked').click();
    cy.store().should((s) => expect(settingsOf(s, 'experience').titleStyle).to.eq('stacked'));
    cy.preview().invoke('text').should('not.contain', 'Senior Dev, Acme Corp');
  });
});
