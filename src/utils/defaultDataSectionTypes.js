export const SECTION_TYPE_DEFAULTS = {
  experience: (id) => ({
    id, type: 'experience', title: 'Professional Experience',
    settings: { spacing: 'normal', columns: 1, showDates: true, showLocation: true, titleStyle: 'stacked' },
    items: [{ id: `${id}_item1`, company: '', role: '', location: '', startDate: '', endDate: '', current: false, description: '', bullets: [] }],
  }),
  education: (id) => ({
    id, type: 'education', title: 'Education',
    settings: { spacing: 'normal', columns: 1, showDates: true, showLocation: false, titleStyle: 'stacked' },
    items: [{ id: `${id}_item1`, institution: '', degree: '', fieldOfStudy: '', location: '', startDate: '', endDate: '', gpa: '', description: '', bullets: [] }],
  }),
  skills: (id) => ({
    id, type: 'skills', title: 'Skills',
    settings: { spacing: 'normal', columns: 1, skillsStyle: 'inline', separator: 'colon' },
    items: [{ id: `${id}_item1`, category: '', skills: '' }],
  }),
  projects: (id) => ({
    id, type: 'projects', title: 'Projects',
    settings: { spacing: 'normal', columns: 1, showDates: true, titleStyle: 'stacked' },
    items: [{ id: `${id}_item1`, name: '', url: '', technologies: '', startDate: '', endDate: '', description: '', bullets: [] }],
  }),
  languages: (id) => ({
    id, type: 'languages', title: 'Languages',
    settings: { spacing: 'normal', columns: 2 },
    items: [{ id: `${id}_item1`, language: '', proficiency: 'Professional' }],
  }),
  certifications: (id) => ({
    id, type: 'certifications', title: 'Certifications',
    settings: { spacing: 'normal', showDates: true, columns: 1 },
    items: [{ id: `${id}_item1`, name: '', issuer: '', date: '', expiry: '', credentialId: '', url: '' }],
  }),
  awards: (id) => ({
    id, type: 'awards', title: 'Awards & Honors',
    settings: { spacing: 'normal', showDates: true },
    items: [{ id: `${id}_item1`, title: '', issuer: '', date: '', description: '' }],
  }),
  volunteering: (id) => ({
    id, type: 'volunteering', title: 'Volunteering',
    settings: { spacing: 'normal', showDates: true, showLocation: true, titleStyle: 'stacked' },
    items: [{ id: `${id}_item1`, org: '', role: '', location: '', startDate: '', endDate: '', description: '', bullets: [] }],
  }),
  references: (id) => ({
    id, type: 'references', title: 'References',
    settings: { spacing: 'normal', columns: 2 },
    items: [{ id: `${id}_item1`, name: '', jobTitle: '', company: '', relationship: '', email: '', phone: '' }],
  }),
  interests: (id) => ({
    id, type: 'interests', title: 'Interests',
    settings: { spacing: 'normal' },
    items: [{ id: `${id}_item1`, interests: '' }],
  }),
  custom: (id) => ({
    id, type: 'custom', title: 'Custom Section',
    settings: { spacing: 'normal', columns: 1, titleStyle: 'stacked' },
    items: [{ id: `${id}_item1`, title: '', subtitle: '', date: '', location: '', description: '', bullets: [] }],
  }),
};
