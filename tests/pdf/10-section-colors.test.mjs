// Body and secondary text follow Design → Colors → Text colour (FIDB-27 / FIDA-44).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, drawState, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const NAVY = '#1e3a8a';

const sections = () => [
  experience([{ description: '<p>ExpDesc text</p>', bullets: ['BulletItem'], location: 'Cityville' }]),
  section('education', [{ institution: 'Uni', degree: 'BSc', description: '<p>EduDesc text</p>' }]),
  section('projects', [{ name: 'Proj', technologies: 'TechStack', description: '<p>ProjDesc text</p>', startDate: '06/2021', endDate: '07/2022' }]),
  section('skills', [{ category: 'Cat', skills: 'SkillList, More' }]),
  section('certifications', [{ name: 'Cert', issuer: 'CertIssuer', credentialId: 'CRED-1', date: '2023' }]),
  section('languages', [{ language: 'English', proficiency: 'ProfLevel' }]),
  section('awards', [{ title: 'Award', issuer: 'AwardIssuer', date: '2022', description: '<p>AwardDesc text</p>' }]),
  section('volunteering', [{ role: 'VolRole', org: 'VolOrg', location: 'VolTown', startDate: '2019', endDate: '2020', description: '<p>VolDesc text</p>' }]),
  section('references', [{ name: 'Ref', jobTitle: 'RefTitle', company: 'RefCompany', relationship: 'RefRel', phone: '+1 555 0199' }]),
  section('custom', [{ title: 'Cust', subtitle: 'CustSub', date: 'Spring 2024', description: '<p>CustDesc text</p>' }]),
];
const PERSONAL = { email: 'me@example.com', summary: '<p>SummaryText here</p>' };

// Each run, with the grey it printed in before the fix.
const RUNS = {
  ExpDesc: '#333333', BulletItem: '#333333', EduDesc: '#333333', ProjDesc: '#333333', VolDesc: '#333333', CustDesc: '#333333',
  SkillList: '#4b5563', CertIssuer: '#4b5563', ProfLevel: '#4b5563', AwardIssuer: '#4b5563', AwardDesc: '#4b5563',
  RefTitle: '#4b5563', RefCompany: '#4b5563', TechStack: '#6b7280', RefRel: '#6b7280', '0199': '#6b7280',
  'CRED-1': '#9ca3af', Cityville: '#9ca3af', VolTown: '#9ca3af',
};
const HEADER = { SummaryText: '#333333', 'me@example.com': '#555555' };
/** The runs each template prints in grey (Sidebar prints most sections in its own dark column). */
function runsOf(template) {
  if (template === 'sidebar') {
    return {
      AwardIssuer: '#4b5563', AwardDesc: '#4b5563', VolTown: '#9ca3af', VolDesc: '#333333', CustDesc: '#333333', 'Spring 2024': '#9ca3af',
      ExpDesc: '#333333', BulletItem: '#333333', ProjDesc: '#333333', '01/2020': '#9ca3af', '06/2021': '#9ca3af', // the experience and project cards
    };
  }
  const own = {
    classic: { VolOrg: '#4b5563', CustSub: '#4b5563', ...HEADER },
    modern: {},
    minimal: { VolOrg: '#555555', CustSub: '#555555', 'Spring 2024': '#4b5563', '06/2021': '#4b5563', ...HEADER, SummaryText: '#555555' },
    executive: { VolOrg: '#4b5563', CustSub: '#4b5563', 'Spring 2024': '#4b5563', '06/2021': '#4b5563', ...HEADER },
    // Compact (T9) had no "before": its 9 pt locations print in the meta grey, which reads 4.5:1.
    compact: { Cityville: '#6b7280', VolTown: '#6b7280' },
  }[template];
  return { ...RUNS, ...own };
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** A drawn run's colour as it looks on the white page. */
const onPaper = ({ fill, alpha }) => rgb(fill).map((c) => c * alpha + 255 * (1 - alpha));
/** How much of `base` a colour holds if it is `base` blended toward white — null if it is not. */
function shareOf(color, base) {
  const w = color.map((v, i) => (255 - v) / (255 - rgb(base)[i]));
  return Math.max(...w) - Math.min(...w) < 0.04 ? w[0] : null;
}

async function colours(template, textColor) {
  const bytes = await render(resume({ template, settings: { textColor }, personal: PERSONAL, sections: sections() }));
  const out = {};
  for (const needle of Object.keys(runsOf(template))) {
    const [hit] = await drawState(bytes, needle);
    assert.ok(hit, `${template}: "${needle}" is drawn`);
    out[needle] = onPaper(hit);
  }
  return out;
}

describe('text colour', () => {
  for (const template of TEMPLATES) {
    it(`${template}: a custom Text colour reaches every body and secondary run`, async () => {
      const got = await colours(template, NAVY);
      for (const [needle, c] of Object.entries(got)) {
        const w = shareOf(c, NAVY);
        assert.ok(w !== null && w > 0.3, `"${needle}" printed rgb(${c.map(Math.round)}), not a shade of ${NAVY}`);
      }
    });

    // Guard (R2-5): the old greys' lightness at the default, and — exactly — the Text colour's own
    // shades at the default #111111, the panel's "Near Black" #1a1a1a, and (no Text colour stored,
    // e.g. an import) the template's default Text colour.
    it(`${template}: the default Text colour prints (nearly) the greys it printed before`, async () => {
      const got = await colours(template, '#111111');
      const avg = (c) => (c[0] + c[1] + c[2]) / 3;
      for (const [needle, before] of Object.entries(runsOf(template))) {
        const c = got[needle];
        assert.ok(Math.abs(avg(c) - avg(rgb(before))) <= 8, `"${needle}" rgb(${c.map(Math.round)}) vs ${before} before`);
      }
    });

    it(`${template}: every body and secondary run is one of the Text colour's shades (R2-5)`, async () => {
      const { resolveTemplateSettings } = await loadModule('/src/templates/pdf/shared/templateSettings.js');
      const { textShades } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
      const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
      for (const textColor of ['#111111', '#1a1a1a', undefined]) {
        const base = textColor || resolveTemplateSettings({}, template).textColor;
        const allowed = new Set([base, ...Object.values(textShades(base))]);
        for (const [needle, c] of Object.entries(await colours(template, textColor))) {
          assert.ok(allowed.has(hex(c)), `${textColor || 'no Text colour'}: "${needle}" printed ${hex(c)}, not a shade of ${base}`);
        }
      }
    });
  }

  it('every skills style prints its skills in the Text colour (Minimal tags are grey, not accent)', async () => {
    for (const skillsStyle of ['inline', 'stacked', 'bullet', 'tags', 'bars']) {
      const skills = section('skills', [{ category: 'Cat', skills: 'SkillOne, SkillTwo' }], { skillsStyle });
      const bytes = await render(resume({ template: 'minimal', settings: { textColor: NAVY }, sections: [skills] }));
      const [hit] = await drawState(bytes, 'SkillOne');
      const c = onPaper(hit);
      assert.ok(shareOf(c, NAVY) > 0.3, `${skillsStyle}: rgb(${c.map(Math.round)}), not a shade of ${NAVY}`);
      if (skillsStyle === 'bullet') {
        const [marker] = await drawState(bytes, '•');
        assert.ok(shareOf(onPaper(marker), NAVY) > 0.3, 'the bullet marker too');
      }
    }
  });

  it('descriptions keep #333333 at the default Text colour', async () => {
    const [hit] = await drawState(await render(resume({ sections: sections() })), 'ExpDesc');
    assert.equal(hit.fill, '#333333');
  });
});
