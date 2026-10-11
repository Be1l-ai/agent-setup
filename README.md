# Agent Kit

A reusable, harness-agnostic toolkit for adding agent assistance to any codebase.

## What This Is

This kit provides:
- **AGENTS.md template** — a canonical prompt format that works across harnesses
- **Vendored skills** — reviewed, pinned skill folders you can enable per task
- **Guard** — an OpenCode plugin (`tool.execute.before`) plus a `permission` block in `opencode.json`
- **Standalone scripts** — `done-gate.js`, `format-on-edit.js`, `session-start.js` that you run from CI or by hand
- **MCP server definitions** — pinned, neutral configurations for Context7, Playwright, GitHub
- **Plugin recipes** — opt-in, documented recipes for claude-mem, Caveman, Ponytail
- **Apply/Remove procedures** — idempotent scripts that merge additively and can be fully reverted

## Requirements

- **Node.js 18+** (zero npm dependencies)
- **Git** (for version control and hooks)
- A target repository that is a git repo with a clean working tree

## Trust Model

- **No network calls** in any kit-provided script or hook
- **No secrets** read, written, or printed
- **Pinned versions only** — no `@latest`, no `curl | bash`
- **Additive only** — the kit merges between marker comments; existing files are backed up before any change and refused unless `--overwrite`
- **Reversible** — every write is recorded in `.agent-kit/manifest.json` with a backup, so `remove.js` restores the exact prior state
- **Harness-neutral** — AGENTS.md is the canonical format; harness-specific adapters are documented in `harnesses/`
- **Explicit opt-in** — skills, hooks, MCPs, and plugins are enabled only when set in `kit.config.json`; a missing key means off

## How to Apply

```bash
# 1. Clone this kit OUTSIDE your target repo
git clone <this-kit-repo> ~/agent-kit
cd ~/agent-kit

# 2. Review and adjust kit.config.json for your harness/OS
# 3. Run the apply procedure (see APPLY.md)
node scripts/recon.js --target /path/to/your/repo --output /tmp/recon.json
node scripts/propose.js --recon /tmp/recon.json --output /tmp/proposal.json
node scripts/apply.js --target /path/to/your/repo --proposal /tmp/proposal.json --dry-run
# Review the output, then:
node scripts/apply.js --target /path/to/your/repo --proposal /tmp/proposal.json
```

See [APPLY.md](APPLY.md) for the full procedure.

## How to Remove

```bash
node scripts/remove.js --target /path/to/your/repo
```

See [REMOVE.md](REMOVE.md) for details.

## Directory Structure

```
agent-kit/
├── README.md              # This file
├── APPLY.md               # Step-by-step apply procedure
├── REMOVE.md              # Uninstall via manifest
├── kit.config.json        # Harness, OS, profiles, toggles (missing key = off)
├── AGENTS.template.md     # Canonical prompt template with marker blocks
├── skills/                # Vendored, reviewed skill folders
├── SKILLS.lock            # Source, owner, commit hash, license, copy date per skill
├── mcp/servers.json       # Neutral MCP definitions with pinned versions
├── hooks/                 # Hook scripts + README.md
├── plugins/               # Opt-in plugin recipes (not installed)
├── harnesses/             # Verified harness file locations/formats
├── scripts/               # recon, propose, apply, remove, lib (Node.js 18+, zero deps)
└── REVIEW/                # One report per third-party source reviewed
```

## Configuration

Edit `kit.config.json`. A missing key means off.

```json
{
  "harness": "opencode",
  "os": "linux",
  "profiles": ["debugging", "code-review", "branch", "security-review"],
  "mcp": { "context7": false, "playwright": false, "github": false },
  "plugins": { "claude_mem": false, "caveman": false, "ponytail": false },
  "hooks": { "guard": true, "format-on-edit": true, "done-gate": true, "session-start": false }
}
```

Profiles: `debugging`, `code-review`, `branch`, `security-review`, `frontend` (UI repos only).

## How the guard works

For OpenCode, two layers:

- `permission` in `opencode.json` — hard denies (`rm -rf *`, `git push * --force*`, `read .env`) enforced by the harness before a tool runs.
- `.opencode/plugins/agent-kit-guard.mjs` — checks the harness cannot express (flag parsing, `sh -c`, `sudo`, `$(...)`, `+refspec`, kit-protected paths). Throwing in `tool.execute.before` blocks the call.

Both were verified against `opencode` 1.18.35. The plugin **must stay registered** in the `plugin` array of `opencode.json`; directory auto-discovery did not load it in testing. See `harnesses/opencode.md`.

The guard is a guardrail against accidents, not a sandbox. It parses shell text heuristically and cannot see everything a shell can do.

## Skills Included

See [skills/INDEX.md](skills/INDEX.md) for the full list and when to use each.

## License

This kit is MIT licensed. Vendored skills retain their original licenses (see SKILLS.lock).