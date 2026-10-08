import { Popover } from '@/components/ui/Popover';
import { SectionCustomizer } from '@/components/SectionEditorCustomizer';

/**
 * A section's style options (the unchanged SectionCustomizer) in the kit's Popover, anchored at the
 * section card's header. Loaded on demand by SectionEditor; if it cannot load, the card shows the
 * customizer inline instead. Done, Escape and a click outside all close it; the values are the
 * section's own settings, so closing loses nothing. On a phone the panel takes the window's width.
 */
export default function SectionStylePopover({ open, onClose, section, template, updateSectionSettings, settings }) {
  return (
    <Popover
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      placement="bottom-end"
      label="Section style"
      className="w-[min(26rem,calc(100vw-1rem))]"
      trigger={<span tabIndex={-1} aria-hidden="true" data-testid="section-style-anchor" className="block h-6 w-0 shrink-0" />}
    >
      <div className="max-h-[min(34rem,75dvh)] overflow-y-auto overscroll-contain">
        <SectionCustomizer section={section} template={template} updateSectionSettings={updateSectionSettings} settings={settings} />
      </div>
      <div className="flex justify-end border-t border-cv-hairline bg-cv-ground px-3 py-2">
        <button
          type="button"
          data-autofocus
          onClick={onClose}
          className="rounded-cv-control bg-cv-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-cv-brand-pressed"
        >
          Done
        </button>
      </div>
    </Popover>
  );
}
