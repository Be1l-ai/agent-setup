<!-- agent-kit:start -->
# AGENTS.md

This file guides how an AI agent should work in this repository.

## Repository Commands

<!-- agent-kit:commands:start -->
# Detect at apply time from package.json, Makefile, pyproject.toml, etc.
# Example:
# test: npm test
# lint: npm run lint
# format: npm run format
# typecheck: npm run typecheck
# build: npm run build
<!-- agent-kit:commands:end -->

## Core Rules

1. **Run the repo's check command before saying done** — Use the commands above. If they fail, fix them.
2. **Ask before publish/deploy/migrations/deleting data** — Get explicit approval for any destructive or external action.
3. **Never read .env, .pem, .key, or credential files** — These are blocked by the guard hook.
4. **Use the repo's own formatter/linter** — The format-on-edit hook runs it automatically.

## Skill Selection

Read the skill folder when doing the corresponding task:

| Task | Skill Folder |
|------|--------------|
| Systematic debugging | `skills/systematic-debugging/` |
| Test-driven development | `skills/test-driven-development/` |
| Receiving code review | `skills/receiving-code-review/` |
| Finishing a development branch | `skills/finishing-a-development-branch/` |
| Security code review | `skills/claude-code-security-review/` |
| Frontend design (UI repos only) | `skills/frontend-design/` |

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