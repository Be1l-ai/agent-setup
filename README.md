# Agent Kit

A reusable, harness-agnostic toolkit for adding agent assistance to any codebase.

> **Status:** OpenCode integration supports **OpenCode 2.x** (natively) and
> **OpenCode 1.18.29+** (backward-compatible). To tell which version you have,
> run `opencode --version`. Other harnesses are documented in `harnesses/` but
> not installed by the kit. See [Status and limits](#status-and-limits).

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
git clone https://github.com/Be1l-ai/agent-setup.git ~/agent-kit
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
.
├── README.md              # This file
├── CONTRIBUTING.md        # How to propose changes
├── LICENSE                # MIT
├── APPLY.md               # Step-by-step apply procedure
├── REMOVE.md              # Uninstall via manifest
├── BUILD_REPORT.md        # Build history and current status
├── kit.config.json        # Harness, OS, profiles, toggles (missing key = off)
├── AGENTS.template.md     # Canonical prompt template with marker blocks
├── skills/                # Vendored, reviewed skill folders
├── SKILLS.lock            # Source, owner, commit hash, license, copy date per skill
├── mcp/servers.json       # Neutral MCP definitions with pinned versions
├── hooks/                 # Standalone scripts (done-gate, format, session-start) + README
├── plugins/opencode/      # OpenCode guard plugin + shared rule core
├── plugins/               # Opt-in third-party plugin recipes (not installed)
├── harnesses/             # Per-harness integration notes (OpenCode verified)
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

- **V2 (preferred):** ordered `permissions` array in `opencode.json` — hard denies (`rm -rf *`, `git push * --force*`, `*.env` reads) enforced by the harness before a tool runs. Action names use `shell` (not `bash`) and rules follow "last match wins".
- **V1 (compatibility):** `permission` nested object in `opencode.json` (emitted alongside `permissions` so V1 continues to work).
- `.opencode/plugins/agent-kit-guard.mjs` (plugin) — checks what the rule layer cannot express (flag parsing, `sh -c`, `sudo`, `$(...)`, `+refspec`, kit-protected paths). Throwing in `tool.execute.before` blocks the call. On V2, the kit also writes a `plugins` entry pointing at the plugin directory.

The guard works with OpenCode 2.x (primary) and 1.18.29+ (backward compatible). See `harnesses/opencode.md` for details, including the V2 plugin packaging caveat.

The guard is a guardrail against accidents, not a sandbox. It parses shell text heuristically and cannot see everything a shell can do.

## Status and limits

- **Verified:** the OpenCode guard blocks `rm -rf .` in a live `opencode run` while a
  safe `rm file` still runs. Apply → remove round-trips a repo byte for byte.
- **Not installed:** Codex, kilo, Cline, Cursor, Gemini. See `harnesses/`.
- **No harness can block an agent from finishing a turn.** Codex's `Stop` continues the
  loop; OpenCode's `session.idle` fires after the turn. `done-gate` is therefore a
  standalone CI script, not a lifecycle hook.
- **The guard is not a sandbox.** It parses shell text heuristically and cannot see
  everything a shell can do. Rules you cannot afford to lose belong in the `permission`
  block of `opencode.json`, which the harness enforces.

## Skills Included

See [skills/INDEX.md](skills/INDEX.md) for the full list and when to use each.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

This kit is MIT licensed (see [LICENSE](LICENSE)). Vendored skills retain their original licenses (see [SKILLS.lock](SKILLS.lock)).