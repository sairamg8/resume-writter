#!/bin/bash
# merge_cluster.sh <cluster>: fetch claude/wf-<cluster>, keep its report aside in $REPORTS (default
# ${TMPDIR:-/tmp}/wf-reports), merge the branch into the checked-out branch WITHOUT committing and without
# wf-reports/, and print its commits, any conflicts and the report's rows. Then: run its tests, resolve,
# `python3 docs/tracking/tools/update_tracker.py $REPORTS/<cluster>.json`, commit, push. See CLUSTER-PROTOCOL.md.
set -u
cd "${REPO:-$(git rev-parse --show-toplevel)}" || exit 1
N=$1; SP=${REPORTS:-${TMPDIR:-/tmp}/wf-reports}; mkdir -p "$SP"
git fetch -q origin "claude/wf-$N" || exit 1
git show "origin/claude/wf-$N:wf-reports/$N.json" > "$SP/$N.json" || exit 1
echo "== commits"; git log --format='%h %s' "HEAD..origin/claude/wf-$N" | cut -c1-160
git merge --no-ff --no-commit "origin/claude/wf-$N" 2>&1 | grep -E "CONFLICT|Automatic|Already" 
git rm -rq --cached wf-reports 2>/dev/null; git rm -rq wf-reports 2>/dev/null; rm -rf wf-reports
echo "== status"; git status --short
echo "== conflicts"; git diff --name-only --diff-filter=U
python3 - "$SP/$N.json" <<'PY'
import json,sys
r=json.load(open(sys.argv[1]))
print("== rows")
for x in r['rows']:
    print(f"{x['id']} {x['outcome']} {x.get('commits')} :: {x['summary'][:260]}" + (f" | LEFT: {x['remaining'][:200]}" if x.get('remaining') else ''))
print("== review", json.dumps(r.get('review'))[:800])
print("== baseline", r.get('baselineFailures'))
print("== notes", (r.get('notes') or '')[:1500])
PY
