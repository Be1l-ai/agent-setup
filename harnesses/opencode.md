# Harness Adapter: OpenCode

## Source
- **Official Docs**: https://opencode.ai/docs/config/
- **Hooks Reference**: https://github.com/KristjanPikhof/OpenCode-Hooks/blob/HEAD/docs/hooks-v2-reference.md
- **Verified**: 2026-10-09

## Config Location
- Project: `.opencode/hook/hooks.yaml` (via `opencode-yaml-hooks` plugin)
- User: `~/.config/opencode/hook/hooks.yaml`
- Main config: `opencode.json` or `opencode.jsonc`

## Hook Events (Verified - hooks.yaml format)
| Event | Description |
|-------|-------------|
| `session.created` | New session created |
| `session.deleted` | Session deleted |
| `session.idle` | Session idle |
| `file.changed` | File modified |
| `tool.before.*` | Before any tool (wildcard) |
| `tool.before.<tool>` | Before specific tool |
| `tool.after.*` | After any tool (wildcard) |
| `tool.after.<tool>` | After specific tool |
| `message.updated` | Message updated |
| `message.part.updated` | Message part updated |

## New Native Hook System (PR #11525 - PascalCase)
| Event | Description |
|-------|-------------|
| `SessionStart` | Session initialized |
| `SessionStop` | Session completes |
| `PreToolUse` | Before tool execution |
| `PostToolUse` | After successful tool execution |
| `PostToolUseFailure` | After tool execution fails |
| `UserPromptSubmit` | User submits prompt |
| `Stop` | Automation loop ends |
| `PermissionRequest` | Before permission dialogs |
| `SubagentStart` | Subagent starts |
| `SubagentStop` | Subagent stops |
| `PreCompact` | Before context compaction |
| `Notification` | Custom notifications |

## Config Format (hooks.yaml)
```yaml
hooks:
  - id: guard-hook
    event: tool.before.bash
    action: stop
    conditions:
      - matchesAnyPath: "**"
    actions:
      - bash: "node $(git rev-parse --show-toplevel)/.opencode/hooks/guard.js bash ${tool_input.command}"

  - id: format-hook
    event: tool.after.write
    conditions:
      - matchesCodeFiles
    actions:
      - bash: "node $(git rev-parse --show-toplevel)/.opencode/hooks/format-on-edit.js write ${tool_input.file_path}"

  - id: done-gate-hook
    event: session.idle
    scope: main
    conditions:
      - matchesAllPaths:
          - package.json
    actions:
      - bash: "node $(git rev-parse --show-toplevel)/.opencode/hooks/done-gate.js"

  - id: session-start-hook
    event: session.created
    actions:
      - bash: "node $(git rev-parse --show-toplevel)/.opencode/hooks/session-start.js"
```

## Native Config Format (opencode.jsonc - PascalCase)
```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "hooks": {
    "PreToolUse": [
      { "name": "guard", "path": "~/.opencode/hooks/guard.js", "enabled": true }
    ],
    "PostToolUse": [
      { "name": "format", "path": "~/.opencode/hooks/format-on-edit.js", "enabled": true }
    ],
    "Stop": [
      { "name": "verify", "path": "~/.opencode/hooks/done-gate.js", "enabled": true }
    ],
    "SessionStart": [
      { "name": "init", "path": "~/.opencode/hooks/session-start.js", "enabled": true }
    ]
  }
}
```

## Input/Output
- **hooks.yaml**: Hook receives event data, runs `bash`/`command`/`tool` actions
- **Native (opencode.jsonc)**: Hook scripts receive JSON on stdin, run in isolated Bun subprocesses
- **Blocking**: `action: stop` on `tool.before.*` hooks blocks execution

## Agent Kit Mapping
| Kit Hook | hooks.yaml Event | Native Event |
|----------|------------------|--------------|
| guard | `tool.before.bash` | `PreToolUse` |
| format-on-edit | `tool.after.write` | `PostToolUse` |
| done-gate | `session.idle` (scope: main) | `Stop` |
| session-start | `session.created` | `SessionStart` |

## Notes
- hooks.yaml requires `opencode-yaml-hooks` plugin in `opencode.json`
- Native hooks (PascalCase) are newer, non-blocking by default
- Each hook runs in sandboxed process with timeout (default 5s)
- Conditions: `matchesCodeFiles`, `matchesAnyPath`, `matchesAllPaths`
- Scope: `all` (default), `main`, `child`
- RunIn: `current` (default), `main`
- Async: `true` for fire-and-forget (bash only, not on tool.before)