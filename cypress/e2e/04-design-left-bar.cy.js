/** Resume the store marks active. */
const active = (s) => s.resumes.find((r) => r.id === s.activeId);
const settingsOf = (s) => active(s).settings;

/** Open the Design tab, and optionally one of its collapsible sections by title. */
const openDesign = (section) => {
  cy.get('button[title="Design & Customize"]').click();
  if (section) cy.contains('button', new RegExp(`^${section}$`, 'i')).click();
};

describe('design — Left bar\'s Border thickness is the width the bar prints (ONB-12)', () => {
  // The bar prints 2 pt wider than the stored thickness (tests/pdf/10-section-headings measures it),
  // so a stored 1 showed "1 pt" for a 3 pt bar. Under Left bar the box shows and sets the printed
  // width, 3–10 pt; the stored value — and so every saved résumé's look — is unchanged.
  it('a stored 1 shows 3 pt with a note under Left bar, steps store 2 pt less, and Ruled shows the stored value', () => {
    cy.visitEditor('classic', { settings: { headingStyle: 'leftbar', sectionBorderWidth: 1 } });
    openDesign('Section Headings');
    cy.contains('span', 'Border thickness').parent().as('thickness');
    cy.get('@thickness').find('input[aria-label="Section border thickness (pt)"]')
      .should('have.value', '3').and('have.attr', 'min', '3').and('have.attr', 'max', '10');
    cy.contains('p', 'A left bar is 2 pt wider than a rule, so it starts at 3 pt.').should('be.visible');

    cy.get('@thickness').contains('button', '−').click();
    cy.store().should((s) => expect(settingsOf(s).sectionBorderWidth).to.eq(1));
    cy.get('@thickness').find('input').should('have.value', '3');
    cy.get('@thickness').contains('button', '+').click();
    cy.store().should((s) => expect(settingsOf(s).sectionBorderWidth).to.eq(2));
    cy.get('@thickness').find('input').should('have.value', '4');

    cy.contains('button', 'Ruled').click();
    cy.store().should((s) => expect(settingsOf(s).headingStyle).to.eq('ruled'));
    cy.get('@thickness').find('input').should('have.value', '2').and('have.attr', 'min', '1');
    cy.contains('A left bar is 2 pt wider').should('not.exist');
  });
});
