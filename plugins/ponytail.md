# Plugin Recipe: Ponytail

## Source
- **Repository**: https://github.com/DietrichGebert/ponytail
- **Owner**: DietrichGebert (Dietrich Gebert)
- **Pinned Version**: v5.1.0 (commit 9cc65d0, released 2026-10-08)
- **License**: MIT
- **Verification Date**: 2026-10-09

## What It Does
Forces the laziest solution that actually works - YAGNI ladder, standard library before custom code, native features before dependencies, one line before fifty. Intensity levels: lite, full (default), ultra. Includes review/audit commands for over-engineering detection.

## Install Commands (Per Harness)

### Codex
```bash
# Skills mode (recommended)
codex plugin marketplace add DietrichGebert/ponytail
codex plugin add ponytail@ponytail

# Or via skills registry
npx skills add DietrichGebert/ponytail -a codex
```

### OpenCode
```bash
# Native plugin (OpenCode 2+)
opencode plugin install DietrichGebert/ponytail

# Or via skills registry
npx skills add DietrichGebert/ponytail -a opencode
```

### kilo
```bash
# Skills registry
npx skills add DietrichGebert/ponytail -a kilo
```

### cline
```bash
# Instruction-only adapter (loads ruleset without commands)
npx skills add DietrichGebert/ponytail -a cline
```

### Generic
```bash
# Claude Code plugin
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail

# Generic skills
npx skills add DietrichGebert/ponytail
```

## Hooks/Commands/Services/Files Added

**Skill/Plugin Mode**:
- **Commands** (skill-capable hosts): `/ponytail [lite|full|ultra|off]`, `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`, `/ponytail-gain`, `/ponytail-help`
- **Ruleset**: Loaded as AGENTS.md/.claude/rules/ponytail.md/.cursor/rules/ponytail.mdc
- **Hooks** (Claude Code): Auto-active sessions, `[PONYTAIL]` statusline badge
- **Hooks** (Cursor): `scripts/cursor-hooks.js install` merges into existing `hooks.json`
- **Shortcut markers**: Adds `shortcut:` comments to code (neutral, not branded)

**MCP** (optional, separate):
- `ponytail-mcp` package for audit/review via MCP

## Data Recorded & Storage

- **Per-project mode state**: Stored in project config (survives restarts)
- **Debt ledger**: `ponytail:` / `shortcut:` comments in code (harvested by `/ponytail-debt`)
- **Review/audit output**: Temporary, not persisted
- **No external database or cloud storage**

## Uninstall

```bash
# Skills registry
npx -y github:DietrichGebert/ponytail -- --uninstall

# Claude Code
/plugin uninstall ponytail

# OpenCode
opencode plugin uninstall ponytail

# Manual: remove ruleset files, hooks, config entries
```

## Do Not Enable If

- **MUST BE OFF while working on**: auth, payments, input validation, cryptography, secrets handling, security audit/penetration testing code, or other security-sensitive code
- You need comprehensive/defensive implementations (Ponytail favors minimal)
- Code requires explicit error handling, validation, or compliance features
- Team policy requires verbose/defensive coding standards
- Working on code where "lazy" solutions could introduce vulnerabilities