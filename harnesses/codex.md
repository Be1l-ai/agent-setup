# Harness Adapter: Codex

## Source
- **Official Docs**: https://developers.openai.com/codex/hooks
- **Verified**: 2026-10-09

## Config Location
- Project: `.codex/hooks.json` or `.codex/config.toml` (with `[hooks]` table)
- User: `~/.codex/hooks.json` or `~/.codex/config.toml`

## Input / blocking contract (verified from docs)
- One JSON object on **stdin**. Tool name is `tool_name` (`Bash`, `Write`, `Edit`, ...).
  Tool args are under `tool_input` (e.g. `tool_input.command`).
- Block a tool by exiting **2** with the reason on stderr, or by printing
  `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"..."}}`.
- `Stop` cannot reject a turn: it makes Codex **continue**, using the reason as a
  new prompt. So the done-gate must be CI / pre-commit, not a `Stop` hook.
- Non-managed hooks must be reviewed and trusted (`/hooks`) before they run.

## Hook Events (Verified)
| Event | Description |
|-------|-------------|
| `SessionStart` | Thread/subagent start (matcher: `startup|resume|compact`) |
| `UserPromptSubmit` | User submits a prompt |
| `PreToolUse` | Before tool/command runs (matcher: tool name, e.g., `Bash`, `Write`, `Edit`) |
| `PermissionRequest` | Before permission dialogs (matcher: tool name) |
| `PostToolUse` | After successful tool execution (matcher: tool name) |
| `Stop` | When automation loop ends |
| `SubagentStart` | Subagent starts |
| `SubagentStop` | Subagent stops |
| `PreCompact` | Before context compaction |
| `PostCompact` | After context compaction |
| `Interrupt` | User interrupts |

## Hook Handler Types
| Type | Fields | Supported |
|------|--------|-----------|
| `command` | `command`, `commandWindows`, `timeout`, `async`, `statusMessage`, `additionalContextLimit` | ✅ |
| `mcp_tool` | `server`, `tool`, `input`, `timeout`, `statusMessage` | ✅ |
| `prompt` | — | ❌ (skipped) |
| `agent` | — | ❌ (skipped) |

## Config Format (hooks.json)
```json
{
  "description": "Agent Kit hooks",
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node $(git rev-parse --show-toplevel)/.codex/hooks/guard.js Bash ${tool_input.command}",
            "timeout": 30,
            "statusMessage": "Guard check"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node $(git rev-parse --show-toplevel)/.codex/hooks/format-on-edit.js Write ${tool_input.file_path}",
            "timeout": 10,
            "statusMessage": "Format check"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node $(git rev-parse --show-toplevel)/.codex/hooks/done-gate.js",
            "timeout": 120,
            "statusMessage": "Verify checks"
          }
        ]
      }
    ]
  }
}
```

## Input/Output
- **Input**: JSON on stdin with fields: `session_id`, `cwd`, `hook_event_name`, `tool_name`, `tool_input`, `tool_response`, `permission_mode`, `model`, `turn_id`, `transcript_path`
- **Output**: JSON on stdout with: `continue` (boolean), `decision` (block/allow), `hookSpecificOutput` (additionalContext, updatedInput, etc.), `reason`, `stopReason`, `suppressOutput`, `systemMessage`

## Trust Model
- New/changed hooks require review via `/hooks` command
- Hashes stored in `[state]` table in `config.toml`
- `hooks = false` under `[features]` disables all hooks

## Agent Kit Mapping
| Kit Hook | Codex Event | Matcher |
|----------|-------------|---------|
| guard | `PreToolUse` | `Bash` |
| format-on-edit | `PostToolUse` | `Write|Edit` |
| done-gate | `Stop` | (none) |
| session-start | `SessionStart` | `startup|resume` |

## Notes
- Commands run with session `cwd` as working directory
- Use `$(git rev-parse --show-toplevel)` for stable paths
- Timeout default: 600s (SessionEnd/Interrupt: 1s, max 3s)
- `async: true` runs in background (cannot block/rewrite)
- Plugin hooks via `.codex-plugin/plugin.json` with `hooks` entry