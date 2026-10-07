// The ids and labels the UI tests select by, named once (tests only: a src constants module imported by
// the Dashboard would be start-up weight). The data-testid values are the stable hooks the redesign keeps
// while it restyles; a later batch that moves a control changes the markup, never an id here.
export const TID = {
  sectionCard: (id) => `section-card-${id}`,
  sectionCardPrefix: 'section-card-',
  sectionTitle: 'section-title-input',
  entryHeader: 'entry-header',
  entryTitle: 'entry-title',
  resumeCard: 'resume-card',
  resumeCardRename: 'resume-card-rename',
  // B5a: the card's ⋯ button (aria-label More); its menu holds Edit, Rename, Copy, Keep as my original / Stop keeping, Delete.
  resumeCardMore: 'resume-card-more',
  // The editor frame (B3): the tab strip's design-open and ats-open became the bar's Design button and ATS chip,
  // which toggle the one right dock; the phone's Design is the pill's. designOpen and atsOpen name them still.
  designOpen: 'design-button',
  designButton: 'design-button',
  docSwitchResume: 'doc-switch-resume',
  docSwitchLetter: 'doc-switch-letter',
  atsOpen: 'ats-chip',
  atsChip: 'ats-chip',
  editorBar: 'editor-bar',
  editorSidebar: 'editor-sidebar',
  dockDesign: 'dock-design',
  dockAts: 'dock-ats',
  dockClose: 'dock-close',
  shareButton: 'share-button',
  saveStatus: 'save-status',
  pill: 'editor-pill',
  pillEditor: 'pill-editor',
  pillPreview: 'pill-preview',
  pillDesign: 'pill-design',
};

/** The testid attribute selector, as a CSS string (Cypress, Playwright). */
export const byTid = (id) => `[data-testid="${id}"]`;

/** An element's data-testid (fake DOM or real), or ''. */
export const tidOf = (el) => el.getAttribute('data-testid') ?? '';

/** The elements under `elements` (an iterable) with this data-testid. */
export const withTid = (elements, id) => [...elements].filter((el) => tidOf(el) === id);
