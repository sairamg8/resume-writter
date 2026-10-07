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
