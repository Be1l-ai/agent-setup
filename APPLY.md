# APPLY.md — Agent Kit Apply Procedure

This document describes the exact procedure an agent follows to apply this kit to an existing repository.

## Prerequisites

- The kit is cloned **outside** the target repo (e.g., `~/agent-kit`)
- Target repo is a **git repository** with a **clean working tree** (no uncommitted changes)
- Node.js 18+ is available
- You are on a new branch: `git checkout -b agent-kit-setup`

If any prerequisite fails, **stop and ask the user**.

---

## Step 1: Recon (READ-ONLY)

Run the recon script to detect the target repo's configuration:

```bash
cd ~/agent-kit
node scripts/recon.js --target /path/to/target/repo --output /tmp/recon-report.json
```

The recon script detects:
- Package manager (npm, yarn, pnpm, bun, poetry, pip, cargo, go, make)
- Language(s) and framework(s)
- Test, lint, format, typecheck, build commands (from package.json scripts, Makefile, pyproject.toml, Cargo.toml, go.mod, etc.)
- CI system (GitHub Actions, GitLab CI, CircleCI, etc.)
- Monorepo layout (npm workspaces, yarn workspaces, pnpm workspaces, turborepo, nx, lerna)
- Existing agent files: `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, `.mcp.json`, `.claude/`, `.codex/`, `.opencode/`, `.kilocode/`, `AGENT.md`, etc.

**This step makes NO changes.** It writes a JSON report to the output path.

---

## Step 2: Proposal

Generate the proposal from the recon report and `kit.config.json`:

```bash
node scripts/propose.js --recon /tmp/recon-report.json --config kit.config.json --output /tmp/proposal.json
```

The proposal (`/tmp/proposal.json`, with a summary printed to stdout) lists:
- Every file the kit will **create**
- Every file the kit will **modify** (with the exact marker-block merge strategy)
- Every skill/MCP/hook that will be **enabled** (from kit.config.json)
- Any **UNVERIFIED** items (harness adapters not verified, missing commands, etc.)

**STOP and wait for user approval.** Make no changes before explicit approval.

---

## Step 3: Apply (Additive Only)

Apply the approved proposal:

```bash
node scripts/apply.js --target /path/to/target/repo --proposal /tmp/proposal.json
```

Apply rules:
- **Never overwrite** existing files: apply refuses to touch a file it would replace unless you pass `--overwrite`, which backs the original up first
- **Merge into AGENTS.md/CLAUDE.md only between marker comments**:
  ```html
  <!-- agent-kit:start -->
  ... kit content ...
  <!-- agent-kit:end -->
  ```
- **Merge MCP/JSON configs key-by-key**, never replace entire objects
- **User repo's conventions win** over kit defaults (indentation, quotes, command names, etc.)
- **Do not touch user's CI files**; at most print a suggested snippet to stdout
- **Per-package in monorepos**: apply to each package's root, not once at repo root
- **Idempotent**: a second run with the same proposal is a no-op
- **Backups**: every pre-existing file is copied to `.agent-kit/backup/` before it is changed
- **Rollback**: any failure during apply reverts all changes automatically

---

## Step 4: Verify

The apply script runs the repo's own checks **before and after** applying automatically when `verifyCommand` is configured.

If the verify command is set in the proposal (from `kit.config.json` or detected from recon), apply will:
1. Run the verify command **before** any writes, storing the result.
2. Run the verify command **after** all writes.
3. If "after" fails while "before" passed, **automatically revert** all changes and exit with a non-zero status (regression detected).
4. Report the before/after verify results in the final output.

The verify command runs from the target repo directory with a default timeout of 60 seconds. If `verifyCommand` is null/undefined (or a recon-derived placeholder like `unknown run ...`), verification is skipped (no-op).

**Outcome rules:**
- **Regression (before passed, after failed):** Automatic revert of all changes, exit non-zero.
- **Both before and after fail (or command cannot run):** Not a regression — no revert. Apply exits non-zero and reports a warning that verification did not pass. The kit files remain applied, and both verify results are reported.
- **Verify passes before and after:** Apply succeeds with "Applied." and exit 0.
- **No verify command configured:** Quiet no-op, succeeds with "Applied." and exit 0 (no verify messages).

You can still run verification manually if needed:

```bash
# Before (captured during recon)
cd /path/to/target/repo && <verifyCommand from proposal.json>

# After
cd /path/to/target/repo && <verifyCommand from proposal.json>
```

---

## Step 5: Manifest

Apply writes `.agent-kit/manifest.json` **before** the first change and updates it after each write. It records:
- Every file the kit wrote, whether it existed before, and its backup path
- Hash of each file after apply (remove.js uses it to detect edits)
- Kit commit hash, proposal hash, timestamp
- Enabled skills, hooks, MCP servers

This enables exact uninstall via `REMOVE.md`.

---

## Step 6: Final Report

Print a summary to the user:
- What was **added** (files, skills, hooks, MCPs)
- What was **skipped** and why (e.g., "frontend-design: repo has no UI", "claude-mem: disabled in config")
- Anything **UNVERIFIED** (harness adapters, missing commands, etc.)
- The **exact command to undo**: `node scripts/remove.js --target /path/to/target/repo`

---

## Hard Rules (Enforced by Scripts)

1. No changes without a clean git working tree at start
2. No changes without explicit user approval of the proposal
3. No overwriting user files — only marker-block merges
4. No enabling plugins/proxies/memory tools/database MCPs/production MCPs unless explicitly asked in that session
5. Verify runs before AND after; revert on regression
6. Manifest written for every apply
7. All scripts: zero dependencies, Node 18+, idempotent, `--dry-run` flag
8. Apply refuses a dirty target (override: `--allow-dirty`) and refuses to overwrite existing kit targets (override: `--overwrite`, which backs them up)