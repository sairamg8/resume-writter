// Design → Date format (PAR-06): the choice is stored on the résumé, and the preview — the PDF
// itself — and the Word export print every date in it; a résumé storing none prints its dates as
// stored. The editor reads dates as the PDF does: the month picker shows an imported "05/2023" or
// 2019, and a year imported as a number no longer blanks the editor or the dashboard.
import { buildTestState } from '../../tests/helpers.js';
import { ENTRY_HEADER } from '../support/selectors.js';

const active = (s) => s.resumes.find((r) => r.id === s.activeId);
const formatSelect = () => cy.contains('label', /^Date format$/).parent().find('select');
const previewText = () => cy.preview().invoke('text');

const openDates = () => {
  cy.get('button[title="Design & Customize"]').click();
  cy.contains('button', /^Dates$/).click();
};

/** An experience section holding `items`, as an imported .json stores one. */
const experience = (items) => ({
  id: 'exp_imported', type: 'experience', title: 'Professional Experience', visible: true,
  settings: { spacing: 'normal', columns: 1, showDates: true, showLocation: true, titleStyle: 'stacked' },
  items: items.map((it, i) => ({ id: `e${i}`, company: `Company ${i + 1}`, role: 'Engineer', location: '', startDate: '', endDate: '', current: false, description: '', bullets: [], ...it })),
});

describe('design — date format (PAR-06)', () => {
  it('a résumé storing no format shows As entered and prints its dates as stored', () => {
    cy.visitEditor('classic'); // the fixture stores no dateFormat, like every résumé saved before PAR-06
    cy.store().should((s) => expect(active(s).settings).not.to.have.property('dateFormat'));
    openDates();
    formatSelect().find('option:selected').should('have.text', 'As entered');
    previewText().should('contain', '09/2015 – 06/2019').and('contain', '01/2023 – Present');
  });

  it('picking "January 2024" stores it; the preview and Word print every date that way', () => {
    cy.visitEditor('sidebar'); // education in the side column, experience and projects as cards
    openDates();
    formatSelect().select('January 2024');
    cy.store().should((s) => expect(active(s).settings.dateFormat).to.eq('MMMM YYYY'));
    previewText()
      .should('contain', 'September 2015 – June 2019')
      .and('contain', 'January 2023 – Present')
      .and('contain', 'January 2022 – December 2022')
      .and('not.contain', '09/2015');
    cy.exportDocx().then(({ paragraphs }) => {
      const text = paragraphs.join(' | ');
      ['September 2015 – June 2019', 'January 2023 – Present', 'January 2023 – March 2023'].forEach((want) => expect(text).to.contain(want));
    });
  });

  it('the Dates reset returns As entered', () => {
    cy.visitEditor('classic', { settings: { dateFormat: 'YYYY' } });
    previewText().should('contain', '2015 – 2019');
    openDates();
    formatSelect().should('have.value', 'YYYY');
    cy.get('button[title="Reset Dates to defaults"]').click();
    cy.store().should((s) => expect(active(s).settings.dateFormat).to.eq('asEntered'));
    previewText().should('contain', '09/2015 – 06/2019');
  });
});

describe('the editor reads imported dates', () => {
  it('the month picker shows an imported 2019 and "05/2023"; picking a month keeps the year', () => {
    cy.visitEditor('classic', { sections: [experience([{ startDate: 2019, endDate: '05/2023' }])] });
    cy.get(ENTRY_HEADER).first().click();
    cy.get('select[aria-label="Start Date year"]').should('have.value', '2019');
    cy.get('select[aria-label="End Date month"]').should('have.value', 'May');
    cy.get('select[aria-label="End Date year"]').should('have.value', '2023');
    cy.get('select[aria-label="End Date month"]').select('Jun');
    cy.store().should((s) => expect(active(s).sections[0].items[0].endDate).to.eq('Jun 2023'));
    previewText().should('contain', '2019 – Jun 2023');
  });

  it('the dashboard\'s Career History prints and measures an imported number year', () => {
    const state = buildTestState('classic', { dateFormat: 'MMM YYYY' }, [experience([
      { startDate: 2019, endDate: 2021 },
      { startDate: 'Jan 2020', endDate: '03/2023' },
    ])]);
    cy.visitDashboard(state);
    cy.contains('p', '2019 – 2021').should('be.visible');
    cy.contains('p', 'Jan 2020 – Mar 2023').should('be.visible');
    cy.contains('p', '3yr 2mo').should('be.visible');
  });
});
