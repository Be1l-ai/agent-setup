#!/usr/bin/env node
/**
 * Verify Script - Runs repo's test/lint/typecheck commands
 * Usage: node verify.js --target <path> --phase <before|after> --commands <json> [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const targetIdx = args.indexOf('--target');
const phaseIdx = args.indexOf('--phase');
const commandsIdx = args.indexOf('--commands');
const target = targetIdx >= 0 ? args[targetIdx + 1] : process.cwd();
const phase = phaseIdx >= 0 ? args[phaseIdx + 1] : 'after';
const commandsArg = commandsIdx >= 0 ? args[commandsIdx + 1] : null;

function run(cmd, cwd = target) {
  try {
    execSync(cmd, { cwd, stdio: 'inherit', shell: true, timeout: 120000 });
    return { success: true, cmd };
  } catch (e) {
    return { success: false, cmd, error: e.message };
  }
}

function parseCommands(arg) {
  if (!arg) return {};
  try {
    return JSON.parse(arg);
  } catch {
    return {};
  }
}

function main() {
  console.log(`[verify] Phase: ${phase}`);
  console.log(`[verify] Target: ${target}`);

  const commands = parseCommands(commandsArg);
  if (Object.keys(commands).length === 0) {
    console.log('[verify] No commands to run');
    process.exit(0);
  }

  const results = {};
  for (const [name, cmd] of Object.entries(commands)) {
    console.log(`[verify] Running ${name}: ${cmd}`);
    if (dryRun) {
      results[name] = { success: true, cmd, dryRun: true };
      continue;
    }
    results[name] = run(cmd);
  }

  const passed = Object.values(results).filter(r => r.success).length;
  const total = Object.keys(results).length;

  console.log(`\n[verify] Results: ${passed}/${total} passed`);
  for (const [name, result] of Object.entries(results)) {
    const status = result.success ? '✓' : '✗';
    console.log(`  ${status} ${name}: ${result.cmd}`);
    if (!result.success && result.error) {
      console.log(`      Error: ${result.error}`);
    }
  }

  // Write results for comparison
  const resultsFile = path.join(target, '.agent-kit', `verify-${phase}.json`);
  if (!dryRun) {
    fs.mkdirSync(path.dirname(resultsFile), { recursive: true });
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  }

  if (passed < total) {
    console.log(`\n[verify] FAILED: ${total - passed} command(s) failed`);
    process.exit(1);
  }

  console.log('\n[verify] All checks passed');
  process.exit(0);
}

main();