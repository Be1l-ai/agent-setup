#!/usr/bin/env node
/**
 * Done-gate hook: blocks "done" until the repo's verify command passes.
 *
 * Reads the verify command from .agent-kit/verify-config.json (written by apply).
 * Fails CLOSED: no verify command = exit 1. No retry counter and no state file.
 * Exit 0 = verify passed, 1 = blocked.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = process.env.GIT_ROOT ? path.resolve(process.env.GIT_ROOT) : process.cwd();
const CONFIG = path.join(ROOT, '.agent-kit', 'verify-config.json');

let verifyCommand = null;
try {
  verifyCommand = JSON.parse(fs.readFileSync(CONFIG, 'utf8')).verifyCommand || null;
} catch {}

if (!verifyCommand) {
  console.error('DONE-GATE BLOCKED: no verifyCommand in .agent-kit/verify-config.json. Set one to proceed.');
  process.exit(1);
}

console.log(`DONE-GATE: running: ${verifyCommand}`);
const result = spawnSync(verifyCommand, { cwd: ROOT, shell: true, stdio: 'inherit', timeout: 120000 });

if (result.error || result.status !== 0) {
  console.error('DONE-GATE BLOCKED: verify failed. Fix the failures above, then try again.');
  process.exit(1);
}

console.log('DONE-GATE: verify passed.');
process.exit(0);
