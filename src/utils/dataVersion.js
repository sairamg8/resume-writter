// The data version this build writes (normalizeResume.js says what it records). Its own module, with
// no imports, so plain-data modules — the role starters, the JSON Resume import — stamp it on the
// résumés they build, and Node's test runner loads them without the app's @/ aliases.

/**
 * The data version this build writes: the store's `dataVersion`, and each résumé's own once it
 * has been through normalizeResume(). A résumé's own version records which one-time migrations
 * it has had, so none runs twice on the same data — not after a sync, an import of an exported
 * file, or a stale tab of an older build writing the store back with its older store version.
 */
export const DATA_VERSION = 11;
