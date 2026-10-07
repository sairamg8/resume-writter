// One command to bring the Job Map up to date: node refresh.mjs [--discover] [--dry] [--force]
//   (default)    re-read every known company's board           -> db.json -> jobmap-data.json -> Firestore (about 20 min)
//   --discover   first look for new companies and boards        (find-companies.mjs, about 1 h; rewrites discovered.json,
//                unresolved.json, jobs-agg.json, which stay in git so the next refresh keeps what it found)
//   --dry        build everything, upload nothing (the shrink guard still runs when a service account is set)
// The careers-site crawl (crawl-careers.mjs, needs a browser) is not part of this; run it by hand when wanted.
import { spawnSync } from 'node:child_process';

const flags = process.argv.slice(2);
const run = (script, extra = []) => {
  console.log(`\n== ${script}`);
  const r = spawnSync(process.execPath, [new URL(`./${script}`, import.meta.url).pathname, ...extra], { stdio: 'inherit' });
  if (r.status !== 0) { console.error(`${script} failed (${r.status})`); process.exit(r.status || 1); }
};
if (flags.includes('--discover')) run('find-companies.mjs');
run('build-db.mjs');
run('build-data.mjs');
run('upload.mjs', flags.filter((f) => f === '--dry' || f === '--force'));
