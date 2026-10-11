# Harness Adapter: OpenCode

The kit supports **OpenCode V2 (2.x)** natively, and preserves compatibility
with **OpenCode V1 (>= 1.18.29)**. To determine which version you have,
check: `opencode --version`.

Verified against **opencode 2.0.26** on Linux. V1 (1.18.35) remains covered
by the backward-compatible `plugin`/`permission` keys written by `apply.js`;
if behavior differs on a specific V1 version, rely on its own docs.

## What OpenCode V2 actually supports

- **Config**: JSON or JSONC, merged across locations (global, `opencode.json`,
  `.opencode/opencode.json`). Later locations override earlier keys.
- **Plugins**: JS/TS modules auto-discovered from `.opencode/plugins/` and
  `~/.config/opencode/plugins/` (both direct `.js/.ts` files and directories
  containing `index.js` or `index.mjs`), or listed in the `plugins` array of
  `opencode.json`. Direct `.mjs` files are **not** auto-discovered; directories
  may use `index.mjs` as their entrypoint.
- **Plugin hooks**: `ctx.tool.hook("execute.before", ...)` and others, following
  the V2 API (`setup(ctx)` with an object `{ id, setup }` or `Plugin.define`).
- **Permissions**: ordered array `permissions` where `last match wins`, with
  actions `shell` (renamed from V1 `bash`) and `read`/`edit`/`subagent`/`skill` etc.

## Guard: plugin + permission block

The kit uses two layers. Both are emitted by `apply.js`.

### 1. `permissions` array (V2 — preferred)

The hard denies live in the ordered `permissions` array:

```json
"permissions": [
  { "action": "shell", "resource": "*", "effect": "allow" },
  { "action": "shell", "resource": "rm -rf *", "effect": "deny" },
  { "action": "shell", "resource": "git push * --force*", "effect": "deny" },
  { "action": "read", "resource": "*", "effect": "allow" },
  { "action": "read", "resource": "*.env", "effect": "deny" },
  { "action": "read", "resource": "*.pem", "effect": "deny" },
  { "action": "read", "resource": "*.key", "effect": "deny" }
]
```

Last matching rule wins. The kit preserves the exact rule intent and order
when translating the V1 `permission` block.

### 2. Guard plugin (V2) — catches what the rule layer cannot

The guard runs as a V2 plugin: the file `plugins/opencode/agent-kit-guard.mjs`
in the kit exports a plain object `{ id, setup(ctx) }` that registers
`ctx.tool.hook("execute.before", event => ...)`. The core logic lives in
`agent-kit-guard-core.mjs` (shared).

For OpenCode V2, `apply.js` emits `"plugins": ["./.opencode/plugins/agent-kit-guard"]`
(pointing at a **directory**). V2 requires the directory entry and expects
`agent-kit-guard/index.mjs` (the entrypoint). V2 auto-discovers only `.js`/`.ts`
direct files; `.mjs` single files are not auto-discovered. The kit's source layout
currently ships the single file; see "Plugin packaging (V2)" below for the full
arrangement. The guard checks nested shells (`sh -c`), wrappers (`sudo`, `env`),
command substitutions, flag parsing, protected kit paths, and other cases a simple
rule cannot capture. Throwing inside the hook blocks the call.

### 3. Backward compatibility (V1)

`apply.js` also emits the V1 keys (`"plugin": ["./.opencode/plugins/agent-kit-guard.mjs"]` and
`"permission": { bash:{...}, read:{...} }`) so the guard works on V1 (>=1.18.29)
from the same installation files. On V1, the plugin is loaded via the `plugin`
array and calls the V1 `server()` path inside the same default export; the V2
`permissions`/`plugins` keys are ignored by V1. On V2, the V1 keys are read
or ignored per V2's behavior; `permissions`/`plugins` are the source of truth.

## Plugin packaging (V2)

- **Installer emits directory path**: `apply.js` writes
  `"plugins": ["./.opencode/plugins/agent-kit-guard"]` for V2. V2 requires that
  path to be a directory.
- **Outstanding source-layout/install-path change (outside this wave's allowlist)**:
  The kit currently installs the guard as a single file
  `.opencode/plugins/agent-kit-guard.mjs` (per `propose.js`/existing structure).
  For V2 to actually load it without ENOENT, that must become
  `.opencode/plugins/agent-kit-guard/index.mjs` (and the `agent-kit-guard-core.mjs`
  may live inside the directory or stay adjacent — inside is cleaner). This is
  an out-of-allowlist change (a new source directory and the install path), and
  should be coordinated across `propose.js`, `apply.js`/proposal, and the kit's
  file layout. Until then, OpenCode 2.x may log `"failed to load plugin ... ENOENT"`
  for the V2 `plugins` entry even though `permissions`/`skills` are functional;
  the V1 `plugin` entry continues to load from the single-file `.mjs` on V1.
- **Hook event shape**: V2 passes `event.tool` and `event.input` (the arguments);
  the guard accepts both `event.input` and `event.args` as a fallback.

## Known limits

- **Heuristic parsing**: the guard parses shell text heuristically (`python -c`,
  `osascript`, or arbitrary binaries) are not fully checked. It is an advisory
  guardrail, not a sandbox.
- **Hard denies belong in `permissions`**: anything that must never run is best
  encoded as an explicit `deny` rule in the `permissions` array.
- **Self-protection**: an agent that can edit the plugin can disable it. Consider
  a `deny` rule targeting shell access to the guard files if that matters to
  your threat model.
- **Auto-discovery of `.mjs` direct files is not supported by V2**; directories
  may contain `index.mjs`. Use `plugins` array with directory entries (V2) or
  keep the `plugin` file entry (V1) as emitted by `apply.js`.

## done-gate

OpenCode has no hook that can block an agent from finishing a turn. `session.idle`
fires after the turn ends. The kit ships `hooks/done-gate.js` as a standalone
script; run it from CI or a pre-commit hook, not as a lifecycle hook.