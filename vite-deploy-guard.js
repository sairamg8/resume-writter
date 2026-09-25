// The live site deploys from master only, on a green gate (CLAUDE.md). Cloudflare Workers Builds also
// builds and deploys every other branch pushed to GitHub: on 2026-09-25 a cluster branch's ungated build
// served the live site within seconds of its push. A Workers Build of any branch but master now stops
// before anything is built, so nothing of it can be deployed. GitHub CI and a local build set no
// WORKERS_CI and build as before; so does Workers Builds' own master build.

/** Why a build in `env` must not run — a Workers Build of a branch other than `production` — or null. */
export function refusedBuild(env = process.env, production = 'master') {
  const branch = env.WORKERS_CI_BRANCH;
  if (!env.WORKERS_CI || !branch || branch === production) return null;
  return `Refusing a Cloudflare Workers build of branch "${branch}": the site deploys from ${production} only, on a green gate.`;
}
