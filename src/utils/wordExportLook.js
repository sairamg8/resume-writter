// How the Word résumé prints a section's entries (buildSection's `look`): the sizes, the spacing of
// Design → Spacing (R2-062) and the colours (R2-063) its PDF prints the same section in.
import { accent2Hex, wordContentTwips } from '@/utils/wordExportUtils';
import { templateId } from '@/constants/templates';
import { solid, textShades } from '@/templates/pdf/shared/pdfColors';
import { getEffectiveSpacing } from '@/templates/pdf/shared/PdfSections';

/**
 * The colours of a section's entries, 'rrggbb', as the PDF prints them on the white page, from the
 * résumé's resolved settings `s` (resolveTemplateSettings) on template `tid` (R2-063):
 * - `text` — the Text colour: an entry's title, a language, a reference's name;
 * - `second` — an entry's second field (role or company, degree, organisation, subtitle), as
 *   ItemHeader prints it: the accent at 85 % on Modern, at 80 % on the Sidebar's page, else `sub`;
 * - `sub`, `meta`, `muted`, `body` — the Text colour's shades (textShades): skills, issuers and a
 *   reference's role; a relationship and a project's technologies; a location and a credential ID;
 *   descriptions and legacy bullets;
 * - `tech` — a project's technologies: the accent at 70 % in the Sidebar's main column, else `meta`;
 * - `bar` — a Bars skill: the Text colour at 80 %.
 * The Sidebar's side column prints light on its dark panel; Word has no panel, so it takes these too.
 */
export function entryInk(s, tid) {
  const shade = textShades(s.textColor);
  const hex = (color, fallback = '6b7280') => accent2Hex(solid(color), fallback);
  const accentAt = (alpha) => hex(solid(s.accentColor, alpha), accent2Hex(s.accentColor));
  const onAccent = { modern: 0.85, sidebar: 0.8 }[tid];
  return {
    text: hex(s.textColor, '1a1a1a'),
    second: onAccent ? accentAt(onAccent) : hex(shade.sub),
    sub: hex(shade.sub),
    meta: hex(shade.meta),
    muted: hex(shade.muted),
    body: hex(shade.body, '374151'),
    tech: tid === 'sidebar' ? accentAt(0.7) : hex(shade.meta),
    bar: hex(solid(s.textColor, 0.8)),
  };
}

/**
 * The `look` buildSection's builders print `section` in, from the résumé's `settings` and their
 * resolved `s`:
 * - `base` and `entry` — the body's and the entry titles' sizes, half-points;
 * - `tab` — the dates' right tab, twips: the right margin (wordContentTwips);
 * - `line` — Design → Line Height;
 * - `gap` — the space between two entries, pt: Design → Between Items scaled by the section's
 *   Spacing preset, or its own Item gap (getEffectiveSpacing, R2-062);
 * - `side` — the section is in the Sidebar's side column; `template` — the template's id;
 * - `ink` — the entries' colours (entryInk).
 */
export function sectionLook(section, settings, s, template, side) {
  const tid = templateId(template);
  return {
    base: Math.round((s.fontSizeBase ?? 11) * 2),
    entry: Math.round(((s.fontSizeBase ?? 11) + (s.fontSizeEntryDelta ?? 0)) * 2),
    tab: wordContentTwips(settings),
    line: s.lineHeightValue,
    gap: getEffectiveSpacing(section, s).itemGap,
    side,
    template: tid,
    ink: entryInk(s, tid),
  };
}
