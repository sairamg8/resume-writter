// PROBE: what the text import makes of realistic résumé text.
import { before, after, describe, it } from 'node:test';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const SAMPLES = {
  us: `Priya Natarajan
Senior Data Engineer
priya.n@example.com | (415) 555-0134 | San Francisco, CA | linkedin.com/in/priyan | github.com/priyan

SUMMARY
Data engineer with 9 years of experience building batch and streaming pipelines on AWS.

EXPERIENCE
Senior Data Engineer, Lumen Analytics — San Francisco, CA
Mar 2021 – Present
• Designed a Kafka + Flink pipeline processing 4B events/day with p99 latency under 800 ms.
• Cut warehouse spend 31% by moving cold data to Parquet on S3.
Data Engineer, Brightpath Health — Remote
Jun 2017 – Feb 2021
• Built Airflow DAGs for 120 nightly jobs.
• Mentored 3 junior engineers.

EDUCATION
M.S. Computer Science, University of Texas at Austin, 2017
B.Tech Information Technology, Anna University, 2015

SKILLS
Python, SQL, Spark, Kafka, Airflow, AWS, Terraform

CERTIFICATIONS
AWS Certified Data Analytics – Specialty (2022)
`,
  uk: `CURRICULUM VITAE

Oliver J. Whitfield
14 Park Lane, Leeds LS1 4AB
Tel: 0113 496 0123   Email: o.whitfield@example.co.uk

PERSONAL STATEMENT
A chartered accountant with a track record in audit and advisory.

EMPLOYMENT HISTORY

2019 - present   Audit Manager, Hargreaves & Co, Leeds
- Lead a team of 8 on audits of listed clients
- Introduced data analytics to the audit approach

2014 - 2019   Senior Auditor, Pennine LLP, Manchester
- Planned and delivered 25 audits a year

EDUCATION
2011 - 2014   BA (Hons) Accounting and Finance, University of Leeds, First Class

REFERENCES
Available on request
`,
  india: `RAHUL VERMA
Mobile: +91-98765-43210 | Email: rahul.verma@example.com
Address: B-12, Sector 62, Noida, Uttar Pradesh

CAREER OBJECTIVE
To secure a challenging position in a reputed organisation.

WORK EXPERIENCE
Software Engineer – Infosys Ltd., Bengaluru (July 2019 – Till date)
Worked on Java Spring Boot microservices for a banking client.
Technologies: Java, Spring Boot, Oracle, Jenkins

ACADEMIC QUALIFICATION
B.E. (Computer Science), VTU, 2019, 8.4 CGPA
XII (CBSE), 2015, 92%

DECLARATION
I hereby declare that the above information is true to the best of my knowledge.
Place: Noida    Date: 12/03/2024
`,
  caps: `JOHN Q. PUBLIC
PROJECT MANAGER

EXPERIENCE
ACME CORP
Project Manager ⇥ Jan 2020 – Present
Delivered 14 projects on time.
GLOBEX
Assistant Project Manager ⇥ 2016 – 2019
Coordinated vendors.

SKILLS
MS Project; Agile; Scrum; Risk management

LANGUAGES
English (Native), Spanish (B2)
`,
  fr: `Camille Dubois
Ingénieure logicielle
camille.dubois@example.fr • +33 6 12 34 56 78 • Lyon, France

EXPÉRIENCE PROFESSIONNELLE
Ingénieure logicielle — Société Générale, Paris
septembre 2018 – août 2023
• Développement de services Java pour la banque de détail.

FORMATION
Master en informatique, Université Lyon 1 (2016 – 2018)

COMPÉTENCES
Java, Kotlin, SQL, Docker

LANGUES
Français (langue maternelle), Anglais (courant)
`,
  oneline: `Maria Garcia, Marketing Specialist, maria@example.com, 555-123-4567
Experience: Marketing Specialist at Foo Inc (2018-2022) - ran campaigns. Intern at Bar LLC (2017) - social media.
Education: BA Marketing, State University, 2017
Skills: SEO, SEM, Google Analytics, Excel
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
        }, null, 1);
      } catch (e) { out = `THROW ${e.stack}`; }
      console.log(`PROBE3 ${name}\n${out}`);
    }
  });
});
