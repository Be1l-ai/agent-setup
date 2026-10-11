# Harness Adapter: OpenCode

Verified against **opencode 1.18.35** on Linux by running the CLI. Anything not
verified here is marked UNVERIFIED.

## What OpenCode actually supports

- **Config**: JSON or JSONC, merged across locations (global, `OPENCODE_CONFIG`,
  project `opencode.json`, `.opencode/` dirs). Later locations override earlier keys.
- **Plugins**: JS/TS modules loaded from `.opencode/plugins/` or
  `~/.config/opencode/plugins/`, or listed in the `plugin` array of `opencode.json`.
- **Plugin hooks**: `tool.execute.before`, `tool.execute.after`, `event`,
  `permission.ask`, `shell.env`, and experimental hooks.
- **Permissions**: `allow` / `ask` / `deny` per tool, with per-command patterns for `bash`.

## Guard: plugin + permission block

The kit uses both layers, and this is deliberate.

**1. `permission` block** (in `opencode.json`) — hard denies enforced by the harness
before the tool runs. The agent cannot bypass these with shell tricks.

```json
"permission": {
  "bash": { "*": "allow", "rm -rf *": "deny", "git push * --force*": "deny" },
  "read": { "*": "allow", "*.env": "deny", "*.pem": "deny" }
}
```

Last matching rule wins, so put `"*"` first. Verified: `rm victim.txt` under
`"rm *": "deny"` was blocked and the file survived.

**2. Guard plugin** — everything the pattern layer cannot express (flag parsing,
`sh -c`, `sudo`, `$(...)`, `+refspec`, protected paths).

Installed to `.opencode/plugins/agent-kit-guard.mjs` with the shared logic in
`agent-kit-guard-core.mjs`, and **registered in `opencode.json`**:

```json
"plugin": ["./.opencode/plugins/agent-kit-guard.mjs"]
```

> Registration is required. Auto-discovery of `.opencode/plugins/` did **not** load
> plugins in 1.18.35 during testing; an explicit `plugin` entry did. Do not drop it.

Throwing inside `tool.execute.before` blocks the call. Verified: `rm -rf canary.txt .`
returned `AGENT-KIT GUARD BLOCKED: rm of whole repo blocked: .` and the file survived.

Plugin signature:

```js
"tool.execute.before": async (input, output) => {
  input.tool;      // "bash" | "read" | "write" | "edit" | ...
  output.args;     // { command } | { filePath } | ...
}
```

Tool names are OpenCode's, not generic: the file tools use `filePath` (camelCase),
not `file_path`. The core accepts either.

## Known limits

- The guard parses shell text heuristically. Anything it cannot parse
  (`python -c`, `osascript`, a custom binary) is not checked. It is a guardrail
  against accidents, not a sandbox.
- The `permission` block is the reliable layer. Prefer adding a rule there for
  anything that must never run.
- Guard rules for the user's own files (e.g. `.agent-kit/`) are enforced by the
  plugin. An agent that edits the plugin can disable the plugin. Protect it with
  a `permission` deny on `bash` for `*agent-kit-guard*` if that matters to you.

## done-gate

OpenCode has no hook that can block the agent from finishing a turn. `session.idle`
fires after the turn ends. The kit ships `hooks/done-gate.js` as a standalone
script; run it from CI or a pre-commit hook, not as a lifecycle hook.