// The page margins a résumé prints with: `settings.marginV` top and bottom, `settings.marginH`
// left and right, in mm. Its cover letter takes the same. The Design panel's Spacing section sets
// each from 0 to 40 mm, on every build; the PDF (= the preview) prints what is stored, and none of
// it was drawn for more. An imported .json, a hand-edited store or a cloud copy can carry any
// number: past 40 mm the Sidebar column's text and photo ran off its dark panel onto the white
// page (VF2-3.2-NB1), a margin wider than half the paper made the render throw and a tall one
// never finished. normalizeResume() brings a stored margin into this range wherever résumés come in.

/** The margins the editor offers, in mm: its Top / Bottom and Left / Right inputs' bounds. */
export const MARGIN_MM = { min: 0, max: 40 };

const MARGIN_KEYS = ['marginV', 'marginH'];

/**
 * A stored margin in the editor's range: a number, or text the PDF reads as one ("60"), clamped to
 * MARGIN_MM as a number. `undefined` for anything else — none (the PDF's default prints) or a
 * value that is not a number at all — which is left as it is.
 */
function marginInRange(value) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
  return Math.min(MARGIN_MM.max, Math.max(MARGIN_MM.min, n));
}

/**
 * `resume` with its margins in the editor's range (marginInRange), whatever its data version: an
 * import of this build's own file can carry any number. One the editor could have set prints and
 * stays as it is. The same object when nothing changes; settings that are not an object are left.
 */
export function withMarginsInRange(resume) {
  const settings = resume?.settings;
  if (!settings || typeof settings !== 'object') return resume;
  const changed = MARGIN_KEYS.filter((key) => {
    const kept = marginInRange(settings[key]);
    return kept !== undefined && kept !== settings[key];
  });
  if (!changed.length) return resume;
  const next = { ...settings };
  for (const key of changed) next[key] = marginInRange(settings[key]);
  return { ...resume, settings: next };
}
