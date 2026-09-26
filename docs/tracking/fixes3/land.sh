#!/bin/bash
# land.sh <ID>: apply scratch/fixes/<ID>.patch on the checked-out branch and commit it with the manifest's message.
set -e
ID=$1; D=${FIXDIR:-$(git rev-parse --show-toplevel)/docs/tracking/fixes3}
cd "$(git rev-parse --show-toplevel)"
git apply --index --3way "$D/$ID.patch"
files=$(git diff --cached --name-only)
lint=$(echo "$files" | grep -E '\.(m?js|jsx)$' || true)
[ -n "$lint" ] && ./node_modules/.bin/oxlint $lint >/dev/null 2>&1 || { [ -n "$lint" ] && echo "LINT FAIL: $(./node_modules/.bin/oxlint $lint 2>&1 | tail -5)"; }
subj=$(jq -r .commit_subject "$D/$ID.done.json"); body=$(jq -r '.commit_body // ""' "$D/$ID.done.json")
git commit -q -F - <<MSG
$subj

$body

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
echo "$ID $(git rev-parse --short HEAD) :: $(jq -r '.failfirst_tests | join(",")' "$D/$ID.done.json")" | tee -a "$D/landed.txt"
