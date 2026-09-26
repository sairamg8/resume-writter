import { useEffect, useId, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ATS_DEFAULTS, sectionReset } from '@/utils/defaultData';
import { contactIconHint, drawsContactIcons, templateId, templateSwitchNote } from '@/constants/templates';
import { pickerCards } from '@/utils/templatePicker';
import { usePickCard } from '@/hooks/usePickCard';
import { LetterheadNote, SavedDesigns, templateCard } from '@/components/DesignPanelTemplate';
import { MARGIN_MM } from '@/constants/pageMargins';
import { PAGE_SIZES, PAGE_SIZE_IDS, pageSizeOf } from '@/constants/pageSize';
import { ICON_SIZE } from '@/constants/designNumbers';
import { ITEM_GAP_PX, LINE_HEIGHT, SECTION_GAP_PX } from '@/constants/spacingNumbers';
import { DesignSection, NumberRow, Label, SegmentControl } from '@/components/DesignPanelShared';
import { HeadingsSection } from '@/components/DesignPanelHeadings';
import { ColorsSection } from '@/components/DesignPanelColors';
import { TypographySection } from '@/components/DesignPanelTypography';
import { DatesSection } from '@/components/DesignPanelDates';
import { ListsSection } from '@/components/DesignPanelLists';
import { LinksSection } from '@/components/DesignPanelLinks';
import { PageNumbersSection } from '@/components/DesignPanelPageNumbers';
import {
  ICON_SET_OPTIONS,
  ContactIcon,
  getIconSetId,
} from '@/utils/contactIcons';
import { CONTACT_FIELDS } from '@/utils/contacts';
import { ONE_PAGE_FIT, fitOnePage, printedKey } from '@/utils/pageFit';

const COLOR_KEYS      = ['accentColor', 'textColor', 'sidebarBg', 'headerTextColor', 'nameColor', 'jobTitleColor'];
const TYPOGRAPHY_KEYS = ['font', 'fontSize', 'fontSizeBase', 'fontSizeNameDelta', 'fontSizeSectionDelta', 'fontSizeEntryDelta', 'customFont', 'iconSize', 'sectionLetterSpacing', 'fontSizeTitleDelta', 'nameFont', 'headingFont'];
const SPACING_KEYS    = ['lineHeightValue', 'marginV', 'marginH', 'sectionGap', 'itemGap'];
const HEADING_KEYS    = ['headingStyle', 'sectionTitleCase', 'sectionBorderWidth', 'sectionBorderColor', 'sectionIcons'];
// Not contactStyle: Header Customization's, and the ↺ here turned a Bar or Bullet header to Icon (R2-090).
const ICON_KEYS       = ['iconSet', 'iconSize'];
const DATE_KEYS       = ['dateFormat'];
const LIST_KEYS       = ['bulletStyle'];
const LINK_KEYS       = ['linkStyle'];
const PAGE_NUMBER_KEYS = ['pageNumbers'];
// The paper, by its name and size as the editor states them: "A4 · 210 × 297 mm".
const PAGE_SIZE_OPTIONS = PAGE_SIZE_IDS.map(id => ({ label: `${PAGE_SIZES[id].label} · ${PAGE_SIZES[id].dims}`, value: id }));

/**
 * Design → the résumé's look. Beyond the store's setting actions: `designs` (the ones the user saved,
 * savedDesigns) with `applyDesign`, `saveDesign` and `deleteDesign` (B4); `restoreDesign`, Undo after a
 * switch (A4); `onBrowseTemplates`, the gallery (A2); `templateOpen` / `onTemplateOpenChange`, whether
 * Template is open, kept by the editor across tabs (A12). Each is optional: without it, its control is not
 * offered.
 */
export default function DesignPanel({
  resume, updateSetting, setTemplate, resetSettings, designs = [], applyDesign, saveDesign, deleteDesign, restoreDesign,
  onBrowseTemplates, templateOpen, onTemplateOpenChange,
}) {
  const settings = resume.settings || {};
  const current = templateId(resume.template); // the template the PDF prints
  // Modern and Sidebar draw the pack whatever Contact style says, the others only with Icon.
  const drawsIcons = drawsContactIcons(current, settings);
  const [confirmReset, setConfirmReset] = useState(false);
  const pageSizeLabelId = useId();
  const [fitting, setFitting] = useState(false);
  const [fitNotice, setFitNotice] = useState('');
  const fitRun = useRef(false); // a fit is measuring: a second click waits for it, not starts another
  const latest = useRef(resume);
  latest.current = resume;
  const mounted = useRef(true);
  // Set again on mount: StrictMode's trial unmount (main.jsx) left it false, and every fit was dropped.
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  /**
   * 1-Page Fit (R2-149): the preset at once, then the résumé is printed at it and, while it runs past
   * one page, at each tighter step (pageFit.js) — the first that fits is written. Left mid-measure
   * (another résumé, the editor closed) or changed while it measures (another template, a margin
   * typed, Reset), it stops and writes nothing more: the steps were measured on a résumé no longer
   * there, and updateSetting writes to whichever résumé is open.
   */
  async function fitToOnePage() {
    if (fitRun.current) return;
    fitRun.current = true;
    setFitting(true);
    setFitNotice('');
    Object.entries(ONE_PAGE_FIT).forEach(([k, v]) => updateSetting(k, v));
    const id = resume.id;
    const measured = { ...resume, settings: { ...settings, ...ONE_PAGE_FIT } };
    // As clicked (the preset's writes not rendered yet) or with the preset: anything else is an edit.
    const keys = new Set([printedKey(resume), printedKey(measured)]);
    const stopped = () => !mounted.current || latest.current?.id !== id || !keys.has(printedKey(latest.current));
    let notice = '';
    try {
      const fit = await fitOnePage(measured, { stopped });
      if (!fit || stopped()) return;
      Object.entries(fit.settings).forEach(([k, v]) => { if (ONE_PAGE_FIT[k] !== v) updateSetting(k, v); });
      if (fit.pages > 1) notice = `Still ${fit.pages} pages at the tightest spacing — shorten the content to fit one page.`;
    } catch {
      notice = 'Could not measure the pages: the tight spacing is applied, check the preview.';
    } finally {
      fitRun.current = false;
      if (mounted.current) { setFitting(false); setFitNotice(notice); }
    }
  }

  /** A section's reset: its settings back to the template's defaults (Sidebar's plain headings, …). */
  function resetSection(keys) {
    const updated = sectionReset(resume.template, keys, settings);
    keys.forEach(k => { if (k in updated) updateSetting(k, updated[k]); });
  }

  // Every card, from the data (utils/templatePicker.js): the templates — the Sidebar's single column a
  // card of its own (A9) — the app's designs (R2-138) and the user's (B4). The one the résumé is on is
  // marked, a design's and not its engine's; picking one goes through the store (usePickCard).
  const cards = pickerCards(settings, designs);
  const { pick, selected } = usePickCard(resume, { setTemplate, updateSetting, applyDesign, restoreDesign });
  const card = (c) => templateCard(c, { on: selected(c), onPick: pick });
  const onCard = cards.find(selected) || cards.find((c) => c.engine === current && !c.preset);

  return (
    <div className="space-y-3 py-2">

      <DesignSection title="Template" defaultOpen open={templateOpen} onOpenChange={onTemplateOpenChange}>
        {onBrowseTemplates && (
          <button
            type="button"
            data-testid="browse-templates"
            onClick={onBrowseTemplates}
            className="w-full mb-2 px-3 py-2 text-xs font-semibold rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
          >
            Browse templates ({cards.filter((c) => !c.own).length}) · pictures and filters
          </button>
        )}
        <div className="space-y-1.5">
          {cards.filter((c) => !c.preset).map(card)}
          {/* The designs (R2-138): a named look over a template the app draws — its engine and a bundle
              of design settings. Picked, it goes through the store as a template switch does. */}
          <p className="pt-2 text-[11px] font-semibold text-gray-500">Designs · a named look over a template</p>
          {cards.filter((c) => c.preset && !c.own).map(card)}
          <p className="text-[10px] text-gray-400">A design brings its font, colours and heading style too; picking its template plainly takes back what you kept of them, and Reset returns to the design.</p>
          {(saveDesign || designs.length > 0) && (
            <SavedDesigns cards={cards.filter((c) => c.own)} isOn={selected} onPick={pick} saveDesign={saveDesign} deleteDesign={deleteDesign} />
          )}
        </div>
        {current === 'sidebar' && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <Label>Layout</Label>
            <SegmentControl
              options={[
                { label: 'Two columns', value: false },
                { label: 'Single · ATS-safe', value: true },
              ]}
              value={!!settings.sidebarSingleColumn}
              onChange={v => updateSetting('sidebarSingleColumn', v)}
            />
            <p className="text-[10px] text-gray-400 mt-2">
              Single column reads cleanly in every applicant-tracking system. The two-column look can interleave when a portal parses it.
            </p>
          </div>
        )}
        {current === 'academic' && (
          <p className="text-[10px] text-gray-400 mt-2">
            Academic brings its own type and spacing: a serif, a centred header, section titles at the body&apos;s size and tighter Spacing. Every one of them can be changed below.
          </p>
        )}
        {current === 'compact' && (
          <p className="text-[10px] text-gray-400 mt-2">
            Compact brings its own type and spacing: 9 pt text, narrow margins, the job title beside the name and tighter Spacing, and lays skills, certifications, awards, languages and references out two to a row (each section&apos;s Grids). Every one of them can be changed.
          </p>
        )}
        <p className="text-[10px] text-gray-400 mt-2">{templateSwitchNote()}</p>
        <LetterheadNote card={onCard} />
      </DesignSection>

      <ColorsSection resume={resume} settings={settings} updateSetting={updateSetting} onReset={() => resetSection(COLOR_KEYS)} />

      <DesignSection title="Contact icons" defaultOpen onReset={() => resetSection(ICON_KEYS)}>
        <p className="text-[11px] text-gray-400 mb-2 leading-relaxed">
          {contactIconHint(current, settings, resume?.coverLetter)}
        </p>
        <div className="space-y-2">
          {ICON_SET_OPTIONS.map(opt => {
            const active = getIconSetId(settings) === opt.id;
            const previewSettings = { ...settings, iconSet: opt.id, customContactIcons: {} };
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  updateSetting('iconSet', opt.id);
                  // Only where the style hides the pack. In Modern and Sidebar it is the letter's
                  // style too, and the one a switch to Classic brings back: left alone (R9-4).
                  if (!drawsIcons) updateSetting('contactStyle', 'icon');
                }}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                  active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div>
                    <p className={`text-sm font-medium ${active ? 'text-blue-700' : 'text-gray-700'}`}>{opt.label}</p>
                    <p className="text-[10px] text-gray-400">{opt.desc}</p>
                  </div>
                  {active && <span className="text-[10px] font-semibold text-blue-600">Selected</span>}
                </div>
                <div className={`flex items-center gap-2.5 ${active ? 'text-blue-700' : 'text-gray-600'}`}>
                  {CONTACT_FIELDS.map(({ key, label }) => (
                    <span key={key} className="inline-flex w-5 h-5 items-center justify-center" title={label}>
                      <ContactIcon field={key} settings={previewSettings} size={16} />
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
          <span className="text-xs text-gray-500">Icon size</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => updateSetting('iconSize', Math.max(ICON_SIZE.min, (settings.iconSize ?? 11) - 1))}
              className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 hover:bg-gray-100 text-base leading-none"
            >−</button>
            <span className="w-10 text-center text-xs font-medium text-gray-700 border border-gray-200 rounded h-6 flex items-center justify-center">
              {settings.iconSize ?? 11}px
            </span>
            <button
              type="button"
              onClick={() => updateSetting('iconSize', Math.min(ICON_SIZE.max, (settings.iconSize ?? 11) + 1))}
              className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 hover:bg-gray-100 text-base leading-none"
            >+</button>
          </div>
        </div>
      </DesignSection>

      <TypographySection settings={settings} template={current} updateSetting={updateSetting} onReset={() => resetSection(TYPOGRAPHY_KEYS)} />

      <DesignSection title="Spacing" onReset={() => resetSection(SPACING_KEYS)}>
        <div className="space-y-3">
          {/* Smart Page Fit Presets */}
          <div className="p-2.5 bg-blue-50/60 border border-blue-100 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-blue-900">
              <span className="flex items-center gap-1.5"><Sparkles size={12} className="text-blue-600" /> Smart Page Fit Presets</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={fitToOnePage}
                disabled={fitting}
                title="Fit more onto 1 page by safely tightening margins and line heights"
                className="px-2 py-1.5 text-[11px] font-medium rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-100/70 shadow-2xs transition-all text-center cursor-pointer disabled:opacity-60 disabled:cursor-wait"
              >
                {fitting ? 'Fitting…' : '📄 1-Page Fit'}
              </button>
              <button
                type="button"
                onClick={() => {
                  updateSetting('marginV', 14);
                  updateSetting('marginH', 18);
                  updateSetting('sectionGap', 16);
                  updateSetting('itemGap', 8);
                  updateSetting('lineHeightValue', 1.5);
                }}
                title="Standard ATS-optimized balanced spacing"
                className="px-2 py-1.5 text-[11px] font-medium rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 shadow-2xs transition-all text-center cursor-pointer"
              >
                ⚖️ Balanced
              </button>
              <button
                type="button"
                onClick={() => {
                  updateSetting('marginV', 20);
                  updateSetting('marginH', 22);
                  updateSetting('sectionGap', 22);
                  updateSetting('itemGap', 12);
                  updateSetting('lineHeightValue', 1.65);
                }}
                title="Generous spacing for 2-page or senior resumes"
                className="px-2 py-1.5 text-[11px] font-medium rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 shadow-2xs transition-all text-center cursor-pointer"
              >
                📑 Spacious
              </button>
            </div>
            {fitNotice && <p className="text-[11px] text-amber-800">{fitNotice}</p>}
          </div>

          <NumberRow label="Line Height" value={settings.lineHeightValue ?? 1.5} onChange={v => updateSetting('lineHeightValue', v)} min={LINE_HEIGHT.min} max={LINE_HEIGHT.max} step={0.1} />
          <div className="h-px bg-gray-100" />
          {/* The paper the résumé and its cover letter print on (R2-136): the PDF, the preview and both
              Word files read it (pageSizeOf). None stored reads as A4, the page every résumé printed on
              before, so A4 shows selected for it. */}
          <div role="group" aria-labelledby={pageSizeLabelId} className="space-y-1.5">
            <p id={pageSizeLabelId} className="text-xs text-gray-600">Page size</p>
            <SegmentControl options={PAGE_SIZE_OPTIONS} value={pageSizeOf(settings)} onChange={v => updateSetting('pageSize', v)} />
          </div>
          <NumberRow label="Top / Bottom margin" value={settings.marginV ?? 14} onChange={v => updateSetting('marginV', v)} min={MARGIN_MM.min} max={MARGIN_MM.max} step={1} unit="mm" />
          <NumberRow label="Left / Right margin" value={settings.marginH ?? 18} onChange={v => updateSetting('marginH', v)} min={MARGIN_MM.min} max={MARGIN_MM.max} step={1} unit="mm" />
          <div className="h-px bg-gray-100" />
          <NumberRow label="Between Sections" value={settings.sectionGap ?? 16} onChange={v => updateSetting('sectionGap', v)} min={SECTION_GAP_PX.min} max={SECTION_GAP_PX.max} step={1} unit="px" />
          <NumberRow label="Between Items" value={settings.itemGap ?? ATS_DEFAULTS.itemGap} onChange={v => updateSetting('itemGap', v)} min={ITEM_GAP_PX.min} max={ITEM_GAP_PX.max} step={1} unit="px" />
        </div>
      </DesignSection>

      <HeadingsSection settings={settings} template={current} updateSetting={updateSetting} onReset={() => resetSection(HEADING_KEYS)} />

      <DatesSection settings={settings} updateSetting={updateSetting} onReset={() => resetSection(DATE_KEYS)} />

      <ListsSection settings={settings} updateSetting={updateSetting} onReset={() => resetSection(LIST_KEYS)} />

      <LinksSection settings={settings} updateSetting={updateSetting} onReset={() => resetSection(LINK_KEYS)} />

      <PageNumbersSection settings={settings} updateSetting={updateSetting} onReset={() => resetSection(PAGE_NUMBER_KEYS)} />

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-amber-800">Reset Design Settings</p>
            <p className="text-[10px] text-amber-600 mt-0.5">
              {confirmReset
                ? 'This will reset all design settings to this template\'s ATS-safe defaults. Resume content and uploaded contact icons are kept.'
                : 'Resets font, colors, spacing, and layout settings to this template\'s ATS-safe defaults.'}
            </p>
          </div>
          {confirmReset ? (
            <div className="flex gap-1.5 shrink-0">
              <button onClick={() => { resetSettings?.(); setConfirmReset(false); }} className="px-3 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">Yes, Reset</button>
              <button onClick={() => setConfirmReset(false)} className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmReset(true)} className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors shrink-0">Reset</button>
          )}
        </div>
      </div>
    </div>
  );
}
