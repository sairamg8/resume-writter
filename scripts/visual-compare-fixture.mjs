/**
 * "rich" fixture for scripts/visual-compare.mjs — appended to the app's own seeded resume so
 * every section type, rich-text mark, link and two-column layout shows up in the comparison.
 */
export const RICH_PERSONAL_OVERRIDES = {
  github: 'github.com/sairamg',
  hiddenFields: [],
};

export const RICH_EXTRA_SECTIONS = [
  {
    id: 'rich_projects', type: 'projects', title: 'Projects', visible: true,
    settings: { spacing: 'normal', columns: 1, showDates: true, titleStyle: 'stacked' },
    items: [
      { id: 'rp1', name: 'CPWT-CV', url: 'github.com/sairamg/cpwt-cv', technologies: 'React 19, react-pdf, Firebase', startDate: '01/2025', endDate: '', description: '<p>Free, open-source resume builder with <strong>live preview</strong>, <em>PDF/Word export</em> and a <a href="https://example.com">job tracker</a>.</p><ul><li>Canvas-accurate PDF export</li><li>Offline-first cloud sync</li></ul>', bullets: [] },
      { id: 'rp2', name: 'Dashboard Kit', url: '', technologies: 'Next.js', startDate: '03/2024', endDate: '08/2024', description: '<ol><li>Numbered first point</li><li>Numbered second point with a much longer line of text that must wrap onto a second line in both renderers</li></ol>', bullets: [] },
    ],
  },
  {
    id: 'rich_languages', type: 'languages', title: 'Languages', visible: true,
    settings: { spacing: 'normal', columns: 2 },
    items: [
      { id: 'rl1', language: 'English', proficiency: 'Native' },
      { id: 'rl2', language: 'Telugu', proficiency: 'Native' },
      { id: 'rl3', language: 'Hindi', proficiency: 'Professional' },
    ],
  },
  {
    id: 'rich_awards', type: 'awards', title: 'Awards & Honors', visible: true,
    settings: { spacing: 'normal', showDates: true },
    items: [{ id: 'ra1', title: 'Best Sprinter', issuer: 'Indegene', date: '2022', description: '<p>Awarded three consecutive times.</p>' }],
  },
  {
    id: 'rich_volunteering', type: 'volunteering', title: 'Volunteering', visible: true,
    settings: { spacing: 'normal', showDates: true, showLocation: true, titleStyle: 'stacked' },
    items: [{ id: 'rv1', org: 'Code for India', role: 'Mentor', location: 'Remote', startDate: '01/2022', endDate: '12/2022', description: '<p>Mentored students on web fundamentals.</p>', bullets: [] }],
  },
  {
    id: 'rich_references', type: 'references', title: 'References', visible: true,
    settings: { spacing: 'normal', columns: 2 },
    items: [
      { id: 'rr1', name: 'Jane Doe', jobTitle: 'CTO', company: 'Acme Corp', relationship: 'Manager', email: 'jane@acme.com', phone: '+1 555 0101' },
      { id: 'rr2', name: 'John Roe', jobTitle: 'Lead Engineer', company: 'Globex', relationship: 'Peer', email: 'john@globex.com', phone: '' },
    ],
  },
  {
    id: 'rich_interests', type: 'interests', title: 'Interests', visible: true,
    settings: { spacing: 'normal' },
    items: [{ id: 'ri1', interests: 'Open Source, Photography, Trekking, Chess' }],
  },
  {
    id: 'rich_custom', type: 'custom', title: 'Publications', visible: true,
    settings: { spacing: 'normal', columns: 1, titleStyle: 'stacked' },
    items: [{ id: 'rc1', title: 'React Performance Patterns', subtitle: 'Tech Blog', date: '2024', location: 'Online', description: '<p>An article about <u>performance</u> optimisation.</p>', bullets: [] }],
  },
];
