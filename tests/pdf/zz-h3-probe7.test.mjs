// PROBE: ATS keyword extraction on a realistic posting, the score items, the exports' text.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const JD = `Senior Full-Stack Engineer (React/Node.js) - Remote (US/Canada)
About the role: You'll own features end-to-end across our TypeScript/React front end and Node.js/PostgreSQL back end. We use AWS (ECS, Lambda, S3), Docker, Kubernetes and Terraform, with CI/CD in GitHub Actions.
Requirements:
- 5+ years of professional experience building web applications
- Strong proficiency in JavaScript (ES6+), TypeScript, HTML5 and CSS3
- Experience with RESTful APIs, GraphQL, and microservices architecture
- Familiarity with Agile/Scrum, TDD, and code reviews
- Bachelor's degree in Computer Science or equivalent; C++ or Go a plus
- Excellent communication and problem-solving skills
Nice to have: Redis, Kafka, Next.js, Tailwind CSS, A/B testing, SOC 2 compliance. Salary $140k-$180k + equity. EEO employer.`;

describe('probe 7', () => {
  it('prints', async () => {
    const { DEMO_RESUMES } = await loadModule('/tests/fixtures/sampleResumes.js');
    const ats = await loadModule('/src/utils/atsChecker.js');
    const out = [];
    const kw = ats.extractJobKeywords(JD);
    out.push(`KW ${kw.map((k) => `${k.keyword}:${k.count}`).join(' ')}`);
    const r = DEMO_RESUMES[0];
    const m = ats.matchResumeWithJob(r, JD);
    out.push(`MATCH ${m.matchPercentage}% matched=[${m.matchedKeywords.join(',')}] missing=[${m.missingKeywords.join(',')}]`);
    const a = ats.analyzeAtsScore(r, JD);
    out.push(`SCORE ${a.totalScore} ${a.grade}`);
    for (const [k, c] of Object.entries(a.categories)) out.push(`CAT ${k} ${c.score}/${c.max}: ${c.items.map((i) => `${i.id}:${i.status}`).join(' ')}`);
    out.push(`REC ${a.recommendations.map((x) => (typeof x === 'string' ? x : x.text || x.title || JSON.stringify(x)).slice(0, 90)).join(' | ')}`);
    assert.fail(out.join(' ¦ '));
  });
});
