/**
 * Smart Cover Letter Generator
 * Synthesizes candidate's background, top achievements, and skills from their resume
 * to create high-converting, tailored cover letters.
 */

import { plainTextToHtml } from './richText.js';
import { storedText } from './storedText.js';

export const COVER_LETTER_ARCHETYPES = [
  {
    id: 'impact',
    name: 'Impact & Metrics-Driven',
    badge: 'Tech, Engineering & Data',
    description: 'Focuses on measurable outcomes, technical execution, scaling, and ROI.',
  },
  {
    id: 'leadership',
    name: 'Strategic & Leadership',
    badge: 'Management, PM & Executive',
    description: 'Highlights cross-functional leadership, vision, team enablement, and stakeholder alignment.',
  },
  {
    id: 'growth',
    name: 'Adaptability & Growth',
    badge: 'Career Switchers & High-Growth',
    description: 'Emphasizes rapid learning, versatility, modern methodologies, and mission alignment.',
  },
];

/** The editor's empty line (RichTextEditor), which the PDF and Word print as one blank line. */
export const BLANK_LINE = '<p><br></p>';

/** A section or entry: an object. A null (or other value) in a native .json or stored data is skipped. */
const isEntry = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/**
 * Extracts top accomplishments and skills from resume state. Every value is read as text
 * (storedText), whether or not the résumé has been through normalizeResume(): a skill group's
 * skills stored as a list, a number or an object threw here as the Cover Letter tab rendered, and
 * blanked the editor.
 */
export function extractResumeHighlights(resume) {
  const p = resume?.personal || {};
  const sections = Array.isArray(resume?.sections) ? resume.sections.filter(isEntry) : [];

  const expSec = sections.find(s => s.type === 'experience' && s.visible !== false);
  const skillsSec = sections.find(s => s.type === 'skills' && s.visible !== false);

  const topExperiences = [];
  if (expSec && Array.isArray(expSec.items)) {
    for (const item of expSec.items.filter(i => isEntry(i) && i.visible !== false)) {
      const role = storedText(item.role).trim();
      const company = storedText(item.company).trim();
      // A new Experience section starts with one blank entry: an entry with neither a role nor a
      // company has nothing to cite, so the letter cites the next one (R2-103).
      if (!role && !company) continue;
      topExperiences.push({ role, company, description: storedText(item.description) });
      if (topExperiences.length === 2) break;
    }
  }

  const topSkills = [];
  if (skillsSec && Array.isArray(skillsSec.items)) {
    for (const item of skillsSec.items.filter(i => isEntry(i) && i.visible !== false)) {
      const list = (storedText(item.skills) || storedText(item.name)).split(/[,•;]+/).map(s => s.trim()).filter(Boolean);
      topSkills.push(...list);
    }
  }

  // '' for a résumé with no name or title: the letter words around it, and its signature follows
  // the résumé's (R2-043) rather than printing a placeholder.
  return {
    candidateName: storedText(p.name).trim(),
    candidateTitle: storedText(p.title).trim(),
    summary: storedText(p.summary),
    topExperiences,
    topSkills: topSkills.slice(0, 8),
  };
}

/**
 * Where the most recent job was, as a clause: "as Lead at Acme", "as Lead", "at Acme", or '' — so
 * a job with a blank role or company never prints "as  at Acme" or "at ," (R2-103).
 */
function roleClause({ role, company }) {
  return [role && `as ${role}`, company && `at ${company}`].filter(Boolean).join(' ');
}

/**
 * Generates structured cover letter content tailored to role, company and archetype. It writes no
 * signature: the letter's own is the user's to type, and until then it signs with the résumé's
 * name and title as they are when it prints (letterSignature, R2-043).
 */
export function generateCoverLetter({
  resume,
  archetype = 'impact',
  company = '',
  role = '',
  recipientName = '',
}) {
  const highlights = extractResumeHighlights(resume);
  const targetCompany = company.trim() || '[Company Name]';
  const title = highlights.candidateTitle;
  const targetRole = role.trim() || title;
  // "the Staff Engineer role", else "the open role" — never "the  role" or "the the position role".
  const theRole = `the ${targetRole || 'open'}`;
  const typedRecipient = recipientName.trim();
  const recipient = typedRecipient || 'Hiring Team';
  const skillsStr = highlights.topSkills.length > 0 ? highlights.topSkills.slice(0, 4).join(', ') : 'modern best practices';

  // The most recent job with something to cite; with none, the résumé's title ("as Staff Engineer"),
  // else no clause at all — never the old "at prior roles" (R2-103).
  const mostRecent = roleClause(highlights.topExperiences[0] || { role: title, company: '' });
  // "as a Staff Engineer" in the opening, only when the résumé has a title.
  const asTitle = title ? ` as a ${title}` : '';

  const subject = [targetRole ? `Application for ${targetRole}` : 'Application', highlights.candidateName].filter(Boolean).join(' — ');
  let paragraphs = [];

  if (archetype === 'leadership') {
    paragraphs = [
      `Dear ${recipient},`,
      `I am writing to express my enthusiastic interest in ${theRole} role at ${targetCompany}. With a proven background${asTitle} specializing in driving scalable initiatives, aligning cross-functional teams, and delivering strategic value, I am confident in my ability to make an immediate, positive impact on your organization.`,
      `Throughout my career${mostRecent ? `, most notably ${mostRecent},` : ','} I have focused on empowering teams and bridging technical strategy with core business objectives. My approach centers on transparent communication, data-backed decision making, and establishing high standards for operational excellence across ${skillsStr}.`,
      `What particularly excites me about ${targetCompany} is your commitment to industry innovation and culture of excellence. I welcome the opportunity to discuss how my leadership experience, strategic mindset, and background can help achieve your upcoming milestones.`,
      `Thank you for your time and consideration.`,
    ];
  } else if (archetype === 'growth') {
    paragraphs = [
      `Dear ${recipient},`,
      `I am thrilled to submit my application for ${theRole} position at ${targetCompany}. Having built a strong foundation${asTitle}, I pride myself on rapid problem-solving, intellectual curiosity, and delivering results in dynamic environments.`,
      `In my experience${mostRecent ? ` ${mostRecent}` : ''}, I developed expertise in ${skillsStr}, consistently identifying bottlenecks and creating proactive solutions. I thrive when tackling novel challenges, mastering new technologies, and collaborating closely with talented peers to build high-quality work.`,
      `${targetCompany}'s forward-thinking approach strongly aligns with my own dedication to continuous learning and impact. I would love the chance to discuss how my adaptability, technical drive, and energy can add immediate value to your team.`,
      `Thank you for reviewing my application.`,
    ];
  } else {
    // Default: 'impact'
    paragraphs = [
      `Dear ${recipient},`,
      `I am writing to apply for ${theRole} opportunity at ${targetCompany}. With over several years of hands-on experience${asTitle}, I have dedicated my career to designing high-performance solutions, optimizing workflows, and delivering measurable business outcomes.`,
      `${mostRecent ? `During my tenure ${mostRecent}` : 'In my recent roles'}, I led critical initiatives utilizing ${skillsStr}. By emphasizing architectural rigor and quantifiable metrics, my work directly enhanced system reliability, user satisfaction, and team delivery velocity.`,
      `I have long admired ${targetCompany}'s achievements and innovative products. I am eager to bring my problem-solving mindset, engineering discipline, and passion for excellence to your team.`,
      `I look forward to discussing how my background and accomplishments align with the goals of ${targetCompany}. Thank you for your time and consideration.`,
    ];
  }

  // Every value above is text — résumé fields can come from an imported file — so each paragraph
  // is escaped before it is wrapped: a name like `<img onerror=…>` prints as typed, never as markup.
  // A line break inside a field reads as a space, as it did in the unescaped HTML, not as a <br>.
  // An empty paragraph — the blank line Enter-Enter leaves in the editor — separates two, so the
  // PDF and Word print them apart as the modal previews them, not 2 pt apart in one block (R2-130).
  const htmlBody = paragraphs.map(p => `<p>${plainTextToHtml(p.replace(/\s*[\r\n]+\s*/g, ' '))}</p>`).join(BLANK_LINE);

  // The recipient block holds only what the user typed (AUD-31): the letter prints every filled
  // line, so a generic 'Hiring Manager' for a blank name sat above "Dear Hiring Team,", and the
  // modal asks for no title, so any title here was one the user never gave ('Hiring Team').
  return {
    recipientName: typedRecipient,
    recipientTitle: '',
    company: targetCompany === '[Company Name]' ? '' : targetCompany,
    subject,
    body: htmlBody,
    closing: 'Sincerely,',
  };
}
