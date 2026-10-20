// Agent Kit guard for OpenCode.
//
// One file runs on both OpenCode majors:
//   * V2 (2.x) loads the plugin as a directory -- .opencode/plugins/agent-kit-guard/
//     with this file as index.mjs -- and calls the default export's setup(ctx).
//     Hooks are registered per domain: ctx.tool.hook("execute.before", event => ...),
//     where event.tool is the tool name and event.input is its arguments.
//   * V1 (>= 1.18.29) loads this file from the "plugin" array and calls the default
//     export's server() method, which returns the V1 "tool.execute.before" hook.
//
// We deliberately do NOT import { Plugin } from "@opencode/plugin": the kit is
// zero-dependency, and OpenCode v2.0.26 accepts a plain object with { id, setup }
// (verified live). If a future V2 requires the branded form, wrap the default
// export below with Plugin.define(...) -- this is the only place that changes.
//
// Throwing inside the hook blocks the tool call. This is an advisory guardrail:
// pair it with the hard "permissions" denies the kit writes into opencode.json.

import path from "node:path";
import { checkToolCall } from "./agent-kit-guard-core.mjs";

// V2 exposes the location at ctx.location.directory; V1 passed { worktree, directory }.
function guardRoot(ctx) {
  if (ctx && ctx.location && ctx.location.directory) return ctx.location.directory;
  if (ctx && (ctx.worktree || ctx.directory)) return ctx.worktree || ctx.directory;
  return process.cwd();
}

// Returns nothing when allowed; throws (blocking the call) when denied.
function evaluate(root, tool, args) {
  const reason = checkToolCall(path.resolve(root), tool, args || {});
  if (reason) throw new Error(`AGENT-KIT GUARD BLOCKED: ${reason}`);
}

export default {
  id: "agent-kit-guard",

  // OpenCode V2 entrypoint.
  async setup(ctx) {
    const root = guardRoot(ctx);
    await ctx.tool.hook("execute.before", (event) => {
      evaluate(root, event.tool, event.input ?? event.args);
    });
  },

  // OpenCode V1 (>= 1.18.29) entrypoint. The V2 runtime ignores this method.
  async server() {
    return {
      "tool.execute.before": async (input, output) => {
        evaluate(guardRoot(input), input.tool, output && output.args);
      },
    };
  },
};
