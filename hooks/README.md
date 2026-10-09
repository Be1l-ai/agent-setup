# Hooks

This directory contains hook scripts for agent harnesses. Each hook is a small, readable Node.js script (~60 lines) that performs one specific safety or quality function.

## Hooks

| Hook | Event | Description |
|------|-------|-------------|
| `guard.js` | pre-tool-use | Blocks reading secrets, rm -rf outside repo, git push --force, deploy commands without approval |
| `format-on-edit.js` | post-tool-use (write/edit) | Runs repo's formatter on edited file only, timeout 10s, never fails edit |
| `done-gate.js` | pre-completion | Runs repo's test+lint, blocks "done" on failure, max 2 retries then reports |
| `session-start.js` | session-start | Prints git status, branch, recent commits, repo summary (off by default) |

## Harness Support

| Harness | pre-tool-use | post-tool-use | pre-completion | session-start |
|---------|--------------|---------------|----------------|---------------|
| Codex | ✅ | ✅ | ❌ | ❌ |
| OpenCode | ✅ | ✅ | ✅ | ✅ |
| kilo | ✅ | ✅ | ✅ | ✅ |
| cline | ❌ | ❌ | ❌ | ❌ |
| Cursor | ❌ | ❌ | ❌ | ❌ |
| Gemini CLI | ❌ | ❌ | ❌ | ❌ |
| Generic (git/CI) | via pre-commit | via pre-commit | via CI | N/A |

**Legend**: ✅ = Native hook support, ❌ = Not supported, use fallback

## Fallbacks (Portable)

### Git Pre-Commit Hook
Install in `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Runs guard checks + format-on-edit + done-gate verify
# This is a simplified version - the full hooks run in the agent context

# Guard: check for blocked files in staging
if git diff --cached --name-only | grep -E '\.env|\.pem|\.key|id_rsa|secret|credential|token'; then
  echo "ERROR: Blocked file type in commit"
  exit 1
fi

# Format: run repo formatter on staged files
if [ -f package.json ] && grep -q '"format"' package.json; then
  npx prettier --write $(git diff --cached --name-only) 2>/dev/null || true
  git add $(git diff --cached --name-only) 2>/dev/null || true
fi

# Verify: run repo checks (optional, can be slow)
# Uncomment to enable:
# npm run check 2>/dev/null || make check 2>/dev/null || exit 1
```

### CI Job (GitHub Actions)
```yaml
# .github/workflows/agent-kit-verify.yml
name: Agent Kit Verify
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run check  # or make check, pytest, cargo test, etc.
```

## Configuration

Hooks read configuration from `.agent-kit/` at apply time:

- `format-config.json` - formatter commands per extension (from recon)
- `verify-config.json` - verify command (from recon)
- `approvals.json` - approved deploy/publish commands (user-managed)
- `config.json` - merged kit.config.yaml + detected settings

## Installation

Hooks are installed by the apply script based on `kit.config.yaml` and detected harness. They are placed in the harness's hook directory:

- **Codex**: `.codex/hooks/`
- **OpenCode**: `.opencode/hooks/`
- **kilo**: `.kilocode/hooks/`
- **Claude Code**: `.claude/hooks/`

## Writing Custom Hooks

Hooks receive arguments via command line:
```
hook-name <tool-name> <json-args>
```

Exit codes:
- `0` = allow/continue
- `1` = block/reject

Environment variables:
- `GIT_ROOT` - repository root
- `AGENT_KIT_ROOT` - kit installation root