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