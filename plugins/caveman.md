# Plugin Recipe: Caveman

## Source
- **Repository**: https://github.com/JuliusBrussee/caveman
- **Owner**: JuliusBrussee (Julius Brussee)
- **Pinned Version**: v3.2.0 (commit e20f07e, released 2026-10-08)
- **License**: Other (custom - "Caveman and the rock logo are trademarks of Julius Brussee")
- **Verification Date**: 2026-10-09

## What It Does
Ultra-compressed communication mode that cuts output tokens while keeping technical accuracy. Makes agents answer in "caveman-speak" (terse, fragment-based). Also includes a local proxy/middleware mode that compresses all provider traffic.

## Install Commands (Per Harness)

### Codex
```bash
# Skill mode only (recommended)
npx skills add JuliusBrussee/caveman --skill '*' -a codex --yes

# Full installer with hooks (Node.js 18+)
curl -fsSL https://raw.githubusercontent.com/JuliusBrussee/caveman/v3.2.0/install.sh | bash
```

### OpenCode
```bash
# Skill mode only
npx skills add JuliusBrussee/caveman --skill '*' -a opencode --yes

# Full installer
curl -fsSL https://raw.githubusercontent.com/JuliusBrussee/caveman/v3.2.0/install.sh | bash
```

### kilo
```bash
# Skill mode only - kilo uses AGENTS.md and skills
npx skills add JuliusBrussee/caveman --skill '*' -a kilo --yes
```

### cline
```bash
# Skill mode only - Cline uses instruction files
npx skills add JuliusBrussee/caveman --skill '*' -a cline --yes
```

### Generic (skills registry)
```bash
npx skills add JuliusBrussee/caveman
```

## Hooks/Commands/Services/Files Added

**Skill Mode (minimal)**:
- Rule file in agent's config directory (e.g., `.claude/rules/caveman.md`, `.cursor/rules/caveman.mdc`)
- No hooks, no background services

**Full Installer (with hooks)**:
- **Claude Code hooks**: Writes flag file each session for auto-activation
- **Statusline**: `/caveman-stats` reads session log, writes token savings to statusline
- **Commands**: `/caveman`, `/caveman-commit`, `/caveman-review`, `/caveman-stats`, `/caveman-compress`
- **Memory compression**: `/caveman-compress` rewrites memory files (like `CLAUDE.md`, `AGENTS.md`)

**Local Proxy/Middleware Mode (caveman-code)**:
- **@caveman-ai/agent** - native TypeScript runtime that owns the entire agent loop
- Routes ALL provider traffic through compression
- Puts Caveman in the path of every request
- **NEEDS SEPARATE REVIEW** - this is a full agent runtime, not just a skill

## Data Recorded & Storage

**Skill Mode**: None (only changes output style)

**Full Installer**:
- Session flag file (tiny, for auto-activation)
- Token usage stats (for `/caveman-stats`)
- Compressed memory files (if `/caveman-compress` run)

**Proxy Mode**: All provider request/response traffic

## Uninstall

```bash
# Skill mode
npx -y github:JuliusBrussee/caveman -- --uninstall

# Full installer
npx -y github:JuliusBrussee/caveman -- --uninstall

# Manual: remove rule files from agent config directories
```

## Do Not Enable If

- **Skill mode only to start** - full installer adds hooks and modifies memory files
- **Local proxy/middleware mode (`caveman-code`)** puts Caveman in the path of EVERY request - needs separate security review
- **Never run `/caveman-compress` on AGENTS.md directly** - only on a copy that you diff first
- You need verbose explanations for learning/onboarding
- Team members object to terse communication style
- License is "Other" (custom) - verify compatibility with your policies