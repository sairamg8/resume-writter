import { memo } from 'react';
import DesignPanel from '@/components/DesignPanel';

/**
 * The Design dock's body: DesignPanel whole, every group, ONE instance for as long as the dock is open (the
 * Undo notices of a section reset, and a 1-Page Fit still measuring, go when it unmounts as the dock closes).
 * `design`: what the Editor holds for it, one object that keeps its identity while its values do — the
 * store's look actions as stable functions, the saved `designs`, `templateOpen` / `onTemplateOpenChange`
 * (whether Template is open, kept by the Editor across the dock's closing) and `onBrowseTemplates` — spread
 * over the panel, so it asks for no more than it did as a tab. Memoised: `resume` is the dock's deferred
 * one, so a keystroke in a section renders the panel 0 times in its own commit.
 */
export const DesignDock = memo(function DesignDock({ resume, design }) {
  return <DesignPanel resume={resume} {...design} />;
});
