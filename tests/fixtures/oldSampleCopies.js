// The copies a build could store in the cloud for a sample résumé nobody edited (demo_classic …,
// the owner's login until 2026-09-15): frozen data that those builds' own code produced — see the
// "about" of oldSampleCopies.json. src/utils/oldSamples.js fingerprints exactly these
// (tests/unit/old-samples.unit.mjs); the sync tests put them in a fake cloud, flagged as the old
// builds left them (tests/pdf/18-cloud-sync-old-samples.test.mjs). Plain Node, no `@/` imports.
import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync(new URL('./oldSampleCopies.json', import.meta.url), 'utf8'));

/**
 * Every copy as a whole résumé — { id, name, template, settings, personal, sections, coverLetter },
 * with no stamps (updatedAt, dataVersion) — a new object each call, safe to edit.
 */
export function oldSampleCopies() {
  const { personal, sections, coverLetter } = data.content;
  return structuredClone(data.copies.map(({ id, name, template, settings, sectionItemGaps = {} }) => ({
    id, name, template, settings, personal, coverLetter,
    sections: sections.map((s, i) => (i in sectionItemGaps ? { ...s, settings: { ...s.settings, itemGap: sectionItemGaps[i] } } : s)),
  })));
}
