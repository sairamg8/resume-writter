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

/** The open Section Options panel, and one of its rows by label ("Order", "Title", …). */
const options = () => cy.contains('p', 'Section Options').parent();
const row = (label) => options().contains('span', new RegExp(`^${label}$`));
const chip = (label, option) => row(label).parent().contains('button', option);
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

describe('the Sidebar side column offers the options it prints (FIDB-75)', () => {
  const SKILLS = ALL_SECTION_TYPES.find((s) => s.type === 'skills'); // Frontend: React, TypeScript, CSS
  const EDUCATION = ALL_SECTION_TYPES.find((s) => s.type === 'education');
  const HINT = 'side column';
  const text = () => cy.preview().invoke('text');

  it('skills: Bullet and the Dash separator reach the PDF; no Alignment or Grids, and a hint says why', () => {
    cy.visitEditor('sidebar', { sections: [SKILLS] });
    text().should('contain', 'FRONTEND: React, TypeScript, CSS');
    openOptions('Skills');
    row('Alignment').should('not.exist');
    row('Grids').should('not.exist');
    options().should('contain.text', HINT);

    chip('Style', 'Bullet').click();
    cy.store().should((s) => expect(settingsOf(s, 'skills').skillsStyle).to.eq('bullet'));
    text().should('contain', '• FRONTEND: React, TypeScript, CSS');
    chip('Separator', 'Dash').click();
    cy.store().should((s) => expect(settingsOf(s, 'skills').separator).to.eq('dash'));
    text().should('contain', '• FRONTEND – React, TypeScript, CSS');
    chip('Style', 'Inline').click();
    text().should('contain', 'FRONTEND – React, TypeScript, CSS').and('not.contain', '•');
  });

  it('education: no Title, Alignment or Grids; "Show location" prints and hides the location', () => {
    const edu = { ...EDUCATION, settings: { ...EDUCATION.settings, showLocation: true }, items: [{ ...EDUCATION.items[0], location: 'Boston, MA' }] };
    cy.visitEditor('sidebar', { sections: [edu] });
    text().should('contain', 'Boston, MA');
    openOptions('Education');
    ['Title', 'Alignment', 'Grids'].forEach((label) => row(label).should('not.exist'));
    options().should('contain.text', HINT);
    row('Show location').next('button').click();
    cy.store().should((s) => expect(settingsOf(s, 'education').showLocation).to.eq(false));
    text().should('not.contain', 'Boston, MA').and('contain', 'MIT');
  });

  it('other templates keep Alignment and Grids; Bullet offers the separator there too', () => {
    cy.visitEditor('classic', { sections: [SKILLS] });
    openOptions('Skills');
    row('Alignment').should('exist');
    row('Grids').should('exist');
    options().should('not.contain.text', HINT);
    chip('Style', 'Bullet').click();
    chip('Separator', 'Dash').click();
    text().should('contain', 'Frontend – React, TypeScript, CSS');
  });

  it('the Sidebar main column keeps Alignment and Grids', () => {
    cy.visitEditor('sidebar', { sections: [EXPERIENCE] });
    openOptions('Professional Experience');
    row('Alignment').should('exist');
    row('Grids').should('exist');
    options().should('not.contain.text', HINT);
  });
});
