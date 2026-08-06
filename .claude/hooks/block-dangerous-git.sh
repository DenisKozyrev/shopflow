#!/usr/bin/env bash
# Block destructive git commands; ask on force-push.
# Ignores text inside quotes so echo/tests don't false-positive.
set -euo pipefail

input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // empty')
normalized=$(echo "$command" | tr '\n' ' ' | sed 's/[[:space:]]\+/ /g')
# Drop single- and double-quoted regions before policy checks
stripped=$(echo "$normalized" | sed -E "s/'[^']*'//g; s/\"[^\"]*\"//g")

deny() {
  jq -n --arg reason "$1" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse", permissionDecision:"deny", permissionDecisionReason:$reason}}'
  exit 0
}

ask() {
  jq -n --arg reason "$1" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse", permissionDecision:"ask", permissionDecisionReason:$reason}}'
  exit 0
}

allow() {
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
  exit 0
}

# Only care when git appears as a command token (not leftover noise)
if ! echo "$stripped" | grep -Eq '(^|[[:space:];|&])git([[:space:]]|$)'; then
  allow
fi

if echo "$stripped" | grep -Eq 'git[[:space:]]+push[[:space:]].*(--force|--force-with-lease|[[:space:]]-f([[:space:]]|$)).*(main|master)' \
  || echo "$stripped" | grep -Eq 'git[[:space:]]+push[[:space:]].*(main|master).*(--force|--force-with-lease|[[:space:]]-f([[:space:]]|$))'; then
  deny "Blocked: force-push to main/master is not allowed in ShopFlow."
fi

if echo "$stripped" | grep -Eq 'git[[:space:]]+reset[[:space:]].*--hard'; then
  deny "Blocked: git reset --hard. Use safer recovery (stash / revert) unless Denis explicitly asked."
fi

if echo "$stripped" | grep -Eq 'git[[:space:]]+clean[[:space:]].*-[a-zA-Z]*f'; then
  deny "Blocked: git clean -f*. Refusing destructive cleanup of untracked files."
fi

if echo "$stripped" | grep -Eq '(^|[[:space:];|&])rm[[:space:]]+(-[a-zA-Z]*f[a-zA-Z]*r|[a-zA-Z]*rf|-[a-zA-Z]*r[a-zA-Z]*f)'; then
  deny "Blocked: dangerous rm -rf style command."
fi

if echo "$stripped" | grep -Eq 'git[[:space:]]+push[[:space:]].*(--force|--force-with-lease|[[:space:]]-f([[:space:]]|$))'; then
  ask "Force-push detected. Confirm only if this is intentional on a feature branch."
fi

allow
