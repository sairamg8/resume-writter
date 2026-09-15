// The owner's own résumé for the dev server only: useDemoSeed imports `virtual:owner-resume` and,
// on the owner's sign-in, makes it the account's original when the account has none yet
// (demoSeed.privateOriginal) — it then syncs to their Firestore account, private to their uid.
// The file is git-ignored personal data (private/sairam-resume.json). The dev server serves it
// when it exists; every build — production, e2e — gets `export default null` without reading it,
// so it can never reach a bundle, whatever imports it. tests/pdf/24-private-data.test.mjs builds
// production and looks for every string of the file in the bundle.
import fs from 'node:fs';
import path from 'node:path';

export const OWNER_RESUME_MODULE = 'virtual:owner-resume';
const RESOLVED = `\0${OWNER_RESUME_MODULE}`;
const NOTHING = 'export default null;';

/** `file`: the résumé JSON, relative to the project root. */
export function ownerResume({ file = 'private/sairam-resume.json' } = {}) {
  let serve = false;
  let source = file;
  return {
    name: 'owner-resume',
    configResolved(config) {
      serve = config.command === 'serve';
      source = path.resolve(config.root, file);
    },
    resolveId(id) {
      return id === OWNER_RESUME_MODULE ? RESOLVED : null;
    },
    load(id) {
      if (id !== RESOLVED) return null;
      if (!serve || !fs.existsSync(source)) return NOTHING;
      this.addWatchFile(source);
      try {
        return `export default ${JSON.stringify(JSON.parse(fs.readFileSync(source, 'utf8')))};`;
      } catch (e) {
        this.warn(`${file} could not be read as JSON (${e.message}): nothing is imported from it.`);
        return NOTHING;
      }
    },
  };
}
