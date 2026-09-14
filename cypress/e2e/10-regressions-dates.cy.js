// Regression tests: job-tracker dates follow the user's local day (audit main-loop note M13).
// The runner's timezone decides whether the old UTC bug is visible (it is in IST and in the
// Americas; UTC hides it), so each expectation is computed in the browser's own local time.

const pad = (n) => String(n).padStart(2, '0');
const localISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

describe('regressions — local dates in the job tracker', () => {
  it('M13: a new job defaults its applied date to the local day, not the UTC day', () => {
    // 00:30 local on 14 Sep: the UTC date is still the 13th anywhere east of Greenwich.
    const now = new Date(2026, 8, 14, 0, 30);
    cy.clock(now, ['Date']);
    cy.seedAndVisit('/#/jobs/new', null);
    cy.contains('label', 'Applied Date').parent().find('input').should('have.value', localISO(now));
  });

  it('M13: a deadline of today reads "Due soon" all day, not "Deadline passed"', () => {
    // 20:00 local on the deadline day. West of Greenwich, new Date('YYYY-MM-DD') is the
    // previous evening in local time, so the old code called the deadline passed.
    const now = new Date(2026, 8, 14, 20, 0);
    cy.clock(now, ['Date']);
    const job = {
      id: 'job_today', company: 'Acme', role: 'Engineer', status: 'applied',
      deadline: localISO(now), todos: [], statusHistory: [{ status: 'applied', changedAt: now.getTime() }],
      createdAt: now.getTime(), updatedAt: now.getTime(),
    };
    cy.visit('/#/jobs', {
      onBeforeLoad(win) {
        win.localStorage.clear();
        win.localStorage.setItem('cpwtcv_jobs_v1', JSON.stringify({ jobs: [job], dataVersion: 2 }));
      },
    });
    cy.contains('Due soon').should('be.visible');
    cy.contains('Deadline passed').should('not.exist');
  });
});
