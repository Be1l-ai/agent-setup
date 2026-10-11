#!/usr/bin/env node
/**
 * Regression test for issue #1.
 *
 * recon.js's glob() passed patterns to `find -name`, which only matches
 * basenames — so every path-qualified pattern (".github/workflows/*.yml",
 * ".claude/**", ".opencode/**", ...) silently matched nothing. CI detection
 * reported "none" for GitHub Actions repos and agent files went undetected.
 *
 *   node scripts/tests/issue-1.test.mjs
 *
 * Builds a throwaway fixture repo and asserts recon now detects
 * "github-actions" and the nested agent files, while still pruning
 * node_modules and keeping basename-glob behavior intact.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RECON = fileURLToPath(new URL('../recon.js', import.meta.url));

let checks = 0;
let failures = 0;

function ok(label) {
  checks++;
  console.log(`PASS  ${label}`);
}
function bad(label, detail) {
  checks++;
  failures++;
  console.log(`FAIL  ${label}${detail ? `\n      ${detail}` : ''}`);
}
function check(label, condition, detail) {
  condition ? ok(label) : bad(label, detail);
}

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function makeFixture(dir) {
  write(path.join(dir, 'package.json'), JSON.stringify({
    name: 'issue1-fixture', version: '1.0.0',
    scripts: { test: 'node -e "process.exit(0)"', lint: 'node -e "process.exit(0)"' },
  }, null, 2) + '\n');
  // Lock file so packageManager resolves to something clean ('npm').
  write(path.join(dir, 'package-lock.json'), '{"name":"issue1-fixture","lockfileVersion":3}\n');
  write(path.join(dir, 'AGENTS.md'), '# Fixture\n');
  // The patterns that used to be dead code under `find -name`.
  write(path.join(dir, '.github/workflows/ci.yml'), 'name: CI\non: push\n');
  write(path.join(dir, '.claude/settings.json'), '{}\n');
  write(path.join(dir, '.opencode/config.json'), '{}\n');
  // Must be pruned from the language scan.
  write(path.join(dir, 'node_modules/dummy.js'), '// must be pruned\n');
}

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'recon-issue1-'));
  const repo = path.join(tmp, 'repo');
  const output = path.join(tmp, 'recon.json');

  console.log(`workspace: ${tmp}\n`);
  makeFixture(repo);
  run(process.execPath, [RECON, '--target', repo, '--output', output]);
  check('recon writes a report', fs.existsSync(output));
  const report = JSON.parse(fs.readFileSync(output, 'utf8'));

  console.log('--- CI detection');
  check('detects GitHub Actions', report.ci === 'github-actions', `got "${report.ci}"`);

  console.log('--- agent file detection');
  const expected = ['AGENTS.md', '.claude/settings.json', '.opencode/config.json'];
  const sorted = [...report.existingAgentFiles].sort();
  const sortedExpected = [...expected].sort();
  check('finds path-qualified agent files',
    JSON.stringify(sorted) === JSON.stringify(sortedExpected), `got ${JSON.stringify(sorted)}`);
  check('still finds basename agent files', report.existingAgentFiles.includes('AGENTS.md'));

  console.log('--- basename/root checks still work (no regression)');
  check('packageManager from lock file', report.packageManager === 'npm', `got "${report.packageManager}"`);
  check('commands from package.json scripts', report.commands.test === 'npm run test',
    `got "${report.commands.test}"`);
  check('hasNode', report.hasNode === true);

  console.log('--- pruning still works');
  check('node_modules is pruned from language scan', !report.languages.includes('javascript'),
    `languages = ${JSON.stringify(report.languages)}`);

  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures) {
    console.log(`${failures} FAILURES`);
    process.exit(1);
  }
  console.log('ALL CHECKS PASSED');
}

main();