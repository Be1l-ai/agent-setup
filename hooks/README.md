# Hooks

The guard is **not** a standalone script. It ships as an OpenCode plugin under
`plugins/opencode/`; see `harnesses/opencode.md`. The scripts here are standalone
and are not auto-registered with any harness.

## Scripts

| Script | Purpose |
|--------|---------|
| `done-gate.js` | Runs the repo's verify command. Exit 1 on failure, and exit 1 if no command is set. Wire to CI or pre-commit |
| `format-on-edit.js` | Runs the repo's formatter on one file (10s timeout, never fails the edit) |
| `session-start.js` | Prints git status, branch, recent commits, and kit config |

All three read a JSON event on stdin (`{"tool": ..., "input": {...}}`) and exit 0,
except `done-gate`, which exits 1 to block.

Guard logic lives in `plugins/opencode/agent-kit-guard-core.mjs` and is reachable
from Node for testing:

```js
import { checkToolCall } from "./.opencode/plugins/agent-kit-guard-core.mjs";
checkToolCall(root, "bash", { command: "rm -rf /" });  // -> reason string, or null
```

## Harness Support

Only OpenCode is verified and installed. Codex can block `PreToolUse` but cannot
block the end of a turn, so done-gate is CI there too.

| Harness | tool-call blocking | end-of-turn blocking | Installed by kit |
|---------|--------------------|----------------------|------------------|
| OpenCode | ✅ plugin + permission | ❌ (use CI) | ✅ verified 1.18.35 |
| Codex | ✅ `PreToolUse` exit 2 | ❌ (`Stop` continues) | no — adapter only |
| kilo | UNVERIFIED | UNVERIFIED | no |
| cline | UNVERIFIED | UNVERIFIED | no |
| Cursor / Gemini | ❌ | ❌ | no |
| Generic | via pre-commit | via CI | no |

**Legend**: ✅ verified, ❌ not supported, UNVERIFIED = not confirmed against the harness

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

- `format-config.json` - formatter commands per extension
- `verify-config.json` - verify command (done-gate)
- `config.json` - enabled harness, skills, hooks, MCP servers
- `manifest.json` - apply record used by remove.js (do not edit)
- `backup/` - original contents of every file apply changed

## Installation

The guard is installed by apply into `.opencode/plugins/` and registered in the
`plugin` array of `opencode.json`. See `harnesses/opencode.md`.

## Writing custom scripts

Standalone scripts read a JSON event on stdin: `{"tool": "bash"|"read"|"write"|"edit", "input": {...}}`.

Exit codes: `0` allow/continue, `1` block/reject.

Environment: `GIT_ROOT` - repository root (defaults to the git top level, or cwd).

## Guard configuration

Rules live in `plugins/opencode/agent-kit-guard-core.mjs`: `SECRET_BASENAME`,
`SECRET_PATH_FRAGMENTS`, `PROTECTED_REL`, and the `DEPLOY` table. Edit those lists to
match your repo. Rules you cannot afford to lose belong in the `permission` block of
`opencode.json`, which the harness enforces before any tool runs.