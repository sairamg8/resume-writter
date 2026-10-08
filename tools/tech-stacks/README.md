# Tech-stack collector

Pulls public job postings from Greenhouse and Lever and counts which technologies the
engineering postings mention, per company. Zero dependencies (Node 18+).

    node tools/tech-stacks/collect.mjs                    # all companies in companies.json
    node tools/tech-stacks/collect.mjs --only Stripe,Airbnb
    node tools/tech-stacks/collect.mjs --all-roles        # not just engineering titles

Output goes to `tools/tech-stacks/out/` (git-ignored): `tech-stacks.json`, `tech-stacks.csv`
(long format) and `tech-stacks-wide.csv` (one row per company, top tech per category).

- `share` = postings mentioning the tech / engineering postings analysed. It measures what a
  company is hiring for right now, not a full inventory of what it runs.
- Small boards (a handful of postings) give noisy percentages; check `analysed_postings`.
- Add a company: find its board at `boards.greenhouse.io/<slug>` or `jobs.lever.co/<slug>` and
  add `{ name, ats, slug, sector }` to `companies.json`. A wrong slug is reported as skipped.
- Companies on Workday, iCIMS or custom sites (most banks, Amazon, Google, Microsoft,
  Walmart) have no public API and are not covered.
- Tune keywords in `taxonomy.mjs`; ambiguous words (Go, Rust, Spring) carry context rules.
