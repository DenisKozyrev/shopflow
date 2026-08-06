---
name: commit-push-pr
description: Commit staged changes, push branch, and open a GitHub Pull Request following ShopFlow conventions. Use when the user asks to commit, push, create a PR, or ship changes. Follows Conventional Commits format and ShopFlow branch/PR naming rules.
---

# Commit → Push → PR

## Default execution (recommended)

Prefer running this workflow via Claude Code's **Agent tool** (a general-purpose subagent) to keep verbose git/gh output out of the main conversation thread. Git safety (blocking force-push to main, `reset --hard`, staging `.env`/secrets) is enforced by this repo's hooks (`.claude/settings.json` → `.claude/hooks/`) regardless of whether these commands run in the main thread or a subagent — delegating here is about context hygiene, not safety.

Exception: if the user explicitly says "do it here" / "без subagent" — run inline via Bash.

## Conventions (ShopFlow)

- **Branch:** `feature/SF-{N}-short-description`
- **Commit:** `feat(SF-N): description` — Conventional Commits
- **PR title:** same as commit message
- **Merge:** squash merge into `main`

## Workflow

### 1. Check current state
```bash
git status
git diff
git log --oneline -5
```

### 2. Branch (if on main)
```bash
git checkout -b feature/SF-N-short-description
```

### 3. Stage and commit
```bash
git add .
git commit -m "feat(SF-N): description"
```

Use correct prefix: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`.

### 4. Push
```bash
git push -u origin HEAD
```

### 5. Create PR
```bash
gh pr create \
  --title "feat(SF-N): description" \
  --body "$(cat <<'EOF'
## What
- Brief description of changes

## Acceptance Criteria
- [ ] criterion 1
- [ ] criterion 2

## SF task
Closes SF-N
EOF
)"
```

## Notes
- Never push to `main` directly
- Never skip hooks (`--no-verify`)
- If `gh` auth fails: tell user to run `gh auth login`
- Squash merge only — keep `main` history clean
- Return PR URL when done
