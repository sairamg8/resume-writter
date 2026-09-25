import { DesignSection, Label, SegmentControl } from '@/components/DesignPanelShared';
import { bulletStyleOf } from '@/utils/richText';

/** The bullet styles the panel offers (BULLET_STYLES, src/utils/richText.js), each shown with its glyph. */
const BULLET_OPTIONS = [
  { value: 'bullet', label: '• Bullet' },
  { value: 'dash',   label: '– Dash' },
  { value: 'circle', label: '◦ Circle' },
  { value: 'none',   label: 'None' },
];

/**
 * Design → Lists: the glyph in front of every bulleted list item the résumé prints (settings.bulletStyle,
 * R2-147) — the summary's, each entry's description's, and the cover letter's — in the PDF (= the
 * preview) and the Word export. Bullet, which every résumé storing no style prints, is marked for one.
 */
export function ListsSection({ settings, updateSetting, onReset }) {
  return (
    <DesignSection title="Lists" onReset={onReset}>
      <div>
        <Label>Bullet</Label>
        <SegmentControl options={BULLET_OPTIONS} value={bulletStyleOf(settings.bulletStyle)} onChange={v => updateSetting('bulletStyle', v)} />
      </div>
      <p className="text-[11px] text-gray-400 leading-relaxed">
        Every bulleted list in the summary, the entries&rsquo; descriptions and the cover letter. Numbered lists keep their numbers, and the text stays where it is. The Markdown and ATS text exports keep their plain &ldquo;-&rdquo; and &ldquo;*&rdquo;.
      </p>
    </DesignSection>
  );
}
