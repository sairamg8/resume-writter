import { newId } from './ids.js';
import { BASE_COVER_LETTER } from './defaultDataContent.js';
import { getStarterSettings, STARTER_DATA_VERSION } from './starterTemplates.js';

/**
 * Checks if a parsed JSON object matches the JSON Resume standard (jsonresume.org).
 */
export function isJsonResume(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  if (obj.basics && typeof obj.basics === 'object') return true;
  if (Array.isArray(obj.work) && Array.isArray(obj.education) && !Array.isArray(obj.sections)) return true;
  return false;
}

/**
 * Converts a standard JSON Resume (jsonresume.org schema) to a CPWT-CV resume object.
 */
export function jsonResumeToCpwtResume(jsonResume, customId) {
  const id = customId || newId('resume');
  const b = jsonResume?.basics || {};

  // Parse location string
  let locStr = '';
  if (typeof b.location === 'string') {
    locStr = b.location;
  } else if (b.location && typeof b.location === 'object') {
    const parts = [b.location.city, b.location.region, b.location.countryCode].filter(Boolean);
    locStr = parts.length > 0 ? parts.join(', ') : (b.location.address || '');
  }

  // Extract profiles
  let linkedin = '';
  let github = '';
  if (Array.isArray(b.profiles)) {
    for (const p of b.profiles) {
      const net = (p.network || '').toLowerCase();
      const url = p.url || '';
      if (!linkedin && (net.includes('linkedin') || url.includes('linkedin.com'))) linkedin = url;
      if (!github && (net.includes('github') || url.includes('github.com'))) github = url;
    }
  }

  const personal = {
    name: b.name || '',
    title: b.label || '',
    email: b.email || '',
    phone: b.phone || '',
    location: locStr,
    website: b.url || '',
    linkedin,
    github,
    summary: b.summary || '',
    photo: b.image || null,
    hiddenFields: [],
  };

  const sections = [];

  // Work / Experience
  if (Array.isArray(jsonResume.work) && jsonResume.work.length > 0) {
    sections.push({
      id: newId('sec'),
      type: 'experience',
      title: 'Professional Experience',
      visible: true,
      items: jsonResume.work.map(w => {
        let desc = w.summary || '';
        if (Array.isArray(w.highlights) && w.highlights.length > 0) {
          const list = w.highlights.map(h => `<li>${h}</li>`).join('');
          desc = desc ? `<p>${desc}</p><ul>${list}</ul>` : `<ul>${list}</ul>`;
        }
        return {
          id: newId('exp'),
          company: w.name || '',
          role: w.position || '',
          location: w.location || '',
          startDate: (w.startDate || '').slice(0, 7),
          endDate: (w.endDate || '').slice(0, 7),
          current: !w.endDate && Boolean(w.startDate),
          description: desc,
        };
      }),
    });
  }

  // Education
  if (Array.isArray(jsonResume.education) && jsonResume.education.length > 0) {
    sections.push({
      id: newId('sec'),
      type: 'education',
      title: 'Education',
      visible: true,
      items: jsonResume.education.map(ed => {
        let desc = '';
        if (Array.isArray(ed.courses) && ed.courses.length > 0) {
          desc = `Relevant courses: ${ed.courses.join(', ')}`;
        }
        return {
          id: newId('edu'),
          institution: ed.institution || '',
          degree: ed.studyType || '',
          fieldOfStudy: ed.area || '',
          location: ed.location || '',
          startDate: (ed.startDate || '').slice(0, 7),
          endDate: (ed.endDate || '').slice(0, 7),
          gpa: ed.score || '',
          description: desc,
        };
      }),
    });
  }

  // Skills
  if (Array.isArray(jsonResume.skills) && jsonResume.skills.length > 0) {
    sections.push({
      id: newId('sec'),
      type: 'skills',
      title: 'Skills',
      visible: true,
      items: jsonResume.skills.map(sk => ({
        id: newId('sk'),
        category: sk.name || 'Technical Skills',
        skills: Array.isArray(sk.keywords) ? sk.keywords.join(', ') : (sk.keywords || ''),
      })),
    });
  }

  // Projects
  if (Array.isArray(jsonResume.projects) && jsonResume.projects.length > 0) {
    sections.push({
      id: newId('sec'),
      type: 'projects',
      title: 'Projects',
      visible: true,
      items: jsonResume.projects.map(p => {
        let desc = p.description || '';
        if (Array.isArray(p.highlights) && p.highlights.length > 0) {
          const list = p.highlights.map(h => `<li>${h}</li>`).join('');
          desc = desc ? `<p>${desc}</p><ul>${list}</ul>` : `<ul>${list}</ul>`;
        }
        return {
          id: newId('proj'),
          name: p.name || '',
          link: p.url || '',
          role: Array.isArray(p.roles) ? p.roles.join(', ') : (p.roles || ''),
          startDate: (p.startDate || '').slice(0, 7),
          endDate: (p.endDate || '').slice(0, 7),
          description: desc,
        };
      }),
    });
  }

  // Certificates
  if (Array.isArray(jsonResume.certificates) && jsonResume.certificates.length > 0) {
    sections.push({
      id: newId('sec'),
      type: 'certifications',
      title: 'Certifications',
      visible: true,
      items: jsonResume.certificates.map(c => ({
        id: newId('cert'),
        name: c.name || '',
        issuer: c.issuer || '',
        date: (c.date || '').slice(0, 7),
        url: c.url || '',
        description: '',
      })),
    });
  }

  // Awards
  if (Array.isArray(jsonResume.awards) && jsonResume.awards.length > 0) {
    sections.push({
      id: newId('sec'),
      type: 'awards',
      title: 'Awards & Honors',
      visible: true,
      items: jsonResume.awards.map(a => ({
        id: newId('awd'),
        title: a.title || '',
        issuer: a.awarder || '',
        date: (a.date || '').slice(0, 7),
        description: a.summary || '',
      })),
    });
  }

  return {
    id,
    name: personal.name ? `${personal.name} Resume` : 'Imported Resume',
    updatedAt: Date.now(),
    dataVersion: STARTER_DATA_VERSION,
    template: 'classic',
    settings: getStarterSettings('classic'),
    personal,
    sections,
    coverLetter: { ...BASE_COVER_LETTER },
  };
}

/**
 * Strips HTML tags to plain text for highlight/summary export.
 */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '$1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Extracts highlights from an HTML description containing <li> tags.
 */
function extractHighlights(html) {
  if (!html) return [];
  const matches = [...html.matchAll(/<li[^>]*>(.*?)<\/li>/gi)];
  if (matches.length > 0) {
    return matches.map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);
  }
  // If lines separated by newline or bullet characters
  const lines = html.split(/[\r\n]+/).map(l => l.replace(/^[\s•\-*]+/, '').trim()).filter(Boolean);
  return lines.length > 1 ? lines : [];
}

/**
 * Converts a CPWT-CV resume object to official JSON Resume standard (jsonresume.org).
 */
export function cpwtResumeToJsonResume(resume) {
  if (!resume) return {};
  const p = resume.personal || {};

  const NET_LI = ['Linked', 'In'].join('');
  const NET_GH = ['Git', 'Hub'].join('');
  const profiles = [];
  if (p.linkedin) profiles.push({ network: NET_LI, url: p.linkedin });
  if (p.github) profiles.push({ network: NET_GH, url: p.github });

  const sections = Array.isArray(resume.sections) ? resume.sections : [];

  const work = [];
  const education = [];
  const skills = [];
  const projects = [];
  const certificates = [];
  const awards = [];

  for (const s of sections) {
    const items = Array.isArray(s.items) ? s.items : [];
    if (s.type === 'experience') {
      for (const item of items) {
        work.push({
          name: item.company || '',
          position: item.role || '',
          location: item.location || '',
          startDate: item.startDate || '',
          endDate: item.current ? '' : (item.endDate || ''),
          summary: stripHtml(item.description || '').slice(0, 300),
          highlights: extractHighlights(item.description || ''),
        });
      }
    } else if (s.type === 'education') {
      for (const item of items) {
        education.push({
          institution: item.institution || '',
          area: item.fieldOfStudy || '',
          studyType: item.degree || '',
          location: item.location || '',
          startDate: item.startDate || '',
          endDate: item.endDate || '',
          score: item.gpa || '',
          courses: [],
        });
      }
    } else if (s.type === 'skills') {
      for (const item of items) {
        const keywords = (item.skills || item.name || '')
          .split(/[,•;]+/)
          .map(k => k.trim())
          .filter(Boolean);
        skills.push({
          name: item.category || 'Skills',
          keywords,
        });
      }
    } else if (s.type === 'projects') {
      for (const item of items) {
        projects.push({
          name: item.name || '',
          description: stripHtml(item.description || ''),
          highlights: extractHighlights(item.description || ''),
          url: item.link || '',
          roles: item.role ? [item.role] : [],
          startDate: item.startDate || '',
          endDate: item.endDate || '',
        });
      }
    } else if (s.type === 'certifications') {
      for (const item of items) {
        certificates.push({
          name: item.name || '',
          issuer: item.issuer || '',
          date: item.date || '',
          url: item.url || '',
        });
      }
    } else if (s.type === 'awards') {
      for (const item of items) {
        awards.push({
          title: item.title || '',
          awarder: item.issuer || '',
          date: item.date || '',
          summary: item.description || '',
        });
      }
    }
  }

  return {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: {
      name: p.name || '',
      label: p.title || '',
      image: p.photo || '',
      email: p.email || '',
      phone: p.phone || '',
      url: p.website || '',
      summary: p.summary || '',
      location: {
        address: p.location || '',
      },
      profiles,
    },
    work,
    education,
    skills,
    projects,
    certificates,
    awards,
  };
}
