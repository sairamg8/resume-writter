/**
 * Design → Section Headings → Icons (settings.sectionIcons, R2-147): the small icon a section title
 * prints before its words, one per section type, as data — [tag, attributes] on a 24×24 view box,
 * the shape contactIconPaths.js keeps its packs in, so the PDF draws them the way it draws a contact
 * icon (PdfIcons.jsx). Lucide's outlines (ISC), stroked in the heading's colour.
 * The icon only decorates: the title's words print as before, and the Word, Markdown and ATS text
 * exports never carry it.
 */
const ICONS = {
  // briefcase
  experience: [
    ['path', { d: 'M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16' }],
    ['rect', { x: 2, y: 6, width: 20, height: 14, rx: 2 }],
  ],
  // graduation-cap
  education: [
    ['path', { d: 'M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z' }],
    ['path', { d: 'M22 10v6' }],
    ['path', { d: 'M6 12.5V16a6 3 0 0 0 12 0v-3.5' }],
  ],
  // wrench
  skills: [
    ['path', { d: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z' }],
  ],
  // folder
  projects: [
    ['path', { d: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z' }],
  ],
  // languages
  languages: [
    ['path', { d: 'm5 8 6 6' }],
    ['path', { d: 'm4 14 6-6 2-3' }],
    ['path', { d: 'M2 5h12' }],
    ['path', { d: 'M7 2h1' }],
    ['path', { d: 'm22 22-5-10-5 10' }],
    ['path', { d: 'M14 18h6' }],
  ],
  // award (a rosette: a badge)
  certifications: [
    ['path', { d: 'm15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526' }],
    ['circle', { cx: 12, cy: 8, r: 6 }],
  ],
  // trophy
  awards: [
    ['path', { d: 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6' }],
    ['path', { d: 'M18 9h1.5a2.5 2.5 0 0 0 0-5H18' }],
    ['path', { d: 'M4 22h16' }],
    ['path', { d: 'M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22' }],
    ['path', { d: 'M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22' }],
    ['path', { d: 'M18 2H6v7a6 6 0 0 0 12 0V2Z' }],
  ],
  // heart
  volunteering: [
    ['path', { d: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z' }],
  ],
  // users
  references: [
    ['path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }],
    ['circle', { cx: 9, cy: 7, r: 4 }],
    ['path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87' }],
    ['path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' }],
  ],
  // star
  interests: [
    ['path', { d: 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z' }],
  ],
  // bookmark: a section the user named
  custom: [
    ['path', { d: 'm19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z' }],
  ],
  // user: the Sidebar's "About Me" (the summary's one heading)
  summary: [
    ['path', { d: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2' }],
    ['circle', { cx: 12, cy: 7, r: 4 }],
  ],
  // contact: the Sidebar column's "Contact"
  contact: [
    ['path', { d: 'M16 2v2' }],
    ['path', { d: 'M7 22v-2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2' }],
    ['path', { d: 'M8 2v2' }],
    ['circle', { cx: 12, cy: 11, r: 3 }],
    ['rect', { x: 3, y: 4, width: 18, height: 18, rx: 2 }],
  ],
};

/** The icon kinds, by section type (plus 'summary' and 'contact'); any other type prints Custom's. */
export const SECTION_ICON_TYPES = Object.keys(ICONS);

/** The space between the icon and the title's first letter, in multiples of the title's font size. */
export const SECTION_ICON_GAP_EM = 0.45;

/**
 * The shapes of `type`'s icon, stroked in `color`, ready for react-pdf: [{ tag, props }] as
 * iconShapes (contactIconPaths.js) gives them. A type with no icon of its own (a custom section,
 * whatever it is called) gets Custom's.
 */
export function sectionIconShapes(type, color = 'currentColor') {
  const shapes = ICONS[type] || ICONS.custom;
  return shapes.map(([tag, attrs]) => ({
    tag,
    props: { fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ...attrs },
  }));
}
