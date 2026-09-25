#!/bin/bash
# Stop hook: a turn may not end while docs/tracking/HANDOFF.md is behind the code. Counts the commits
# since HANDOFF.md last changed that touch code (src, tests, cypress, CI, dependencies); any such commit
# means a cold start would miss what happened, so the turn is sent back to update and push it.
# (The environment's own stop hook already refuses uncommitted or unpushed work.)
input=$(cat)
[ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false' 2>/dev/null)" = "true" ] && exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --git-dir > /dev/null 2>&1 || exit 0
# A cluster session (branch claude/wf-*) never edits docs/tracking/ (CLUSTER-PROTOCOL.md): the coordinator does.
case "$(git branch --show-current 2>/dev/null)" in claude/wf-*) exit 0 ;; esac
last=$(git log -1 --format=%H -- docs/tracking/HANDOFF.md)
[ -z "$last" ] && exit 0
behind=$(git rev-list --count "$last..HEAD" -- src tests cypress .github .yarn package.json yarn.lock vite.config.js playwright.config.js cypress.config.js)
if [ "${behind:-0}" -gt 0 ]; then
  echo "docs/tracking/HANDOFF.md is $behind code commit(s) behind. Update its live state (what is done, deployed, running, next; the rules a cold start needs), commit and push it before stopping." >&2
  exit 2
fi
exit 0
