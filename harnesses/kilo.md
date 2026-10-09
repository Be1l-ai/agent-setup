# Harness Adapter: kilo

## Source
- **Official Docs**: https://kilo.ai/docs/automate/extending/plugins
- **Config Schema**: https://github.com/Kilo-Org/kilocode/blob/main/packages/kilo-docs/pages/contributing/architecture/config-schema.md
- **Plugin API**: https://github.com/Kilo-Org/kilocode/blob/main/packages/plugin/src/index.ts
- **Verified**: 2026-10-09

## Config Location
- Project: `kilo.jsonc` (root) or `.kilo/kilo.jsonc`
- Global: `~/.config/kilo/kilo.jsonc` (Windows: `C:\Users\<user>\.config\kilo\kilo.jsonc`)

## Hook System
kilo does **not** have a traditional file-based hook system like Codex/Cline. Instead, it uses **TypeScript plugins** that register hook handlers.

## Plugin Hooks (Verified from packages/plugin/src/index.ts)
| Hook | Description | Can Block? |
|------|-------------|------------|
| `event` | Observes all Bus events | No |
| `config` | Called after config resolved | No |
| `tool` | Defines custom tools | N/A |
| `auth` | Register auth methods | N/A |
| `provider` | Register AI provider models | N/A |
| `chat.message` | Incoming message interception | Yes (modify message) |
| `chat.params` | Modify LLM parameters | Yes |
| `chat.headers` | Modify HTTP headers | Yes |
| `permission.ask` | Intercept tool permission requests | Yes (deny/allow/ask) |
| `command.execute.before` | Before command execution | Yes (modify args) |
| `command.execute.after` | After command execution | No |
| `tool.execute.before` | Before tool execution | Yes (modify args) |
| `tool.execute.after` | After tool execution | No |
| `shell.env` | Inject env vars into shell commands | Yes |
| `experimental.chat.messages.transform` | Rewrite message history | Yes |
| `experimental.chat.system.transform` | Modify system prompt | Yes |
| `experimental.session.compacting` | Customize compaction prompt | Yes |
| `experimental.compaction.autocontinue` | Disable auto-continue after compaction | Yes |
| `experimental.text.complete` | Post-process final text | Yes |
| `tool.definition` | Modify tool definitions sent to LLM | Yes |

## Plugin Structure
```typescript
// .kilo/plugins/agent-kit-hooks.ts
import type { Plugin } from "@kilocode/plugin";

const AgentKitPlugin: Plugin = async ({ client, project, directory, $ }) => ({
  "permission.ask": async (input, output) => {
    // Guard: block dangerous operations
    const tool = input.permission?.tool;
    if (tool === "bash" && /rm\s+-rf|git\s+push.*--force/.test(input.permission?.args?.command || "")) {
      output.status = "deny";
    }
  },
  "tool.execute.before": async (input, output) => {
    // Guard: check tool args
    if (input.tool === "read_file" && /\.(env|pem|key)$/.test(input.args?.path || "")) {
      throw new Error("Reading credential files blocked");
    }
  },
  "tool.execute.after": async (input, output) => {
    // Format-on-edit: run formatter after write/edit
    if (["write_file", "edit_file"].includes(input.tool)) {
      const formatter = getFormatterForFile(input.args?.path);
      if (formatter) await $.`${formatter} ${input.args.path}`.quiet();
    }
  },
  "experimental.session.compacting": async (input, output) => {
    // Done-gate: run verify before compaction (proxy for completion)
    const result = await $.`npm run check`.quiet();
    if (result.exitCode !== 0) {
      output.context = ["VERIFY FAILED - Fix before continuing"];
    }
  },
});

export default { id: "agent-kit-hooks", server: AgentKitPlugin };
```

## Config to Enable Plugin
```jsonc
// kilo.jsonc
{
  "$schema": "https://app.kilo.ai/config.json",
  "plugin": [
    "./.kilo/plugins/agent-kit-hooks.ts"
  ]
}
```

## Agent Kit Mapping
| Kit Hook | kilo Plugin Hook |
|----------|------------------|
| guard | `permission.ask` + `tool.execute.before` |
| format-on-edit | `tool.execute.after` |
| done-gate | `experimental.session.compacting` (proxy) |
| session-start | `config` (at startup) |

## Notes
- **No file-based hooks** - must write TypeScript plugin
- Plugins loaded from `plugin` array in config
- Local plugins: `./path/plugin.ts` or `file:///abs/path/plugin.ts`
- npm plugins: `"pkg@version"` or `["pkg@version", { options }]`
- Plugin hooks run in order, can mutate `output` object
- No timeout configuration (async/await with Effect)
- Marketplace installs plugins to `.kilo/opencode.json` or `.kilo/tui.json`
- `config` hook runs once at startup (good for session-start)
- `event` hook receives all Bus events (SessionStarted, ToolExecuted, etc.)
- **UNVERIFIED**: Exact event names for session-start equivalent

## Fallback
Since kilo lacks native file hooks, use:
1. Git pre-commit hook (runs guard checks + format + verify)
2. CI job (runs full verify on push/PR)
3. Plugin as above for in-session checks