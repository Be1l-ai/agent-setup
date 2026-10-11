# Agent Kit - Final Build Report

## Summary

Built the Agent Kit repository at `/home/bel/Workspace/agent-set-up/agent-kit/`. The original test table below was from the pre-fix build. The fix pass (see the status section) changed apply, remove, guard, done-gate, and config; that build was re-tested only against the fixture described in the status section.

---

## (a) Files Created

### Core Files
- `README.md` - Documentation, requirements, trust model, usage
- `APPLY.md` - Step-by-step apply procedure (8 steps)
- `REMOVE.md` - Uninstall procedure via manifest
- `kit.config.json` - Configuration (harness, OS, profiles, mcp, plugins, hooks)
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
- `plugins/opencode/agent-kit-guard.mjs` - OpenCode plugin: blocks tool calls via `tool.execute.before` (verified 1.18.35)
- `plugins/opencode/agent-kit-guard-core.mjs` - Guard rules: secrets, rm, force-push, deploy, kit-protected paths
- `hooks/done-gate.js` - Standalone: runs the repo's verify command, fails closed, no retry counter
- `hooks/format-on-edit.js` - Standalone: runs the repo's formatter on one file (argv array, no shell)
- `hooks/session-start.js` - Standalone: prints git status, branch, commits, kit config
- `hooks/README.md` - Harness support matrix and fallback docs

### Harness Adapters (4, verified)
- `harnesses/codex.md` - hooks.json/config.toml format, events, trust model
- `harnesses/opencode.md` - OpenCode plugin + permission block, verified against 1.18.35
- `harnesses/kilo.md` - TypeScript plugin hooks (no file hooks)
- `harnesses/cline.md` - .clinerules/hooks/ executable scripts

### MCP
- `mcp/servers.json` - 3 servers (Context7, Playwright, GitHub) with pinned versions

### Scripts (7, zero-dep Node 18+, idempotent, --dry-run)
- `scripts/recon.js` - READ-ONLY detection of package manager, commands, CI, monorepo, existing agent files
- `scripts/propose.js` - Generates proposal from recon + config
- `scripts/apply.js` - Applies proposal (additive, marker-block merges)
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

**Results**: No network, credential, or write-outside-repo patterns found. The vendored set is mostly process/guidance markdown, but it is NOT all non-executable: `systematic-debugging/find-polluter.sh` (shell), `systematic-debugging/condition-based-waiting-example.ts` (TypeScript), and `claude-code-security-review/prompts.py` (Python) are included as files. They are copied as data and never run by the kit.

---

## (c) UNVERIFIED Items

| Item | Reason |
|------|--------|
| Codex hook event names | Verified from official docs (developers.openai.com/codex/hooks) |
| OpenCode hook integration | FIXED: the hooks.yaml reference was wrong. Verified plugin `tool.execute.before` + `permission` block against the real CLI. Registration in `opencode.json` `plugin` is required; directory auto-discovery did not load in 1.18.35 |
| kilo plugin hook events | Based on packages/plugin/src/index.ts in Kilo-Org/kilocode - **UNVERIFIED** for exact event payloads |
| Cline hook events | Verified from cline/cline .clinerules/hooks/README.md |
| claude-mem install commands for Codex/OpenCode/kilo/cline | Not documented in project README - **UNVERIFIED** |
| Caveman install commands for kilo/cline | Not documented in project README - **UNVERIFIED** |
| Ponytail install commands for kilo/cline | Not documented in project README - **UNVERIFIED** |
| MCP server exact CLI args | Based on npm package docs - **UNVERIFIED** for all harnesses |
| Hook filename format for format-on-edit/done-gate | FIXED: config keys and filenames are now both kebab-case (guard, format-on-edit, done-gate, session-start) |

---

## (d) Manual Steps Required

1. **Harness selection**: Edit `kit.config.json` to set your harness (`codex`, `opencode`, `kilo`, `cline`, `cursor`, `gemini`, `generic`) and OS (`linux`, `macos`, `windows`)

2. **Enable features**: In `kit.config.json`, set desired profiles, mcp, plugins, hooks to `true`

3. **Apply to target repo**:
   ```bash
   git clone <this-kit> ~/agent-kit
   cd ~/agent-kit
   # Edit kit.config.json
   node scripts/recon.js --target /path/to/target/repo --output /tmp/recon.json
   node scripts/propose.js --recon /tmp/recon.json --config kit.config.json --output /tmp/proposal.json
   # Review /tmp/proposal.json
   node scripts/apply.js --target /path/to/target/repo --proposal /tmp/proposal.json
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

4. **Hook filename mismatch**: FIXED (see section above). Hook naming is consistent across config, propose, and apply.

5. **Manifest git commit hash**: Returns "unknown" when kit repo not initialized as git repo.

6. **Plugin recipes only**: Plugins are documented recipes, not installed. User must install manually.

7. **No auto-CI modification**: Apply prints suggested CI snippet but doesn't modify user's CI files.

8. **Format config detection**: Basic detection only; complex monorepos may need manual format-config.json.

9. **Session-start hook**: Off by default; harness support varies.

10. **Test coverage**: Kit tested on simple Node.js project only. Other languages/frameworks untested.

---

## Test Verification (pre-fix build, historical)

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

---

## Fix pass status

The original build was superseded. Current state:

- **Scripts**: `recon`, `propose`, `apply`, `remove`, `lib`. `verify.js`, `merge-json.js`,
  `merge-agents-md.js`, and `manifest.js` were removed; nothing referenced them.
- **Config**: `kit.config.yaml` replaced by `kit.config.json`, so the zero-dependency
  claim is true. No `js-yaml`.
- **Apply**: preflight validation, backups of every pre-existing file, manifest written
  before the first change, automatic rollback on failure, idempotent re-apply.
- **Remove**: restores from backups, deletes only manifest-listed paths, refuses if a
  kit-written file changed since apply, leaves unrecorded user files alone.
- **Guard**: OpenCode plugin plus a harness-enforced `permission` block. Replaces the old
  `hooks/guard.js`, which read stdin while the adapter passed argv and so failed open.
- **Verified**: apply/re-apply/remove round trip restores a fixture repo byte for byte;
  dirty tree, invalid JSON, and existing-file cases are refused; rollback leaves no debris;
  the installed guard blocks `rm -rf .` in a live `opencode run` while a safe `rm` still runs.
- **Not verified**: other harnesses (adapters only), end-of-turn blocking (no harness
  supports it; use CI), and shell constructs the parser does not recognise.
