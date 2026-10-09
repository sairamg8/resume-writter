// PROBE: what the text import makes of realistic résumé text.
import { before, after, describe, it } from 'node:test';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const T = '\t';
const SAMPLES = {
  ukTabs: `CURRICULUM VITAE

Oliver J. Whitfield
14 Park Lane, Leeds LS1 4AB
Tel: 0113 496 0123${T}Email: o.whitfield@example.co.uk

PERSONAL STATEMENT
A chartered accountant with a track record in audit and advisory.

EMPLOYMENT HISTORY

2019 - present${T}Audit Manager, Hargreaves & Co, Leeds
- Lead a team of 8 on audits of listed clients

2014 - 2019${T}Senior Auditor, Pennine LLP, Manchester
- Planned and delivered 25 audits a year

EDUCATION
2011 - 2014${T}BA (Hons) Accounting and Finance, University of Leeds, First Class
`,
  ukSpaces: `Resume

Oliver J. Whitfield
Leeds, UK
Tel: 0113 496 0123 Email: o.whitfield@example.co.uk | Mobile: 07700 900123

WORK EXPERIENCE
Audit Manager
Hargreaves & Co, Leeds
2019 - Present
- Lead a team of 8
`,
  certs: `Ana Ruiz
ana@example.com

CERTIFICATIONS
AWS Certified Solutions Architect – Associate (2023)
PMP – Project Management Institute, 2021
Certified Kubernetes Administrator, CNCF, 2022
Google Data Analytics Professional Certificate – Coursera (2020)
`,
  edu: `Ana Ruiz
ana@example.com

EDUCATION
University of Madrid${T}2012 – 2016
Bachelor of Science in Computer Science, GPA 3.8

Academic Qualifications
MBA, IESE Business School, 2019
`,
  contactsLabelled: `Ana Ruiz
Email: ana@example.com  Phone: +34 600 123 456
Address: Calle Mayor 5, Madrid
LinkedIn: linkedin.com/in/anaruiz
Website: https://anaruiz.dev

EXPERIENCE
Engineer, Acme${T}2020 – Present
- Did things
`,
};

describe('probe 3', () => {
  it('imports', async () => {
    const { resumeFromText } = await loadModule('/src/utils/importText.js');
    for (const [name, text] of Object.entries(SAMPLES)) {
      let out;
      try {
        const r = resumeFromText(text);
        out = JSON.stringify({
          personal: Object.fromEntries(Object.entries(r.personal).filter(([, v]) => v && !(Array.isArray(v) && !v.length))),
          sections: r.sections.map((s) => ({ t: s.type, title: s.title, items: s.items.map((i) => Object.fromEntries(Object.entries(i).filter(([k, v]) => k !== 'id' && v && !(Array.isArray(v) && !v.length)))) })),
        });
      } catch (e) { out = `THROW ${e.stack}`; }
      console.log(`PROBE3 ${name} ${out}`);
    }
  });
});
