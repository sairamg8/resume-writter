# job-map

Open roles across companies and countries. Private: the crawl data stays out of the app bundle; the owner loads the result into their own account (Job Map page, owner only).

```bash
cd tools/job-map && npm i      # playwright (set CHROME=<chromium path> if it cannot find one)
node find-companies.mjs        # discover companies + job-API roles -> discovered.json, unresolved.json, jobs-agg.json (about 1 h)
node crawl-careers.mjs --limit 700   # careers sites with no readable board -> careers-results.json (resumable)
node build-db.mjs              # read every board, classify -> db.json (about 15 min)
node build-data.mjs            # -> jobmap-data.json; open Job Map in the app and choose that file
```

`jobs.mjs "Razorpay" --region india --track java` looks one company up. `lib.mjs` holds the function / position / stack / level / country rules, `ats.mjs` the readers (Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Workday, Atlassian). Boards that block bots, and logged-in ATSs (Taleo, SuccessFactors, Oracle), are linked, not read. Moved from sairamg8/devbible (docs/_project/job-map); its Express login app was left behind, Firebase sign-in replaces it.

## Keeping it current

`node refresh.mjs` re-reads every known board, rebuilds the data and uploads it to the `jobmap/*` documents (`FIREBASE_SERVICE_ACCOUNT` = the service-account JSON). `--discover` looks for new companies first, `--dry` uploads nothing (the guards below still run), `--force` skips the shrink guards (never the document size check).

### What discovery does to the committed files

`find-companies.mjs` (the `--discover` step) only ever **adds to and updates** `discovered.json`, `unresolved.json` and `jobs-agg.json` (the rules are in `discovery.mjs`, tested in `tests/unit/job-map-discovery.unit.mjs`):
- every committed board company stays, including those discovery cannot reproduce (Workday, careers-crawl, careers-link-only entries); a company found again is updated field by field (an empty, null or NaN value never erases a stored one), matched by name or by its board (`ats` + `slug`), so a rename updates the entry instead of adding a second one;
- aggregator companies and roles are rebuilt from the run, except for a feed that returned under half of what it returned before (and had at least 50 rows): that feed keeps its previous roles and companies, with a `::warning::`; a feed under 90% of its previous size is only warned about;
- a company with a board read by the tool does not also keep aggregator roles; one kept with only a careers link does;
- `unresolved.json` is the union of the old and new lists, minus any company that now has a board;
- before any request the previous files are read: a missing file is a first run, a file that cannot be read stops the run (`::error::`) so the merge never turns into an overwrite;
- before anything is written the five source numbers are checked (YC hiring at least 700, Wikipedia rows 200, Wikidata companies 2000 and countries answering 20, aggregator rows 1200): three of the four sources (YC, Wikipedia, Wikidata, aggregators) below their floor means most sources are dead, the run exits 1 and writes nothing; one or two low sources are only warned about. A company that disappears from every source stays in the file (nothing prunes it).

### Retries and guards

- Board requests that answer 429/502/503/504 are asked again (up to 2 retries, waiting the host's `Retry-After` up to 30 s; a longer `Retry-After` is not waited for). A host that is down or times out is not retried. Discovery probes (thousands of guesses) do not retry at all. Wikidata tries each country 4 times with longer pauses and stops asking after 3 countries in a row never answered.
- `build-db.mjs` stops with exit 1, without writing `db.json`, when more boards failed than the larger of 10 and 2% of the boards tried (a healthy run loses about 6 of 1000, rate-limited Workday boards).
- `upload.mjs` refuses (exit 1, nothing written) when, against what is stored, the roles fell more than 40%, any country with at least 500 roles lost more than 50% (`OTHER` and `REMOTE` are not judged alone), any job platform with at least 500 open roles lost more than 30%, or the companies fell more than 15%. `--force` skips this. A document over 900,000 bytes (Firestore's limit is about 1 MiB) is always refused, `--dry` and `--force` included. Each write is tried 3 times, the `meta` document is written last, stale documents are removed after it.
- In the workflow the commit of the three files runs even when a guard refuses the build or the upload (the run is red, what discovery found is kept).

`.github/workflows/job-map-refresh.yml` does it for you: Mondays the roles, the 1st of the month new companies too (committed with `[skip ci]` onto the branch's current tip, pushed again if the branch moved during the hour; the same three files are kept 30 days as the run's `job-map-found` artifact; master then holds a commit CI never ran on, so merge master into a branch before fast-forwarding it after the 1st). GitHub starts a scheduled run when it can, often hours after the time written, and `Run workflow` is the catch-up for a missed one. It needs the repository secret `FIREBASE_SERVICE_ACCOUNT` (Firebase console, Project settings, Service accounts, Generate new private key); only the owner can add it.
