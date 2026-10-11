#!/usr/bin/env node
/**
 * Regression tests for GitHub issue #5 — OpenCode V2 integration.
 *
 *   node scripts/tests/issue-5.test.mjs
 *
 * Part 1  the guard core blocks dangerous calls under BOTH the V1 "bash" and
 *         V2 "shell" tool names, and blocks a flag-split `rm -r -f` (the case
 *         the reporter verified sailing through on V2).
 * Part 2  the plugin entrypoint exposes the V2 { id, setup } shape, registers
 *         execute.before, and still exposes the V1 server() shape.
 * Part 3  apply.js emits V2-shaped opencode.json (a "permissions" array with V2
 *         action names, a directory plugin entry, a skills entry) while keeping
 *         the V1 keys that older runtimes and the kit's self-test rely on.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KIT_ROOT = path.resolve(__dirname, "..", "..");

let checks = 0;
let failures = 0;
function check(label, cond, detail) {
  checks++;
  if (cond) {
    console.log(`PASS  ${label}`);
  } else {
    failures++;
    console.log(`FAIL  ${label}${detail ? `\n      ${detail}` : ""}`);
  }
}
function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function main() {
  // ---------------------------------------------------------------- Part 1
  const { checkToolCall } = await import(
    pathToFileURL(path.join(KIT_ROOT, "plugins", "opencode", "agent-kit-guard-core.mjs")).href
  );

  const root = "/repo";
  const blocked = (label, tool, args) => {
    const reason = checkToolCall(root, tool, args);
    check(`blocks  ${label}`, !!reason, reason ? undefined : "guard ALLOWED it");
  };
  const allowed = (label, tool, args) => {
    const reason = checkToolCall(root, tool, args);
    check(`allows  ${label}`, !reason, reason || undefined);
  };

  console.log("--- shell tool name: bash (V1) and shell (V2)");
  // The same destructive commands must be blocked under either tool name; the
  // V2 rename to "shell" is exactly what made these stop firing.
  for (const tool of ["bash", "shell"]) {
    blocked(`rm -rf / [${tool}]`, tool, { command: "rm -rf /" });
    blocked(`rm -fr /etc [${tool}]`, tool, { command: "rm -fr /etc" });
    blocked(`rm -r -f /tmp/x  (flag-split) [${tool}]`, tool, { command: "rm -r -f /tmp/x" });
    blocked(`rm --recursive --force / [${tool}]`, tool, { command: "rm --recursive --force /" });
    blocked(`rm -rf . [${tool}]`, tool, { command: "rm -rf ." });
    blocked(`sudo rm -rf / [${tool}]`, tool, { command: "sudo rm -rf /" });
    blocked(`bash -c "rm -rf /" [${tool}]`, tool, { command: 'bash -c "rm -rf /"' });
    blocked(`echo $(rm -rf /) [${tool}]`, tool, { command: "echo $(rm -rf /)" });
    blocked(`git push -f [${tool}]`, tool, { command: "git push -f origin main" });
    blocked(`git push --force [${tool}]`, tool, { command: "git push --force origin main" });
    blocked(`git push origin +main [${tool}]`, tool, { command: "git push origin +main" });
    blocked(`cat .env [${tool}]`, tool, { command: "cat .env" });
    allowed(`echo hello [${tool}]`, tool, { command: "echo hello" });
    allowed(`rm -f file.txt [${tool}]`, tool, { command: "rm -f file.txt" });
    allowed(`git commit [${tool}]`, tool, { command: 'git commit -m "fix"' });
  }

  console.log("--- file tools: path (V2) and filePath (V1)");
  blocked("read .env via path", "read", { path: ".env" });
  blocked("read .env via filePath", "read", { filePath: ".env" });
  blocked("read .pem via path", "read", { path: "certs/server.pem" });
  blocked("write outside repo via path", "write", { path: "../outside.txt" });
  blocked("edit protected kit path via path", "edit", { path: ".agent-kit/config.json" });
  blocked("write opencode.json via path", "patch", { path: "opencode.json" });
  allowed("read normal file via path", "read", { path: "src/app.js" });
  allowed("write normal file via path", "write", { path: "src/app.js" });
  allowed("unknown tool passes through", "someOtherTool", { path: ".env" });

  // ---------------------------------------------------------------- Part 2
  console.log("--- plugin entrypoint shape (V2 setup + V1 server)");
  const guard = (await import(
    pathToFileURL(path.join(KIT_ROOT, "plugins", "opencode", "agent-kit-guard.mjs")).href
  )).default;

  check("default export carries a stable V2 id", guard && guard.id === "agent-kit-guard");
  check("default export exposes V2 setup(ctx)", typeof guard.setup === "function");
  check("default export exposes V1 server()", typeof guard.server === "function");

  let registration = null;
  const fakeCtx = {
    location: { directory: "/repo" },
    tool: {
      hook: async (name, fn) => {
        registration = { name, fn };
        return { dispose() {} };
      },
    },
  };
  await guard.setup(fakeCtx);
  check(
    "setup registers the execute.before hook",
    registration && registration.name === "execute.before",
    registration ? registration.name : "nothing registered",
  );

  const hookBlocks = (fn, event) => {
    try {
      fn(event);
      return false;
    } catch {
      return true;
    }
  };
  check(
    "V2 execute.before blocks flag-split rm under 'shell'",
    hookBlocks(registration.fn, { tool: "shell", input: { command: "rm -r -f /tmp/x" } }),
  );
  check(
    "V2 execute.before allows a safe shell command",
    !hookBlocks(registration.fn, { tool: "shell", input: { command: "echo hi" } }),
  );

  const v1Hooks = await guard.server();
  check(
    "server() returns the V1 tool.execute.before hook",
    typeof v1Hooks["tool.execute.before"] === "function",
  );
  let v1Threw = false;
  try {
    await v1Hooks["tool.execute.before"]({ tool: "bash" }, { args: { command: "rm -rf /" } });
  } catch {
    v1Threw = true;
  }
  check("V1 server() hook still blocks rm -rf under 'bash'", v1Threw);

  // ---------------------------------------------------------------- Part 3
  console.log("--- apply.js emits V2-shaped opencode.json");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "issue5-"));
  try {
    const target = path.join(tmp, "repo");
    fs.mkdirSync(target, { recursive: true });
    // A git repo keeps apply.js's clean-tree preflight quiet; --allow-dirty
    // below still covers environments without git.
    try {
      execFileSync("git", ["init", "-q"], { cwd: target, stdio: "ignore" });
    } catch {}
    fs.writeFileSync(
      path.join(target, "opencode.json"),
      JSON.stringify({ $schema: "https://opencode.ai/config.json", model: "x/y" }, null, 2) + "\n",
    );

    // Exactly the V1 permission object propose.js builds today.
    const v1Permission = {
      bash: {
        "*": "allow",
        "rm -rf *": "deny",
        "rm -fr *": "deny",
        "git push * --force*": "deny",
        "git push -f*": "deny",
        "git push * -f*": "deny",
        "git push * +*": "deny",
        "npm publish*": "ask",
        "yarn publish*": "ask",
        "pnpm publish*": "ask",
        "cat .env*": "deny",
        "cat *.pem": "deny",
        "cat *.key": "deny",
      },
      read: {
        "*": "allow",
        "*.env": "deny",
        "*.env.*": "deny",
        "*.pem": "deny",
        "*.key": "deny",
      },
    };

    const body = {
      version: 1,
      target,
      harness: "opencode",
      os: "linux",
      skills: ["debugging"],
      hooks: ["guard"],
      mcpServers: [],
      verifyCommand: null,
      detectedCommands: {},
      formatters: {},
      permission: v1Permission,
      plugins: ["./.opencode/plugins/agent-kit-guard.mjs"],
      files: [{ path: "opencode.json", action: "merge" }],
      notes: [],
    };
    const proposalPath = path.join(tmp, "proposal.json");
    fs.writeFileSync(
      proposalPath,
      JSON.stringify({ ...body, hash: sha256(Buffer.from(JSON.stringify(body))) }, null, 2),
    );

    const stdout = execFileSync(
      process.execPath,
      [path.join(KIT_ROOT, "scripts", "apply.js"), "--target", target, "--proposal", proposalPath, "--allow-dirty"],
      { encoding: "utf8" },
    );

    const emitted = JSON.parse(fs.readFileSync(path.join(target, "opencode.json"), "utf8"));

    // The expected V2 translation: ordered array, "bash" -> "shell", same order.
    const expectedPermissions = [];
    for (const [tool, rules] of Object.entries(v1Permission)) {
      const action = tool === "bash" ? "shell" : tool;
      for (const [resource, effect] of Object.entries(rules)) {
        expectedPermissions.push({ action, resource, effect });
      }
    }

    check("emits a V2 permissions array", Array.isArray(emitted.permissions), typeof emitted.permissions);
    check(
      "permissions equals the V1 rules translated to V2 (order + actions + effects)",
      JSON.stringify(emitted.permissions) === JSON.stringify(expectedPermissions),
      `got      ${JSON.stringify(emitted.permissions)}`,
    );
    check(
      "no permission rule uses an action or key other than {action,resource,effect}",
      (emitted.permissions || []).every(
        r =>
          r &&
          typeof r === "object" &&
          Object.keys(r).sort().join(",") === "action,effect,resource" &&
          ["action", "resource", "effect"].every(k => typeof r[k] === "string"),
      ),
    );
    check(
      "V1 'bash' action does not leak into permissions",
      !(emitted.permissions || []).some(r => r.action === "bash" || "bash" in r || "read" in r),
    );
    check(
      "shell catch-all allow precedes the rm -rf deny (last match wins)",
      (emitted.permissions || []).findIndex(r => r.action === "shell" && r.resource === "*" && r.effect === "allow") !== -1 &&
        (emitted.permissions || []).findIndex(r => r.action === "shell" && r.resource === "*" && r.effect === "allow") <
          (emitted.permissions || []).findIndex(r => r.action === "shell" && r.resource === "rm -rf *" && r.effect === "deny"),
    );
    check(
      "every hard deny survives the translation",
      expectedPermissions.filter(r => r.effect === "deny").every(r =>
        (emitted.permissions || []).some(x => x.action === r.action && x.resource === r.resource && x.effect === "deny"),
      ),
    );

    check(
      "emits a V2 directory plugin entry",
      Array.isArray(emitted.plugins) && emitted.plugins.includes("./.opencode/plugins/agent-kit-guard"),
      JSON.stringify(emitted.plugins),
    );
    check(
      "V2 plugin entries are directories, not files",
      (emitted.plugins || []).every(p => !(typeof p === "string" && /\.(mjs|cjs|js|ts)$/.test(p))),
      JSON.stringify(emitted.plugins),
    );
    check(
      "emits the skills directory for V2 discovery",
      Array.isArray(emitted.skills) && emitted.skills.includes("./.agent-kit/skills"),
      JSON.stringify(emitted.skills),
    );

    // V1 keys are retained so V1 (and the shared self-test) keep working.
    check(
      "keeps the V1 plugin entry",
      Array.isArray(emitted.plugin) && emitted.plugin.includes("./.opencode/plugins/agent-kit-guard.mjs"),
      JSON.stringify(emitted.plugin),
    );
    check(
      "keeps the V1 permission block",
      !!(emitted.permission && emitted.permission.bash && emitted.permission.read),
    );
    check("preserves unrelated user config", emitted.model === "x/y");
    check("log no longer claims registration only in \"plugin\"", /V2/.test(stdout), stdout.slice(0, 200));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures) {
    console.log(`${failures} FAILURES`);
    process.exit(1);
  }
  console.log("issue-5: ALL CHECKS PASSED");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
