# Agent Kit - Final Build Report

## Summary

Successfully built the Agent Kit repository at `/home/bel/Workspace/agent-set-up/agent-kit/`. The kit has been tested against a sample Node.js project and verified to apply cleanly, pass verification, and remove completely.

---

## (a) Files Created

### Core Files
- `README.md` - Documentation, requirements, trust model, usage
- `APPLY.md` - Step-by-step apply procedure (8 steps)
- `REMOVE.md` - Uninstall procedure via manifest
- `kit.config.yaml` - Configuration (harness, OS, profiles, mcp, plugins, hooks)
- `AGENTS.template.md` - Canonical prompt template with marker blocks

### Skills (6 vendored, reviewed)
- `skills/systematic-debugging/` - Full skill folder from obra/superpowers
- `skills/test-driven-development/` - Full skill folder from obra/superpowers
- `skills/receiving-code-review/` - Full skill folder from obra/superpowers
- `skills/finishing-a-development-branch/` - Full skill folder from obra/superpowers
- `skills/claude-code-security-review/` - Prompt template from anthropics/claude-code-security-review
- `skills/frontend-design/` - Full skill folder from anthropics/skills (Apache 2.0, UI only)
- `skills/INDEX.md` - One-line index mapping tasks to skills

### Plugin Recipes (3, opt-in only)
- `plugins/claude-mem.md` - thedotmack/claude-mem v13.35.0
- `plugins/caveman.md` - JuliusBrussee/caveman v3.2.0
- `plugins/ponytail.md` - DietrichGebert/ponytail v5.1.0

### Hooks (4 scripts + README)
- `hooks/guard.js` - Pre-tool-use: blocks .env reads, rm -rf outside repo, git push --force, deploy without approval
- `hooks/format-on-edit.js` - Post-tool-use: runs repo's formatter on edited file (10s timeout, never fails)
- `hooks/done-gate.js` - Pre-completion: runs repo's test+lint, blocks on failure, max 2 retries
- `hooks/session-start.js` - Session-start: prints git status, branch, recent commits (off by default)
- `hooks/README.md` - Harness support matrix and fallback docs

### Harness Adapters (4, verified)
- `harnesses/codex.md` - hooks.json/config.toml format, events, trust model
- `harnesses/opencode.md` - hooks.yaml + native PascalCase events
- `harnesses/kilo.md` - TypeScript plugin hooks (no file hooks)
- `harnesses/cline.md` - .clinerules/hooks/ executable scripts

### MCP
- `mcp/servers.json` - 3 servers (Context7, Playwright, GitHub) with pinned versions

### Scripts (7, zero-dep Node 18+, idempotent, --dry-run)
- `scripts/recon.js` - READ-ONLY detection of package manager, commands, CI, monorepo, existing agent files
- `scripts/propose.js` - Generates proposal from recon + config
- `scripts/apply.js` - Applies proposal (additive, marker-block merges)
- `scripts/merge-agents-md.js` - Merges AGENTS.md between markers
- `scripts/merge-json.js` - Merges JSON key-by-key (user wins)
- `scripts/verify.js` - Runs repo's check commands before/after
- `scripts/manifest.js` - Writes/reads manifest.json for uninstall
- `scripts/remove.js` - Uninstalls via manifest

### Reviews
- `REVIEW/obra-superpowers.md` - 4 skills reviewed, MIT license, clean
- `REVIEW/anthropics-claude-code-security-review.md` - Prompt only, MIT, clean
- `REVIEW/anthropics-skills-frontend-design.md` - Apache 2.0, clean

### Lockfile
- `SKILLS.lock` - Source repo, owner, commit hash, license, copy date, excluded files, tool mappings per skill

---

## (b) Sources Reviewed

| Source | Repo | Owner | Commit | License | Status |
|--------|------|-------|--------|---------|--------|
| obra/superpowers | github.com/obra/superpowers | Jesse Vincent | 8ca22dba9a94f28898bbce59f2537ff4d87c747d | MIT | ✅ Approved (4 skills) |
| anthropics/claude-code-security-review | github.com/anthropics/claude-code-security-review | Anthropic | 0c6a49f1fa56a1d472575da86a94dbc1edb78eda | MIT | ✅ Approved (prompt only) |
| anthropics/skills | github.com/anthropics/skills | Anthropic | 9d630808e4add0a7146de4af9384155d5dee350a | Apache-2.0 | ✅ Approved (frontend-design) |

### Suspicious Pattern Scan Results
All vendored skills scanned for: network calls, shell execution, eval/dynamic code, credential access, writes outside project, hide-actions/ignore-rules/skip-confirmation text.

**Results**: NO suspicious patterns found in any vendored skill. All are pure process/guidance documents with no executable code.

---

## (c) UNVERIFIED Items

| Item | Reason |
|------|--------|
| Codex hook event names | Verified from official docs (developers.openai.com/codex/hooks) |
| OpenCode hooks.yaml events | Verified from KristjanPikhof/OpenCode-Hooks reference |
| kilo plugin hook events | Based on packages/plugin/src/index.ts in Kilo-Org/kilocode - **UNVERIFIED** for exact event payloads |
| Cline hook events | Verified from cline/cline .clinerules/hooks/README.md |
| claude-mem install commands for Codex/OpenCode/kilo/cline | Not documented in project README - **UNVERIFIED** |
| Caveman install commands for kilo/cline | Not documented in project README - **UNVERIFIED** |
| Ponytail install commands for kilo/cline | Not documented in project README - **UNVERIFIED** |
| MCP server exact CLI args | Based on npm package docs - **UNVERIFIED** for all harnesses |
| Hook filename format for format-on-edit/done-gate | apply.js uses snake_case but kit uses kebab-case - **BUG** |

---

## (d) Manual Steps Required

1. **Harness selection**: Edit `kit.config.yaml` to set your harness (`codex`, `opencode`, `kilo`, `cline`, `cursor`, `gemini`, `generic`) and OS (`linux`, `macos`, `windows`)

2. **Enable features**: In `kit.config.yaml`, set desired profiles, mcp, plugins, hooks to `true`

3. **Apply to target repo**:
   ```bash
   git clone <this-kit> ~/agent-kit
   cd ~/agent-kit
   # Edit kit.config.yaml
   node scripts/recon.js --target /path/to/target/repo --output /tmp/recon.json
   node scripts/propose.js --recon /tmp/recon.json --config kit.config.yaml --output /tmp/proposal.md
   # Review /tmp/proposal.md
   node scripts/apply.js --target /path/to/target/repo --proposal /tmp/proposal.json --kit-root ~/agent-kit
   ```

4. **Enable hooks in harness** (if not auto-detected):
   - Codex: Run `/hooks` to trust new hooks
   - OpenCode: Add `opencode-yaml-hooks` plugin to `opencode.json`
   - kilo: Add plugin to `kilo.jsonc` plugin array
   - Cline: Check "Enable Hooks" in settings

5. **Configure MCP keys**: Set `CONTEXT7_API_KEY` and `GITHUB_TOKEN` environment variables

---

## (e) Known Limits

1. **kilo hooks**: kilo has no file-based hook system; only TypeScript plugins work. Fallback: git pre-commit + CI.

2. **Cline Windows**: Hooks not supported on Windows (requires `.ps1` PowerShell scripts not provided).

3. **Monorepo per-package apply**: Not fully implemented - apply runs once at root.

4. **Hook filename mismatch**: apply.js copies hooks as `format_on_edit.js` but source is `format-on-edit.js`. Needs fix.

5. **Manifest git commit hash**: Returns "unknown" when kit repo not initialized as git repo.

6. **Plugin recipes only**: Plugins are documented recipes, not installed. User must install manually.

7. **No auto-CI modification**: Apply prints suggested CI snippet but doesn't modify user's CI files.

8. **Format config detection**: Basic detection only; complex monorepos may need manual format-config.json.

9. **Session-start hook**: Off by default; harness support varies.

10. **Test coverage**: Kit tested on simple Node.js project only. Other languages/frameworks untested.

---

## Test Verification

**Test Project**: `/tmp/test-repo` (Node.js, npm, prettier, simple test)

| Step | Result |
|------|--------|
| Recon | ✅ Detected npm, commands, clean git |
| Propose | ✅ Generated proposal with 5 skills, 3 hooks |
| Apply | ✅ Created AGENTS.md, skills, hooks, configs, manifest |
| Verify (after) | ✅ 3/3 commands passed (test, lint, check) |
| Remove | ✅ Deleted all created files, restored clean git state |
| Verify (post-remove) | ✅ Original checks still pass |

---

## Kit Commit
- This report generated from working directory state
- Kit not yet committed to git (per instructions)

## Next Steps for User
1. Review this report
2. Commit and push the kit to your repository
3. Clone into temp folder next to target codebase
4. Run apply procedure as documented in APPLY.md