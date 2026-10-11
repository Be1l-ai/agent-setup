<!-- agent-kit:start -->
# AGENTS.md

This file guides how an AI agent should work in this repository.

## Repository Commands

<!-- agent-kit:commands:start -->
(apply fills this in from the repo's package.json / Makefile / pyproject.toml)
<!-- agent-kit:commands:end -->

## Core Rules

1. **Run the repo's check command before saying done** — Use the commands above. If they fail, fix them.
2. **Ask before publish/deploy/migrations/deleting data** — Get explicit approval for any destructive or external action.
3. **Never read .env, .pem, .key, or credential files** — Blocked by the OpenCode permission config and the guard plugin. Still: do not try to route around it.
4. **Use the repo's own formatter/linter** — `node .agent-kit/format-on-edit.js` runs it on a file if you invoke it; it is not auto-registered.

## Skill Selection

Read the skill folder when doing the corresponding task:

| Task | Skill Folder |
|------|--------------|
| Systematic debugging | `.agent-kit/skills/systematic-debugging/` |
| Test-driven development | `.agent-kit/skills/test-driven-development/` |
| Receiving code review | `.agent-kit/skills/receiving-code-review/` |
| Finishing a development branch | `.agent-kit/skills/finishing-a-development-branch/` |
| Security code review | `.agent-kit/skills/claude-code-security-review/` |
| Frontend design (UI repos only) | `.agent-kit/skills/frontend-design/` |

## Tool Name Mapping

| Skill References | Use This Harness's Equivalent |
|------------------|-------------------------------|
| `bash` / `shell` | Your harness's shell tool |
| `read` / `cat` | Your harness's file read tool |
| `write` / `edit` | Your harness's file write/edit tool |
| `grep` / `rg` | Your harness's search tool |
| `glob` / `find` | Your harness's file pattern tool |
| `task` / `subagent` | Your harness's subagent/spawn tool (if available) |

If a skill names a vendor-specific tool, map to your harness's equivalent.

## Security-Sensitive Code Rule

**Ponytail (and similar auto-completion tools) MUST BE OFF** when working on:
- Authentication / authorization code
- Payment processing
- Input validation / sanitization
- Cryptography / secrets handling
- Security audit / penetration testing code

<!-- agent-kit:end -->