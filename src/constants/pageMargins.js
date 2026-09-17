// The page margins a résumé prints with: `settings.marginV` top and bottom, `settings.marginH`
// left and right, in mm. Its cover letter takes the same. The Design panel's Spacing section sets
// each from 0 to 40 mm, on every build; the PDF (= the preview) prints what is stored, and none of
// it was drawn for more. An imported .json, a hand-edited store or a cloud copy can carry any
// number: past 40 mm the Sidebar column's text and photo ran off its dark panel onto the white
// page (VF2-3.2-NB1), a margin wider than half the paper made the render throw and a tall one
// never finished. normalizeResume() brings a stored margin into this range wherever résumés come
// in (withSpacingNumbers, spacingNumbers.js, which also drops one that is not a number).

/** The margins the editor offers, in mm: its Top / Bottom and Left / Right inputs' bounds. */
export const MARGIN_MM = { min: 0, max: 40 };

/** The page's margins in mm, as it prints them: `v` top and bottom, `h` left and right. */
export const pageMargins = (settings) => ({ v: settings?.marginV ?? 14, h: settings?.marginH ?? 18 });

