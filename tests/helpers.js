/**
 * Shared Playwright test helpers for FlowCV.
 *
 * Key concepts:
 * - The app uses HashRouter, so all routes are /#/path
 * - Resume data lives in localStorage key `cpwtcv_v1`
 * - DATA_VERSION = 7 — the store's data version (src/utils/normalizeResume.js); any version loads
 * - Default seed produces 6 resumes: Classic, Executive, Modern, Minimal, Dark, Sidebar
 * - Test resumes are injected via addInitScript before page.goto()
 */

export const DATA_VERSION = 7;
export const STORAGE_KEY = 'cpwtcv_v1';

/** Minimal ATS_DEFAULTS that matches the live app */
export const BASE_SETTINGS = {
  font: 'notosans',
  fontSizeBase: 11,
  fontSizeNameDelta: 8,
  fontSizeSectionDelta: 1,
  fontSizeEntryDelta: 0,
  lineHeightValue: 1.5,
  marginH: 18,
  marginV: 14,
  sectionGap: 16,
  itemGap: 12,
  accentColor: '#2563eb',
  textColor: '#111111',
  headingStyle: 'ruled',
  sectionTitleCase: 'upper',
  sectionBorderWidth: 1,
  sectionBorderColor: '',
  contactStyle: 'icon',
  contactLayout: 'justify',
  sidebarBg: '#1e293b',
  headerTextColor: '#ffffff',
  nameColor: '',
  jobTitleColor: '',
  iconSize: 11,
};

/** All 11 section types with meaningful test content */
export const ALL_SECTION_TYPES = [
  {
    id: 'sec_experience', type: 'experience', title: 'Professional Experience', visible: true,
    settings: { spacing: 'normal', columns: 1, showDates: true, showLocation: true, titleStyle: 'stacked' },
    items: [{ id: 'exp1', company: 'Acme Corp', role: 'Senior Dev', location: 'New York', startDate: '01/2023', endDate: '', current: true, description: 'Built amazing products.', bullets: [] }],
  },
  {
    id: 'sec_education', type: 'education', title: 'Education', visible: true,
    settings: { spacing: 'normal', columns: 1, showDates: true, showLocation: false, titleStyle: 'stacked' },
    items: [{ id: 'edu1', institution: 'MIT', degree: 'BSc Computer Science', fieldOfStudy: '', location: '', startDate: '09/2015', endDate: '06/2019', gpa: '3.9', description: '', bullets: [] }],
  },
  {
    id: 'sec_skills', type: 'skills', title: 'Skills', visible: true,
    settings: { spacing: 'normal', columns: 1, skillsStyle: 'inline', separator: 'colon' },
    items: [{ id: 'sk1', category: 'Frontend', skills: 'React, TypeScript, CSS' }],
  },
  {
    id: 'sec_projects', type: 'projects', title: 'Projects', visible: true,
    settings: { spacing: 'normal', columns: 1, showDates: true, titleStyle: 'stacked' },
    items: [{ id: 'proj1', name: 'My App', url: 'github.com/user/app', technologies: 'React', startDate: '01/2023', endDate: '03/2023', description: 'A test project.', bullets: [] }],
  },
  {
    id: 'sec_languages', type: 'languages', title: 'Languages', visible: true,
    settings: { spacing: 'normal', columns: 2 },
    items: [{ id: 'lang1', language: 'English', proficiency: 'Native' }],
  },
  {
    id: 'sec_certifications', type: 'certifications', title: 'Certifications', visible: true,
    settings: { spacing: 'normal', showDates: true, columns: 1 },
    items: [{ id: 'cert1', name: 'AWS Solutions Architect', issuer: 'Amazon', date: '2023', expiry: '', credentialId: 'AWS-123', url: '' }],
  },
  {
    id: 'sec_awards', type: 'awards', title: 'Awards & Honors', visible: true,
    settings: { spacing: 'normal', showDates: true },
    items: [{ id: 'award1', title: 'Employee of the Year', issuer: 'Acme Corp', date: '2023', description: 'Top performer.' }],
  },
  {
    id: 'sec_volunteering', type: 'volunteering', title: 'Volunteering', visible: true,
    settings: { spacing: 'normal', showDates: true, showLocation: true, titleStyle: 'stacked' },
    items: [{ id: 'vol1', org: 'Red Cross', role: 'Volunteer', location: 'NYC', startDate: '01/2022', endDate: '12/2022', description: 'Helped with relief efforts.', bullets: [] }],
  },
  {
    id: 'sec_references', type: 'references', title: 'References', visible: true,
    settings: { spacing: 'normal', columns: 2 },
    items: [{ id: 'ref1', name: 'Jane Doe', jobTitle: 'CTO', company: 'Acme Corp', relationship: 'Manager', email: 'jane@acme.com', phone: '' }],
  },
  {
    id: 'sec_interests', type: 'interests', title: 'Interests', visible: true,
    settings: { spacing: 'normal' },
    items: [{ id: 'int1', interests: 'Hiking, Photography, Open Source' }],
  },
  {
    id: 'sec_custom', type: 'custom', title: 'Publications', visible: true,
    settings: { spacing: 'normal', columns: 1, titleStyle: 'stacked' },
    items: [{ id: 'cust1', title: 'React Performance Patterns', subtitle: 'Tech Blog', date: '2024', location: '', description: 'An article about performance optimization.', bullets: [] }],
  },
];

export const TEST_PERSONAL = {
  name: 'Alex Johnson',
  title: 'Full Stack Engineer',
  email: 'alex@example.com',
  phone: '+1 555 0100',
  location: 'San Francisco, CA',
  website: 'alexjohnson.dev',
  linkedin: 'linkedin.com/in/alexj',
  github: 'github.com/alexj',
  summary: '<p>An experienced full stack engineer with 8+ years building web applications.</p>',
  photo: null,
  hiddenFields: [],
};

export const TEST_COVER_LETTER = {
  recipientName: 'Sarah Smith',
  recipientTitle: 'Engineering Manager',
  company: 'Globex Corp',
  date: '2026-01-15',
  subject: 'Application for Senior Engineer role',
  body: '<p>Dear Sarah,</p><p>I am excited to apply for the Senior Engineer position at Globex Corp.</p><p>Best,</p>',
  closing: 'Sincerely',
  signatureName: 'Alex Johnson',
  signatureDesignation: 'Full Stack Engineer',
};

/**
 * Build a complete resume state for localStorage injection.
 * @param {string} template - 'classic'|'modern'|'minimal'|'sidebar'|'executive'
 * @param {object} settingsOverride - override specific settings
 * @param {array} sections - use ALL_SECTION_TYPES or a subset
 */
export function buildTestState(template = 'classic', settingsOverride = {}, sections = null) {
  const TEMPLATE_HEADING = {
    classic: 'ruled', modern: 'line', minimal: 'underline',
    sidebar: 'plain', executive: 'underline',
  };
  const TEMPLATE_CASE = {
    classic: 'upper', modern: 'upper', minimal: 'upper',
    sidebar: 'upper', executive: 'normal',
  };

  const settings = {
    ...BASE_SETTINGS,
    headingStyle: TEMPLATE_HEADING[template] || 'ruled',
    sectionTitleCase: TEMPLATE_CASE[template] || 'upper',
    ...(template === 'sidebar' ? { sidebarBg: '#1e40af', headerTextColor: '#ffffff' } : {}),
    ...(template === 'modern'  ? { accentColor: '#1d4ed8', headerTextColor: '#ffffff' } : {}),
    ...settingsOverride,
  };

  const resume = {
    id: `test_${template}`,
    name: `Test ${template.charAt(0).toUpperCase() + template.slice(1)}`,
    template,
    updatedAt: Date.now(),
    settings,
    personal: TEST_PERSONAL,
    sections: sections ?? ALL_SECTION_TYPES,
    coverLetter: TEST_COVER_LETTER,
  };

  return {
    dataVersion: DATA_VERSION,
    activeId: resume.id,
    deletedIds: [],
    resumes: [resume],
  };
}

/**
 * Inject test state into localStorage BEFORE page load.
 * Must be called BEFORE page.goto().
 */
export async function injectTestState(page, state) {
  await page.addInitScript((args) => {
    localStorage.setItem(args.key, JSON.stringify(args.state));
  }, { key: STORAGE_KEY, state });
}

/**
 * Navigate to the editor for the first resume in the injected state.
 * Waits for the editor to be ready (export button visible).
 * @param {object} settingsOverride - override specific design settings (colors, lineHeightValue, etc.)
 */
export async function gotoEditor(page, template = 'classic', settingsOverride = {}) {
  const state = buildTestState(template, settingsOverride);
  await injectTestState(page, state);
  await page.goto(`/#/resume/test_${template}`);
  // Wait for editor to be ready
  await page.waitForSelector('button:has-text("Export")', { timeout: 15_000 });
  return state;
}

/**
 * Navigate to dashboard. Returns after resumes are visible.
 */
export async function gotoDashboard(page) {
  await page.goto('/#/');
  await page.waitForSelector('.group.bg-white.rounded-2xl', { timeout: 15_000 });
}

/**
 * Get text content of the off-screen resume preview (always present, source of truth).
 */
export async function getPreviewText(page) {
  return page.locator('#resume-preview').textContent({ timeout: 10_000 });
}

/**
 * Open a resume from the dashboard by template name (e.g. "Classic").
 */
export async function openResumeByName(page, name) {
  const card = page.locator(`.group.bg-white.rounded-2xl:has-text("${name}")`).first();
  await card.locator('button:has-text("Edit")').click();
  await page.waitForSelector('button:has-text("Export")', { timeout: 15_000 });
}
