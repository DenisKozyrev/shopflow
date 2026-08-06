#!/usr/bin/env bash
# Block staging/committing secret files (.env, keys, credentials).
set -euo pipefail

input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // empty')
normalized=$(echo "$command" | tr '\n' ' ' | sed 's/[[:space:]]\+/ /g')
stripped=$(echo "$normalized" | sed -E "s/'[^']*'//g; s/\"[^\"]*\"//g")

deny() {
  jq -n --arg reason "$1" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse", permissionDecision:"deny", permissionDecisionReason:$reason}}'
  exit 0
}

allow() {
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
  exit 0
}

if ! echo "$stripped" | grep -Eq '(^|[[:space:];|&])git([[:space:]]|$)'; then
  allow
fi

# Explicit paths on the command line (outside quotes already stripped — check normalized for path args)
if echo "$normalized" | grep -Eq '(^|[[:space:]])(\.\/)?\.env([.][a-zA-Z0-9_-]+)?([[:space:]]|$)'; then
  if ! echo "$normalized" | grep -Eq '(^|[[:space:]])(\.\/)?\.env\.example([[:space:]]|$)'; then
    deny "Blocked: do not git add/commit .env files. Secrets must stay out of git."
  fi
fi

if echo "$stripped" | grep -Eq '\.(pem|p12)([[:space:]]|$)'; then
  deny "Blocked: do not commit key/cert files (*.pem / *.p12)."
fi

# Inspect index on commit
if echo "$stripped" | grep -Eq 'git[[:space:]]+commit'; then
  if git rev-parse --git-dir >/dev/null 2>&1; then
    while IFS= read -r file; do
      [ -z "$file" ] && continue
      base=$(basename "$file")
      if [[ "$base" == .env ]] || [[ "$base" == .env.* && "$base" != .env.example ]]; then
        deny "Blocked: staged secret file '$file'. Unstage it before committing."
      fi
      if [[ "$file" == *.pem || "$file" == *.p12 || "$file" == *credentials*.json ]]; then
        deny "Blocked: staged secret file '$file'. Unstage it before committing."
      fi
    done < <(git diff --cached --name-only 2>/dev/null || true)
  fi
fi

# Broad add: warn if an untracked non-ignored .env exists (rare if gitignore is correct)
if echo "$stripped" | grep -Eq 'git[[:space:]]+add[[:space:]]+(-A|--all|\.|-u)([[:space:]]|$)'; then
  if git rev-parse --git-dir >/dev/null 2>&1; then
    while IFS= read -r file; do
      [ -z "$file" ] && continue
      base=$(basename "$file")
      if [[ "$base" == .env ]] || [[ "$base" == .env.* && "$base" != .env.example ]]; then
        if ! git check-ignore -q "$file" 2>/dev/null; then
          deny "Blocked: '$file' would be staged. Keep secrets out of git."
        fi
      fi
    done < <(git ls-files --others --exclude-standard 2>/dev/null || true)
  fi
fi

allow
