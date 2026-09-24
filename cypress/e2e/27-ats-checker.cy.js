// The ATS Check tab end to end (R2-161): the score card and its six categories, the job
// description scanner (match rate, missing keywords, a keyword added to Skills with one click),
// and the plain-text version — copied, downloaded from the tab and exported from the Export menu.
// Smoke level: the checker's rules are pinned in tests/unit/ats-*.unit.mjs; this checks the tab
// shows their result for the résumé that is open, and that its buttons do what they say.
const CATEGORIES = [
  'Contact & Header Information', 'ATS Standard Section Headings', 'Work Experience & Action Verbs',
  'Education & Credentials', 'Skills & Keyword Density', 'ATS Layout & Parser Safety',
];
// A job ad naming two skills the test résumé lists (React, TypeScript) and three it does not.
const JOB_AD = 'React TypeScript Kubernetes Terraform GraphQL';

const basename = (file) => file.split(/[\\/]/).pop();
const jobBox = () => cy.get('textarea[placeholder^="Paste job posting description"]');
/**
 * Scrolled to within the tab's scroll box, clear of the tab bar above it, and seen: the editor is a
 * fixed layer, so Cypress counts a node under the tab bar as covered.
 */
const onScreen = (chain) => chain.scrollIntoView({ offset: { top: -150, left: 0 } }).should('be.visible');
/** The Skills section's first line in the store. */
const firstSkills = (s) => s.resumes.find((r) => r.id === s.activeId).sections.find((x) => x.type === 'skills').items[0].skills;

describe('ATS Check tab', () => {
  beforeEach(() => {
    cy.visitEditor('classic');
    cy.contains('button', 'ATS Check').click();
    cy.contains('h2', 'ATS Score & Parser Checker').should('be.visible');
  });

  it('scores the open résumé out of 100 with a grade, a pass/suggestion/critical tally and six categories', () => {
    cy.contains('h2', 'ATS Score & Parser Checker').parents('.rounded-2xl').first().within(() => {
      cy.contains(/^\d{1,3}\/100$/).invoke('text').then((text) => {
        const score = Number(text.split('/')[0]);
        expect(score).to.be.within(0, 100);
      });
      cy.contains(/^[A-F][+-]? · .+/).should('be.visible');
      cy.contains(/^\s*\d+ Passed$/).should('be.visible');
      cy.contains(/^\s*\d+ Suggestions$/).should('be.visible');
      cy.contains(/^\s*\d+ Critical$/).should('be.visible');
    });
    CATEGORIES.forEach((label) => {
      onScreen(cy.contains('button', label)).and('contain.text', 'pts');
    });
    // Contact is open at first and lists its checks; Education is closed and opens on a click.
    cy.contains('button', 'Contact & Header Information').parent().find('.border-t').children()
      .should('have.length.greaterThan', 0);
    cy.contains('button', 'Education & Credentials').parent().find('.border-t').should('not.exist');
    cy.contains('button', 'Education & Credentials').click();
    onScreen(cy.contains('button', 'Education & Credentials').parent().find('.border-t'));
  });

  it('a pasted job ad gives a match rate and the missing keywords; "+" adds one to Skills', () => {
    cy.contains(/% Match$/).should('not.exist');
    jobBox().type(JOB_AD, { delay: 0 });
    onScreen(cy.contains(/^\d+% Match$/));
    onScreen(cy.contains('Missing Keywords in Resume'));
    ['Kubernetes', 'Terraform', 'GraphQL'].forEach((kw) => onScreen(cy.contains('button[title="Click to add to Skills"]', kw)));
    cy.contains('Matched Keywords Found').parent().should('contain.text', 'React').and('contain.text', 'TypeScript');

    cy.contains('button[title="Click to add to Skills"]', 'Kubernetes').click();
    cy.store().should((s) => expect(firstSkills(s)).to.match(/, Kubernetes$/));
    // Now on the résumé, it moves from missing to matched, and the PDF prints it.
    cy.contains('button[title="Click to add to Skills"]', 'Kubernetes').should('not.exist');
    cy.contains('Matched Keywords Found').parent().should('contain.text', 'Kubernetes');
    cy.get('#resume-preview', { timeout: 30_000 }).should('contain.text', 'Kubernetes');
  });

  it('Copy Text copies the plain-text résumé; the download button saves that same text as a .txt', () => {
    cy.window().then((win) => {
      cy.stub(win.navigator.clipboard, 'writeText').as('copy').resolves();
    });
    cy.contains('button', 'Copy Text').click();
    cy.contains('button', 'Copied!').should('be.visible');
    cy.get('@copy').should('have.been.calledOnce').its('firstCall.args.0').then((copied) => {
      expect(copied).to.contain('ALEX JOHNSON').and.contain('PROFESSIONAL SUMMARY');
      cy.task('clearDownloads');
      cy.get('button[title="Download .txt"]').click();
      cy.task('waitForDownload', { ext: '.txt' }).then((file) => {
        cy.task('readTextFile', file).should('eq', copied);
      });
    });
  });

  // One text file, two ways to save it: the tab's own button and the Export menu. Both are named as
  // the Export menu names every file (buildExportFilename: <Name>_<Title>), and hold the same text.
  it('Export → Export ATS Text (.txt) saves what the tab\'s download saves, under the same name', () => {
    const NAME = 'Alex_Johnson_Full_Stack_Engineer_ATS.txt';
    cy.task('clearDownloads');
    cy.get('button[title="Download .txt"]').click();
    cy.task('waitForDownload', { ext: '.txt' }).then((tabFile) => {
      expect(basename(tabFile), 'the tab\'s download').to.eq(NAME);
      cy.task('readTextFile', tabFile).then((tabText) => {
        expect(tabText.split('\n')[0]).to.eq('ALEX JOHNSON');
        expect(tabText).to.contain('PROFESSIONAL SUMMARY').and.contain('alex@example.com').and.contain('Acme Corp').and.contain('MIT');
        expect(tabText).not.to.match(/<[a-z/][^>]*>/i); // no HTML left in it

        cy.exportFile('Export ATS Text (.txt)', '.txt').then((menuFile) => { // clears the tab's file first
          expect(basename(menuFile), 'Export → ATS text').to.eq(NAME);
          cy.task('readTextFile', menuFile).should('eq', tabText);
        });
      });
    });
  });
});
