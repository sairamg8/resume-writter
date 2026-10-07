import { memo, useMemo } from 'react';
import DesignPanel from '@/components/DesignPanel';

const Panel = memo(DesignPanel);

/**
 * The Design dock's body: DesignPanel whole, every group, ONE instance for as long as the dock is open (the
 * Undo notices of a section reset, and a 1-Page Fit still measuring, go when it unmounts as the dock closes).
 * `design`: what the Editor holds for it, one object that keeps its identity while its values do — the
 * store's look actions as stable functions, the saved `designs`, `templateOpen` / `onTemplateOpenChange`
 * (whether Template is open, kept by the Editor across the dock's closing) and `onBrowseTemplates` — spread
 * over the panel, so it asks for no more than it did as a tab. The panel draws from the résumé's id, template,
 * settings and cover letter only, so it is given those (one object that keeps its identity until one of them
 * changes) and renders 0 times for a keystroke in a section. Its buttons read the whole résumé at the click
 * through `getLatest` (a stable function over the editor's latest résumé), so a second click before a render
 * takes its Undo and its checks from the look the first one left.
 */
export const DesignDock = memo(function DesignDock({ resume, design, getLatest }) {
  const { id, template, settings, coverLetter } = resume;
  const drawn = useMemo(() => ({ id, template, settings, coverLetter }), [id, template, settings, coverLetter]);
  return <Panel resume={drawn} getLatest={getLatest} {...design} />;
});
