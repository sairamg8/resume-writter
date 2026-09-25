// Selectors shared by specs. Tailwind class hooks are all the app offers today; each one is
// named here once so a future data-testid migration touches a single file.

/** A resume card on the dashboard grid. */
export const CARD = '.group.bg-white.rounded-2xl';

/** The pencil button that appears on hover next to a card's resume name. */
export const CARD_RENAME = '.group\\/name button';

/** The hidden import input of the dashboard and the editor: .json first, then the documents (R2-148). */
export const IMPORT_INPUT = 'input[type="file"][accept^=".json"]';

/** The header's cloud-sync icon; hovering it shows what the sync is doing (AuthBar's SyncDot). */
export const SYNC_STATUS = '[data-testid="sync-status"]';

/** An entry's clickable header row in a section editor (it opens and closes the entry). */
export const ENTRY_HEADER = 'div.cursor-pointer.select-none';
