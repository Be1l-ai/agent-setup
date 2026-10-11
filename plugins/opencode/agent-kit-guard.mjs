// Agent Kit guard for OpenCode. Installed by apply into .opencode/plugins/.
// Throwing inside "tool.execute.before" blocks the tool call (verified against
// opencode 1.18.35). Logic lives in ./guard-core.mjs, copied alongside this file.
// Advisory guardrail: pair with the "permission" block in opencode.json for hard denies.

import path from "node:path";
import { checkToolCall } from "./agent-kit-guard-core.mjs";

export const AgentKitGuard = async ({ worktree, directory }) => {
  const root = worktree || directory || process.cwd();
  return {
    "tool.execute.before": async (input, output) => {
      const reason = checkToolCall(path.resolve(root), input.tool, output.args || {});
      if (reason) throw new Error(`AGENT-KIT GUARD BLOCKED: ${reason}`);
    },
  };
};
