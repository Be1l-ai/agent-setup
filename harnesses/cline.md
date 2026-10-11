# Harness Adapter: cline

## Source
- **Official Docs**: https://docs.cline.bot/customization/hooks
- **Repo**: https://github.com/cline/cline/blob/main/.clinerules/hooks/README.md
- **Verified**: 2026-10-09 (paths below are UNVERIFIED; current docs point to SDK plugins, not command hooks)

## Config Location
- Project: `.clinerules/hooks/` (workspace) - can be committed
- Global: `~/Documents/Cline/Hooks/` (macOS/Linux)
- CLI: `~/.cline/hooks/` or `--hooks-dir` / `CLINE_HOOKS_DIR`

## Hook Events (Verified)
| Event | When It Runs |
|-------|--------------|
| `TaskStart` | New task started |
| `TaskResume` | Existing task resumed |
| `TaskCancel` | Task cancelled |
| `TaskComplete` | Task marked complete |
| `UserPromptSubmit` | User submits message |
| `PreToolUse` | Before tool executes |
| `PostToolUse` | After tool completes |
| `PreCompact` | Before context compaction |

## Hook Format
- **Filename**: Exact event name, **no extension** (e.g., `PreToolUse`)
- **Shebang required**: `#!/usr/bin/env bash` or `#!/usr/bin/env node`
- **Executable**: `chmod +x PreToolUse` (Unix/Linux/macOS)
- **Windows**: Not supported (use `.ps1` PowerShell scripts)
- **Enable**: Check "Enable Hooks" in Cline Settings → Features

## Input/Output
- **Input**: JSON on stdin with common fields + hook-specific field
  - Common: `clineVersion`, `hookName`, `timestamp`, `taskId`, `workspaceRoots`, `userId`, `model`
  - Specific: `preToolUse`, `postToolUse`, `userPromptSubmit`, `taskStart`, `taskResume`, `taskCancel`, `taskComplete`, `preCompact`
- **Output**: JSON on stdout
  ```json
  {
    "cancel": boolean,              // Required: true = block, false = continue
    "contextModification": "string", // Optional: context for future AI decisions (max 50KB)
    "errorMessage": "string"         // Optional: shown if cancel=true
  }
  ```

## Example Hook (PreToolUse)
```bash
#!/usr/bin/env bash
# .clinerules/hooks/PreToolUse
input=$(cat)
tool=$(echo "$input" | jq -r '.preToolUse.tool')
params=$(echo "$input" | jq -r '.preToolUse.parameters')

# Block reading .env files
if [[ "$tool" == "read_file" ]] && echo "$params" | jq -e '.path | test("\\.env$")'; then
  echo '{"cancel": true, "errorMessage": "Reading .env files blocked"}'
  exit 0
fi

# Block git push --force
if [[ "$tool" == "run_commands" ]] && echo "$params" | jq -e '.commands[] | test("git push.*--force")'; then
  echo '{"cancel": true, "errorMessage": "git push --force blocked"}'
  exit 0
fi

echo '{"cancel": false}'
```

## Agent Kit Mapping
| Kit Hook | Cline Event |
|----------|-------------|
| guard | `PreToolUse` |
| format-on-edit | `PostToolUse` (after write/edit) |
| done-gate | `TaskComplete` |
| session-start | `TaskStart` |

## Notes
- All matching hooks (global + workspace) run **concurrently** via `Promise.all`
- **No execution order guaranteed**
- If ANY hook returns `cancel: true`, operation is blocked
- `contextModification` affects future AI decisions, not current tool
- Timeout: 30 seconds (configurable via `HOOK_EXECUTION_TIMEOUT_MS`)
- Context modification limit: 50KB (`MAX_CONTEXT_MODIFICATION_SIZE`)
- Hooks disabled in `--yolo` mode (CLI)
- Windows not supported for extension hooks
- Legacy `.clinerules/` layout also supported (`.clinerules/hooks/`, `.clinerules/workflows/`, etc.)
- Project also reads `AGENTS.md` at root and skills in `.agents/skills/`

## Agent Kit Installation
Apply script should:
1. Create `.clinerules/hooks/` directory
2. Copy hook scripts with correct names (no extension)
3. `chmod +x` each hook
4. Remind user to enable "Enable Hooks" in Cline settings

## Limitations
- No `Stop` event (use `TaskComplete` as proxy)
- No async hooks
- No hook-specific config (all hooks run on every event)
- Windows requires PowerShell (`.ps1`) - not in kit