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

Generate the proposal from the recon report and `kit.config.yaml`:

```bash
node scripts/propose.js --recon /tmp/recon-report.json --config kit.config.yaml --output /tmp/proposal.md
```

The proposal (`.agent-kit/PROPOSAL.md`) lists:
- Every file the kit will **create**
- Every file the kit will **modify** (with the exact marker-block merge strategy)
- Every skill/MCP/hook/plugin that will be **enabled** (based on detected stack + kit.config.yaml)
- Any **UNVERIFIED** items (harness adapters not verified, missing commands, etc.)

**STOP and wait for user approval.** Make no changes before explicit approval.

---

## Step 3: Apply (Additive Only)

Apply the approved proposal:

```bash
node scripts/apply.js --target /path/to/target/repo --proposal /tmp/proposal.md --kit-root ~/agent-kit
```

Apply rules:
- **Never overwrite or reformat** existing user files
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
- **Idempotent**: running twice produces the same result

---

## Step 4: Verify

Run the repo's own checks **before and after** applying:

```bash
# Before (captured during recon)
node scripts/verify.js --target /path/to/target/repo --phase before --commands "<from-recon>"

# After
node scripts/verify.js --target /path/to/target/repo --phase after --commands "<from-recon>"
```

If "after" is worse than "before" (new failures, new warnings), **revert all changes** and report.

---

## Step 5: Manifest

Write `.agent-kit/manifest.json` listing:
- Every file **created** (with hash)
- Every file **modified** (with before-hash and after-hash)
- Kit commit hash (`git rev-parse HEAD` from kit repo)
- Kit version (from `package.json` or `kit.config.yaml`)
- Timestamp
- Enabled features (skills, MCPs, hooks, plugins)

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