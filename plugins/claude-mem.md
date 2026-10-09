# Plugin Recipe: claude-mem

## Source
- **Repository**: https://github.com/thedotmack/claude-mem
- **Owner**: thedotmack (Alex Newman)
- **Pinned Version**: v13.35.0 (commit 71ddd11, released 2026-10-09)
- **License**: AGPL-3.0 (source), Apache-2.0 (conflicting info - verify before use)
- **Verification Date**: 2026-10-09

## What It Does
Persistent context across sessions. Captures tool usage observations, generates semantic summaries via AI compression, and injects relevant context into future sessions. Includes a local worker MCP and hosted cmem.ai MCP.

## Install Commands (Per Harness)

### Codex
```bash
# UNVERIFIED - not documented in project README for Codex
codex plugin marketplace add thedotmack/claude-mem
codex plugin install claude-mem
```

### OpenCode
```bash
# UNVERIFIED - not documented in project README for OpenCode
opencode plugin install thedotmack/claude-mem
```

### kilo
```bash
# UNVERIFIED - not documented in project README for kilo
# kilo uses AGENTS.md and skills, not plugin marketplace
```

### cline
```bash
# UNVERIFIED - not documented in project README for cline
# Cline uses .cursor/rules or similar
```

### Claude Code (for reference)
```bash
/plugin marketplace add thedotmack/claude-mem
/plugin install claude-mem
```

### Generic (npm)
```bash
npx -y github:thedotmack/claude-mem
```

## Hooks/Commands/Services/Files Added

From code review (src/):
- **Hooks**: `hooks/bridge.ts` - hooks into Claude Code/Codex native memory lookups
- **MCP Server**: `src/servers/mcp-server.ts` - exposes `mem_search` and `save_memory` tools
- **HTTP Server**: `src/services/worker/http/routes/MemoryRoutes.ts` - POST `/api/memory/save`
- **Database**: SQLite at `~/.claude-mem/claude-mem.db`
- **Vector Store**: Chroma at `~/.claude-mem/chroma/`
- **Config**: `~/.claude-mem/config.json`
- **Commands**: `/mem`, `/mem-search`, `/save-memory` (via plugin system)

## Data Recorded & Storage

**Records**:
- All tool usage observations (file reads, writes, searches, bash commands)
- Semantic summaries generated via Claude Agent SDK
- User-provided notes via `save_memory` tool

**Stores**:
- SQLite database: `~/.claude-mem/claude-mem.db` (session data, observations)
- Chroma vector store: `~/.claude-mem/chroma/` (embeddings for semantic search)
- Config: `~/.claude-mem/config.json`

**MUST be git-ignored**:
- `~/.claude-mem/` (entire directory)
- `.env` must be denied (contains ANTHROPIC_API_KEY for compression)

## Uninstall

```bash
# Via plugin system (if installed that way)
/plugin uninstall claude-mem

# Manual cleanup
rm -rf ~/.claude-mem
rm -rf ~/.claude/plugins/marketplaces/thedotmack/claude-mem
```

## Do Not Enable If

- You work with sensitive/proprietary code that must not leave your machine (uses hosted cmem.ai MCP by default)
- You cannot guarantee `.claude-mem/` is git-ignored and `.env` is protected
- You need full control over what context is injected (compression is AI-driven, not deterministic)
- Repository policy forbids AGPL-3.0 licensed tools (license ambiguity between AGPL-3.0 and Apache-2.0)