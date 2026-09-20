// The letterhead as its tests read it (27-cover-letter-header-fit, 27-cover-letter-grid-fit): the
// name and title runs apart from the contact runs, and what goes wrong between them.
import { resume, renderCover, read, overlaps, MM } from './harness.mjs';
import { PNG_2X2 as PNG } from './extractors.mjs';

export { PNG };

export const CONTACTS = { email: 'alexandra.johnson@example.com', phone: '+1 555 0100', location: 'San Francisco, CA', website: 'alexjohnson.dev', linkedin: 'linkedin.com/in/alexj' };

/** An icon (11 px = 8.25 pt) and the 2 pt gap before its value: where an icon contact starts. */
const ICON = 8.25 + 2;

/**
 * The letterhead as printed: `contacts` the runs above the body ("Hello") made of the contact
 * values and separators, each widened to the left by its icon when the contacts have icons;
 * `name` the others — the name and title, also a word cut off at the paper's edge.
 */
export async function letterhead({ name, title, photo = PNG, settings = {}, personal = {}, coverLetter = {}, template }) {
  const p = { name, title, photo, ...CONTACTS, ...personal };
  const [page] = await read(await renderCover(resume({ template, settings, personal: p, coverLetter: { body: '<p>Hello</p>', ...coverLetter } })));
  const body = page.items.find((t) => t.str === 'Hello');
  const head = page.items.filter((t) => t.y > body.y + 5);
  const values = `${Object.keys(CONTACTS).map((k) => p[k]).join(' ')} | •`;
  const isContact = (t) => t.str.split(/\s+/).every((w) => values.includes(w.replace(/-$/, '')));
  const icons = (settings.contactStyle || 'icon') === 'icon';
  return {
    page,
    right: page.W - (settings.marginH ?? 18) * MM,
    values: Object.keys(CONTACTS).map((k) => p[k]).filter(Boolean),
    name: head.filter((t) => !isContact(t)),
    contacts: head.filter(isContact).map((t) => (icons ? { ...t, x: t.x - ICON, w: t.w + ICON } : t)),
  };
}

/** "a" over "b" for each name run that overprints a contact run (icon included). */
export const overprints = (h) => overlaps({ items: [...h.name, ...h.contacts] })
  .filter(([a, b]) => h.name.some((t) => t.str === a) !== h.name.some((t) => t.str === b));
export const pastMargin = (h) => [...h.name, ...h.contacts].filter((t) => t.x + t.w > h.right + 0.5).map((t) => `${t.str} (to x ${(t.x + t.w).toFixed(1)}, margin ${h.right.toFixed(1)})`);
/**
 * Contacts printed over one another, where each value is a text of its own (not Bar or Bullet on
 * one line): two runs over each other, or one run holding two values — pdf.js reads a value drawn
 * over the next as one run.
 */
export const crowded = (h) => [
  ...overlaps({ items: h.contacts }).map(([a, b]) => `${a} over ${b}`),
  ...h.contacts.filter((t) => h.values.filter((v) => t.str.includes(v)).length > 1).map((t) => t.str),
];
/** Runs ending in a hyphen none of the letterhead's texts has: textkit's break inside a glued token. */
export const hyphens = (h) => [...h.name, ...h.contacts].filter((t) => t.str.endsWith('-')).map((t) => t.str);
