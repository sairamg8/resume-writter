// Selectors shared by specs. Each is a data-testid (the hooks the UI keeps while it is restyled), named
// here once so a markup change touches a single file.

/** A resume card on the dashboard grid. */
export const CARD = '[data-testid="resume-card"]';

/** The pencil button next to a card's resume name (it shows on hover, always on touch). */
export const CARD_RENAME = '[data-testid="resume-card-rename"]';

/** The hidden import input of the dashboard and the editor: .json first, then the documents (R2-148). */
export const IMPORT_INPUT = 'input[type="file"][accept^=".json"]';

/** The header's cloud-sync icon; hovering it shows what the sync is doing (AuthBar's SyncDot). */
export const SYNC_STATUS = '[data-testid="sync-status"]';

/** An entry's clickable header row in a section editor (it opens and closes the entry). */
export const ENTRY_HEADER = '[data-testid="entry-header"]';

/** The editor's document and tool controls, by testid: what `reach` in commands.js clicks. */
export const REACH = {
  design: '[data-testid="design-open"]',
  ats: '[data-testid="ats-open"]',
  resume: '[data-testid="doc-switch-resume"]',
  letter: '[data-testid="doc-switch-letter"]',
};
