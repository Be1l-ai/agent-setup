# Agent Kit

A reusable, harness-agnostic toolkit for adding agent assistance to any codebase.

## What This Is

This kit provides:
- **AGENTS.md template** — a canonical prompt format that works across harnesses
- **Vendored skills** — reviewed, pinned skill folders you can enable per task
- **Hook scripts** — small, readable safety and quality guards (with git/CI fallbacks)
- **MCP server definitions** — pinned, neutral configurations for Context7, Playwright, GitHub
- **Plugin recipes** — opt-in, documented recipes for claude-mem, Caveman, Ponytail
- **Apply/Remove procedures** — idempotent scripts that merge additively and can be fully reverted

## Requirements

- **Node.js 18+** (for the apply/verify/manifest scripts)
- **Git** (for version control and hooks)
- A target repository that is a git repo with a clean working tree

## Trust Model

- **No network calls** in any kit-provided script or hook
- **No secrets** read, written, or printed
- **Pinned versions only** — no `@latest`, no `curl | bash`
- **Additive only** — the kit never overwrites your files; it merges between marker comments
- **Harness-neutral** — AGENTS.md is the canonical format; harness-specific adapters are optional stubs
- **Off by default** — plugins, MCPs, and non-essential skills are disabled in `kit.config.yaml`

## How to Apply

```bash
# 1. Clone this kit OUTSIDE your target repo
git clone <this-kit-repo> ~/agent-kit
cd ~/agent-kit

# 2. Review and adjust kit.config.yaml for your harness/OS
# 3. Run the apply procedure (see APPLY.md)
node scripts/apply.js --target /path/to/your/repo --dry-run
# Review the proposal, then:
node scripts/apply.js --target /path/to/your/repo
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
├── kit.config.yaml        # Harness, OS, toggles (all off by default)
├── AGENTS.template.md     # Canonical prompt template with marker blocks
├── skills/                # Vendored, reviewed skill folders
├── SKILLS.lock            # Source, owner, commit hash, license, copy date per skill
├── mcp/servers.json       # Neutral MCP definitions with pinned versions
├── hooks/                 # Hook scripts + README.md
├── plugins/               # Opt-in plugin recipes (not installed)
├── harnesses/             # Verified harness file locations/formats
├── scripts/               # Recon, merge, verify, manifest tools (Node.js 18+)
└── REVIEW/                # One report per third-party source reviewed
```

## Configuration

Edit `kit.config.yaml` to enable features:

```yaml
harness: "opencode"        # codex | opencode | kilo | cline | cursor | gemini | generic
os: "linux"                # linux | macos | windows
profiles:                  # Skill profiles to enable
  - "debugging"
  - "code-review"
mcp:
  context7: false
  playwright: false
  github: false
plugins:
  claude_mem: false
  caveman: false
  ponytail: false
hooks:
  guard: true
  format_on_edit: true
  done_gate: true
  session_start: false
```

## Skills Included

See [skills/INDEX.md](skills/INDEX.md) for the full list and when to use each.

## License

This kit is MIT licensed. Vendored skills retain their original licenses (see SKILLS.lock).