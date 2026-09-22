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
    for (const item of expSec.items.filter(isEntry).slice(0, 2)) {
      topExperiences.push({
        role: storedText(item.role),
        company: storedText(item.company),
        description: storedText(item.description),
      });
    }
  }

  const topSkills = [];
  if (skillsSec && Array.isArray(skillsSec.items)) {
    for (const item of skillsSec.items.filter(isEntry)) {
      const list = (storedText(item.skills) || storedText(item.name)).split(/[,•;]+/).map(s => s.trim()).filter(Boolean);
      topSkills.push(...list);
    }
  }

  return {
    candidateName: storedText(p.name) || 'Candidate',
    candidateTitle: storedText(p.title) || 'Professional',
    summary: storedText(p.summary),
    topExperiences,
    topSkills: topSkills.slice(0, 8),
  };
}

/**
 * Generates structured cover letter content tailored to role, company and archetype.
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
  const targetRole = role.trim() || highlights.candidateTitle || 'the position';
  const recipient = recipientName.trim() || 'Hiring Team';
  const skillsStr = highlights.topSkills.length > 0 ? highlights.topSkills.slice(0, 4).join(', ') : 'modern best practices';

  const mostRecent = highlights.topExperiences[0] || {
    role: highlights.candidateTitle,
    company: 'prior roles',
  };

  let subject = `Application for ${targetRole} — ${highlights.candidateName}`;
  let paragraphs = [];

  if (archetype === 'leadership') {
    paragraphs = [
      `Dear ${recipient},`,
      `I am writing to express my enthusiastic interest in the ${targetRole} role at ${targetCompany}. With a proven background as a ${highlights.candidateTitle} specializing in driving scalable initiatives, aligning cross-functional teams, and delivering strategic value, I am confident in my ability to make an immediate, positive impact on your organization.`,
      `Throughout my career, most notably as ${mostRecent.role} at ${mostRecent.company}, I have focused on empowering teams and bridging technical strategy with core business objectives. My approach centers on transparent communication, data-backed decision making, and establishing high standards for operational excellence across ${skillsStr}.`,
      `What particularly excites me about ${targetCompany} is your commitment to industry innovation and culture of excellence. I welcome the opportunity to discuss how my leadership experience, strategic mindset, and background can help achieve your upcoming milestones.`,
      `Thank you for your time and consideration.`,
    ];
  } else if (archetype === 'growth') {
    paragraphs = [
      `Dear ${recipient},`,
      `I am thrilled to submit my application for the ${targetRole} position at ${targetCompany}. Having built a strong foundation as a ${highlights.candidateTitle}, I pride myself on rapid problem-solving, intellectual curiosity, and delivering results in dynamic environments.`,
      `In my experience at ${mostRecent.company}, I developed expertise in ${skillsStr}, consistently identifying bottlenecks and creating proactive solutions. I thrive when tackling novel challenges, mastering new technologies, and collaborating closely with talented peers to build high-quality work.`,
      `${targetCompany}'s forward-thinking approach strongly aligns with my own dedication to continuous learning and impact. I would love the chance to discuss how my adaptability, technical drive, and energy can add immediate value to your team.`,
      `Thank you for reviewing my application.`,
    ];
  } else {
    // Default: 'impact'
    paragraphs = [
      `Dear ${recipient},`,
      `I am writing to apply for the ${targetRole} opportunity at ${targetCompany}. With over several years of hands-on experience as a ${highlights.candidateTitle}, I have dedicated my career to designing high-performance solutions, optimizing workflows, and delivering measurable business outcomes.`,
      `During my tenure as ${mostRecent.role} at ${mostRecent.company}, I led critical initiatives utilizing ${skillsStr}. By emphasizing architectural rigor and quantifiable metrics, my work directly enhanced system reliability, user satisfaction, and team delivery velocity.`,
      `I have long admired ${targetCompany}'s achievements and innovative products. I am eager to bring my problem-solving mindset, engineering discipline, and passion for excellence to your team.`,
      `I look forward to discussing how my background and accomplishments align with the goals of ${targetCompany}. Thank you for your time and consideration.`,
    ];
  }

  // Every value above is text — résumé fields can come from an imported file — so each paragraph
  // is escaped before it is wrapped: a name like `<img onerror=…>` prints as typed, never as markup.
  // A line break inside a field reads as a space, as it did in the unescaped HTML, not as a <br>.
  const htmlBody = paragraphs.map(p => `<p>${plainTextToHtml(p.replace(/\s*[\r\n]+\s*/g, ' '))}</p>`).join('');

  return {
    recipientName: recipientName.trim() || 'Hiring Manager',
    recipientTitle: 'Hiring Team',
    company: targetCompany === '[Company Name]' ? '' : targetCompany,
    subject,
    body: htmlBody,
    closing: 'Sincerely,',
    signatureName: highlights.candidateName,
    signatureDesignation: highlights.candidateTitle,
  };
}
