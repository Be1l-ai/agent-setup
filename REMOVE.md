# REMOVE.md — Agent Kit Uninstall Procedure

This procedure uses the manifest created during apply to revert all changes exactly.

## Prerequisites

- Target repo is a git repository
- `.agent-kit/manifest.json` exists (created by apply)
- You are on the `agent-kit-setup` branch (or the branch where apply was run)

## Procedure

```bash
cd /path/to/target/repo
node /path/to/agent-kit/scripts/remove.js --target .
```

The remove script:
1. Reads `.agent-kit/manifest.json`
2. For each **created file**: deletes it
3. For each **modified file**: restores the exact before-hash content
4. Removes `.agent-kit/` directory
5. Commits the reversal (or stages for user to commit)

## Flags

```bash
node /path/to/agent-kit/scripts/remove.js --target . [--dry-run] [--ignore-hash]
```

- `--dry-run` — print the planned action for every manifest entry (`restore` for files that existed before apply, `delete` for files the kit created), then exit `0` without changing anything. The hash check below runs first, so a drifted tree is still refused; add `--ignore-hash` to preview a forced removal.
- `--ignore-hash` — skip the hash check and remove anyway, even though installed files changed since apply. **This discards local edits to those files** (see below).

## Files Changed Since Apply

Before touching anything, remove.js hashes every installed file and compares it to the `afterHash` recorded in the manifest at apply time. Local adaptation is expected — the kit tells you to review and adjust `kit.config.json`, and the target repo's conventions win — so files that no longer match what apply wrote are a normal state, not an error.

- If every file still matches, remove.js proceeds normally.
- If any installed file changed, remove.js **refuses to remove anything**: no file is deleted or restored and no directory is pruned. It prints the offending paths and exits with a non-zero status (`1`):

```text
[remove] ERROR: these files changed since apply and will not be touched:
  <path>
  <path>
Review them, then re-run with --ignore-hash to force.
```

A file you deleted also counts as changed, because its hash can no longer be read.

### If you have locally edited kit files

Do not lose that work by accident:

1. Read the list of changed files in the error message.
2. Save those edits — commit them, copy them aside, or fold them back into the kit. `--ignore-hash` will **not** preserve them.
3. Re-run with the flag to force removal:

```bash
node /path/to/agent-kit/scripts/remove.js --target . --ignore-hash
```

**`--ignore-hash` discards local edits.** For files that existed before apply, removal restores the pre-apply backup over the file, replacing it wholesale — this drops both the kit's content and any edits you made on top of it. Files the kit created are deleted outright. There is no merge and no per-file prompt; the flag is all-or-nothing. When it forces past changed files, remove.js lists them:

```text
[remove] Forced past changed files: <path>, <path>
```

### Unfinished entries

An entry with no `afterHash` means apply never finished writing that file. remove.js skips it during the hash check and leaves it untouched — a created file that apply did not finish is not deleted — and reports `Left N unfinished entries untouched (never written by apply).`

## Manual Fallback

If the manifest is missing or corrupted:

```bash
# 1. Check git status for kit-added files
git status

# 2. Look for marker blocks in AGENTS.md, CLAUDE.md, etc.
#    Delete content between <!-- agent-kit:start --> and <!-- agent-kit:end -->

# 3. Delete any files created by the kit:
#    - .agent-kit/
#    - .claude/ (only kit-added content)
#    - .cursor/rules/ (only kit-added)
#    - .opencode/ (only kit-added)
#    - .kilocode/ (only kit-added)
#    - .codex/ (only kit-added)
#    - .mcp.json (only kit-added keys)
#    - hooks/ (only kit-added, if any)

# 4. Restore modified files from git:
git checkout HEAD -- <file>

# 5. Delete the branch
git checkout main
git branch -D agent-kit-setup
```

## Verification

After removal:
- `git status` should be clean (or back to pre-apply state)
- No `.agent-kit/` directory
- No kit marker blocks in any file
- Repo's own test/lint commands pass