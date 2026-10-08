import { ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { HEADER_BORDER_PT, ICON_SIZE } from '@/constants/designNumbers';
import { contactLayoutOf, contactStyleOf, drawsContactIcons, hasHeaderControls, headerBorderOn, headerControlTemplateLabels } from '@/constants/templates';
import { ICON_SET_OPTIONS, getIconSetId } from '@/utils/contactIcons';
import { headerGapRows, headerGapKeysSet, RESUME_GAP_KEYS } from '@/utils/headerSpacingRows';
import { HeaderSpacingGroup } from '@/components/HeaderSpacingControls';
import { usePrintableImage } from '@/hooks/usePrintableImage';
import { useTypedNumber } from '@/hooks/useTypedNumber';

function LayoutPreview({ type }) {
  const bar = (w) => <div className="h-1 bg-cv-faint rounded-sm" style={{ width: w }} />;

  if (type === 'stack') return (
    <div className="flex flex-col gap-1 items-start w-full px-1">
      <div className="h-1.5 bg-cv-muted rounded-sm w-3/4" />
      <div className="h-1 bg-cv-faint rounded-sm w-1/2" />
      <div className="flex gap-1 mt-0.5">{bar('28%')}{bar('28%')}{bar('28%')}</div>
    </div>
  );

  if (type === 'inline') return (
    <div className="flex flex-col gap-1 items-start w-full px-1">
      <div className="flex gap-1 items-center">
        <div className="h-1.5 bg-cv-muted rounded-sm w-1/2" />
        <div className="h-px bg-cv-faint w-1" />
        <div className="h-1 bg-cv-faint rounded-sm w-1/3" />
      </div>
      <div className="flex gap-1 mt-0.5">{bar('28%')}{bar('28%')}{bar('28%')}</div>
    </div>
  );

  if (type === 'centered') return (
    <div className="flex flex-col gap-1 items-center w-full">
      <div className="h-1.5 bg-cv-muted rounded-sm w-3/5" />
      <div className="h-1 bg-cv-faint rounded-sm w-2/5" />
      <div className="flex gap-1 mt-0.5">{bar('22%')}{bar('22%')}{bar('22%')}</div>
    </div>
  );

  return null;
}

function PresetCard({ active, onClick, label, previewType }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-stretch gap-2 p-2 rounded-cv-card border-2 transition-all ${active ? 'border-cv-brand bg-cv-brand-soft' : 'border-cv-hairline hover:border-cv-faint bg-cv-surface'}`}
    >
      <div className={`h-10 rounded-cv-control flex items-center justify-center ${active ? 'bg-cv-brand-soft' : 'bg-cv-ground'}`}>
        <LayoutPreview type={previewType} />
      </div>
      <p className={`text-[11px] font-medium text-center ${active ? 'text-cv-brand-text' : 'text-cv-muted'}`}>{label}</p>
    </button>
  );
}

/**
 * Header Bottom Border's Thickness: − and + step it, and the box between them is typed as the other
 * stepper boxes are (useTypedNumber, R2-032) — the value is written on Enter or on leaving the box,
 * clamped to 1–12 pt. The box was controlled by the stored value, so it could not be emptied: deleting
 * the 2 put it back at once, and typing 5 after it stored 25, clamped to 12 (R4-ED-05).
 */
function BorderWidthBox({ width, onChange }) {
  const clamp = (v) => Math.min(HEADER_BORDER_PT.max, Math.max(HEADER_BORDER_PT.min, v));
  const typed = useTypedNumber({
    shown: String(width),
    commit: (text) => {
      const v = parseInt(text, 10);
      if (Number.isFinite(v)) onChange(clamp(v));
    },
  });
  return (
    <>
      <button onClick={() => onChange(clamp(width - 1))} className="w-6 h-6 flex items-center justify-center border border-cv-hairline rounded text-cv-muted hover:bg-cv-sunken text-base leading-none">−</button>
      {/* 16 px on a touch screen, or iOS Safari zooms the page into the box; wider there so the digits fit (R4-DPH-29). */}
      <input type="text" inputMode="numeric" aria-label="Header border thickness (pt)" {...typed.inputProps} className="w-14 pointer-coarse:w-16 text-center text-xs pointer-coarse:text-base font-medium text-cv-ink border border-cv-field rounded focus:outline-none focus:ring-1 focus:ring-cv-brand h-6" />
      <button onClick={() => onChange(clamp(width + 1))} className="w-6 h-6 flex items-center justify-center border border-cv-hairline rounded text-cv-muted hover:bg-cv-sunken text-base leading-none">+</button>
    </>
  );
}

export function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-cv-control border transition-all ${
        active
          ? 'bg-cv-brand border-cv-brand text-white shadow-sm'
          : 'border-cv-hairline text-cv-muted hover:border-cv-brand-soft-border hover:text-cv-brand-pressed bg-cv-surface'
      }`}
    >
      {children}
    </button>
  );
}

export function HeaderCustomization({ s, set, clear, personal, template, templateLabel, open, onToggle }) {
  // The rule's state as the PDF prints it: an unset setting follows the template's design.
  const borderOn = headerBorderOn(s, template);
  // The photo as the PDF prints it: the copy fetched of one stored as a URL, or made of a WebP (R2-093,
  // R7-7), so Photo ↔ Text shows exactly when the header prints a photo beside the text.
  const photo = usePrintableImage(personal?.photo);
  const printed = photo && photo !== personal?.photo ? { ...personal, photo } : personal;
  return (
    <div className="bg-cv-ground rounded-cv-card border border-cv-hairline">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-3 text-left">
        <p className="text-[11px] font-bold text-cv-muted uppercase tracking-widest">Header Customization</p>
        {open ? <ChevronDown size={14} className="text-cv-faint" /> : <ChevronRight size={14} className="text-cv-faint" />}
      </button>

      {open && (
        <div className="space-y-4 px-3 pb-3">
          {hasHeaderControls(template, s) ? (
            <>
              <div>
                <p className="text-xs font-semibold text-cv-ink mb-2">Text Alignment</p>
                <div className="flex gap-2">
                  <PresetCard active={(s.headerAlign || 'left') === 'left'} onClick={() => set('headerAlign', 'left')} label="Left" previewType="stack" />
                  <PresetCard active={(s.headerAlign || 'left') === 'center'} onClick={() => set('headerAlign', 'center')} label="Center" previewType="centered" />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-cv-ink mb-2">Name & Title Layout</p>
                <div className="flex gap-2">
                  <PresetCard active={(s.headerLayout || 'stack') === 'stack'} onClick={() => set('headerLayout', 'stack')} label="Stack" previewType="stack" />
                  <PresetCard active={(s.headerLayout || 'stack') === 'inline'} onClick={() => set('headerLayout', 'inline')} label="Inline" previewType="inline" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-cv-ink">Header Bottom Border</p>
                  <button
                    onClick={() => set('showHeaderBorder', !borderOn)}
                    className={`p-1 rounded transition-colors ${borderOn ? 'text-cv-brand-text hover:text-cv-brand-pressed' : 'text-cv-faint hover:text-cv-faint'}`}
                    title={borderOn ? 'Hide border' : 'Show border'}
                  >
                    {borderOn ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>
                {borderOn && (
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[11px] text-cv-faint">Thickness</span>
                    <div className="flex items-center gap-1">
                      <BorderWidthBox width={s.headerBorderWidth || 2} onChange={v => set('headerBorderWidth', v)} />
                      {/* Points, as the PDF prints it — every saved value keeps its look (R3-7) */}
                      <span className="text-[11px] text-cv-faint ml-1">pt</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-cv-ink mb-2">Contact Details</p>
                <p className="text-[11px] text-cv-faint mb-1.5">Layout</p>
                <div className="flex gap-2 mb-3">
                  {[{ val: 'single', label: 'Single' }, { val: 'justify', label: 'Justify' }, { val: '2grid', label: '2 Grid' }].map(({ val, label }) => (
                    <Chip key={val} active={contactLayoutOf(s) === val} onClick={() => set('contactLayout', val)}>{label}</Chip>
                  ))}
                </div>
                <p className="text-[11px] text-cv-faint mb-1.5">Style</p>
                <div className="flex gap-2 mb-2">
                  {[{ val: 'icon', label: '⊕ Icon' }, { val: 'bullet', label: '• Bullet' }, { val: 'bar', label: '| Bar' }].map(({ val, label }) => (
                    <Chip key={val} active={contactStyleOf(s) === val} onClick={() => set('contactStyle', val)}>{label}</Chip>
                  ))}
                </div>
                {/* The header draws the pack exactly as the Style chip above reads it: a blank
                    style an imported file stored ('' or null) is Icon, so these two show (R9-10). */}
                {drawsContactIcons(template, s) && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-cv-faint mb-1">Icon set</p>
                    <div className="flex flex-wrap gap-2 mb-1">
                      {ICON_SET_OPTIONS.map(({ id, label }) => (
                        <Chip key={id} active={getIconSetId(s) === id} onClick={() => set('iconSet', id)}>{label}</Chip>
                      ))}
                    </div>
                    <p className="text-[10px] text-cv-faint leading-snug">
                      Also in <strong>Design → Contact icons</strong>. Upload custom images under <strong>Fields</strong> if needed.
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-cv-faint">Icon size</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => set('iconSize', Math.max(ICON_SIZE.min, (s.iconSize ?? 11) - 1))} className="w-6 h-6 flex items-center justify-center border border-cv-hairline rounded text-cv-muted hover:bg-cv-sunken text-base leading-none">−</button>
                        <span className="w-10 text-center text-xs font-medium text-cv-ink border border-cv-hairline rounded h-6 flex items-center justify-center">{s.iconSize ?? 11}px</span>
                        <button onClick={() => set('iconSize', Math.min(ICON_SIZE.max, (s.iconSize ?? 11) + 1))} className="w-6 h-6 flex items-center justify-center border border-cv-hairline rounded text-cv-muted hover:bg-cv-sunken text-base leading-none">+</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : template === 'sidebar' ? (
            <div className="rounded-cv-control bg-cv-ground border border-cv-hairline p-3 space-y-1.5">
              <p className="text-xs font-semibold text-cv-ink">Sidebar template layout</p>
              <p className="text-[11px] text-cv-muted leading-relaxed">The Sidebar template uses a fixed two-column layout — a dark left panel for contact/skills and the main area for experience. Header alignment and contact style don't apply here.</p>
              <p className="text-[11px] text-cv-muted leading-relaxed">To change sidebar background, name color, or text colors, open the <strong>Design</strong> tab → <strong>Colors</strong>.</p>
            </div>
          ) : (
            <div className="rounded-cv-control bg-cv-ground border border-cv-hairline p-3 space-y-1.5">
              <p className="text-xs font-semibold text-cv-ink">{templateLabel} template header</p>
              <p className="text-[11px] text-cv-muted leading-relaxed">
                The {templateLabel} template uses a fixed banner header — alignment, border, and contact layout controls apply to the {(() => {
                  const labels = headerControlTemplateLabels();
                  return labels.map((l, i) => (
                    <span key={l}>
                      {i > 0 && (i === labels.length - 1 ? ' and ' : ', ')}
                      <strong>{l}</strong>
                    </span>
                  ));
                })()} templates.
              </p>
              <p className="text-[11px] text-cv-muted leading-relaxed">To change header text color, name color, or job title color, open the <strong>Design</strong> tab → <strong>Colors</strong>.</p>
            </div>
          )}

          {/* Every template: the gaps its header prints (header_spacing_spec.md). */}
          <div className="pt-3 border-t border-cv-hairline">
            <HeaderSpacingGroup
              rows={headerGapRows(template, s, printed)}
              setKeys={headerGapKeysSet(template, s)}
              allKeys={RESUME_GAP_KEYS}
              onChange={set}
              onClear={(keys) => clear?.(keys)}
              note={personal?.title ? null : 'Add a job title to set the space between your name and title.'}
            />
          </div>
        </div>
      )}
    </div>
  );
}
