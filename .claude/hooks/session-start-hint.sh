#!/usr/bin/env bash
# Lightweight session hint for ShopFlow mentor workflow.
set -euo pipefail

# Consume stdin (session payload) — ignore content for now
cat >/dev/null

branch=""
if git rev-parse --git-dir >/dev/null 2>&1; then
  branch=$(git branch --show-current 2>/dev/null || true)
fi

context=$(cat <<EOF
ShopFlow session hint:
- Mentor mode: Denis writes code; explain concepts; code review on PRs.
- Read docs/PROJECT_CONTEXT.md and docs/sprint-*-tasks.md for the active SF task.
- Prefer the mentor-session skill at chat start; commit-push-pr skill (via Agent tool) to ship.
- Current branch: ${branch:-unknown}
EOF
)

jq -n \
  --arg ctx "$context" \
  '{hookSpecificOutput:{hookEventName:"SessionStart", additionalContext:$ctx}}'

exit 0
