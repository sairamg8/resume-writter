import { DesignSection, Label, SegmentControl } from '@/components/DesignPanelShared';
import { linkStyleOf } from '@/utils/linkStyle';

/** The link styles the panel offers (LINK_STYLES, src/utils/linkStyle.js). */
const LINK_OPTIONS = [
  { value: 'plain',     label: 'Plain' },
  { value: 'underline', label: 'Underline' },
  { value: 'accent',    label: 'Accent' },
];

/**
 * Design → Links: how every link the résumé prints looks (settings.linkStyle, R2-147) — its contacts,
 * an entry's URL, a link in a description or the cover letter — in the PDF (= the preview) and the
 * Word export. Plain, which every résumé storing no style prints, is marked for one.
 */
export function LinksSection({ settings, updateSetting, onReset }) {
  return (
    <DesignSection title="Links" onReset={onReset}>
      <div>
        <Label>Style</Label>
        <SegmentControl options={LINK_OPTIONS} value={linkStyleOf(settings.linkStyle)} onChange={v => updateSetting('linkStyle', v)} />
      </div>
      <p className="text-[11px] text-gray-400 leading-relaxed">
        Contacts, entries&rsquo; URLs and links in descriptions. Plain prints them as the text around them; on a banner or the Sidebar&rsquo;s column, Accent takes the shade of it that reads there. The Markdown and ATS text exports print the words only.
      </p>
    </DesignSection>
  );
}
