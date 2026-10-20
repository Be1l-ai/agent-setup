#!/usr/bin/env node
/**
 * End-to-end self test. Builds a throwaway git repo, applies the kit, removes it,
 * and compares hashes against the baseline.
 *
 *   node scripts/self-test.js
 *
 * Covers the cases that broke before: hook/plugin naming, backups, rollback,
 * idempotent re-apply, refusal on a dirty tree, refusal on invalid JSON, and
 * preserving user files that live under .agent-kit/.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const KIT_ROOT = path.resolve(__dirname, '..');
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
function kit(args, opts = {}) {
  return run(process.execPath, [path.join(KIT_ROOT, 'scripts', args[0]), ...args.slice(1)], opts);
}

function hashTree(root) {
  const out = [];
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === '.git') continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else {
        const rel = path.relative(root, abs).split(path.sep).join('/');
        const h = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
        out.push(`${h}  ${rel}`);
      }
    }
  };
  walk(root);
  return out.sort().join('\n');
}

function makeFixture(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: 'fixture', version: '1.0.0',
    scripts: { test: 'node -e "process.exit(0)"', lint: 'node -e "process.exit(0)"' },
  }, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Fixture\n\nUser content.\n');
  fs.writeFileSync(path.join(dir, '.mcp.json'), '{\n  "mcpServers": { "userthing": { "command": "x" } }\n}\n');
  fs.writeFileSync(path.join(dir, 'opencode.json'), JSON.stringify({
    $schema: 'https://opencode.ai/config.json', model: 'x/y',
  }, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'index.js'), 'console.log(1)\n');
  run('git', ['init', '-q'], { cwd: dir });
  run('git', ['config', 'user.email', 't@example.com'], { cwd: dir });
  run('git', ['config', 'user.name', 'Test'], { cwd: dir });
  run('git', ['add', '-A'], { cwd: dir });
  run('git', ['commit', '-qm', 'init'], { cwd: dir });
}

// spawnSync (not execFileSync) so we can assert on stdout for passing runs too.
function kitAttempt(args, opts = {}) {
  const spawn = require('child_process').spawnSync;
  const r = spawn(process.execPath, [path.join(KIT_ROOT, 'scripts', args[0]), ...args.slice(1)], {
    encoding: 'utf8', ...opts,
  });
  return { ok: r.status === 0, output: (r.stdout || '') + (r.stderr || ''), status: r.status };
}

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-kit-selftest-'));
  const repo = path.join(tmp, 'repo');
  const recon = path.join(tmp, 'recon.json');
  const proposal = path.join(tmp, 'proposal.json');

  console.log(`workspace: ${tmp}\n`);
  makeFixture(repo);
  const baseline = hashTree(repo);

  console.log('--- recon and propose');
  kit(['recon.js', '--target', repo, '--output', recon]);
  check('recon writes a report', fs.existsSync(recon));
  kit(['propose.js', '--recon', recon, '--config', path.join(KIT_ROOT, 'kit.config.json'), '--output', proposal]);
  const prop = JSON.parse(fs.readFileSync(proposal, 'utf8'));
  check('proposal names the guard plugin', prop.plugins.includes('./.opencode/plugins/agent-kit-guard.mjs'));
  check('proposal hash is stable', typeof prop.hash === 'string' && prop.hash.length === 64);

  console.log('--- preflight refuses bad input');
  fs.appendFileSync(path.join(repo, 'index.js'), '// dirty\n');
  check('refuses a dirty tree', !kitAttempt(['apply.js', '--target', repo, '--proposal', proposal]).ok);
  run('git', ['checkout', '--', 'index.js'], { cwd: repo });

  const backup = fs.readFileSync(path.join(repo, 'opencode.json'), 'utf8');
  fs.writeFileSync(path.join(repo, 'opencode.json'), '{ not json');
  run('git', ['commit', '-qam', 'bad json'], { cwd: repo });
  check('refuses an invalid opencode.json', !kitAttempt(['apply.js', '--target', repo, '--proposal', proposal]).ok);
  check('leaves the invalid file untouched', fs.readFileSync(path.join(repo, 'opencode.json'), 'utf8') === '{ not json');
  check('leaves no .agent-kit behind after refusal', !fs.existsSync(path.join(repo, '.agent-kit')));
  fs.writeFileSync(path.join(repo, 'opencode.json'), backup);
  run('git', ['commit', '-qam', 'restore'], { cwd: repo });

  console.log('--- apply');
  check('dry run makes no changes', kitAttempt(['apply.js', '--target', repo, '--proposal', proposal, '--dry-run']).ok
    && hashTree(repo) === baseline);
  check('apply succeeds', kitAttempt(['apply.js', '--target', repo, '--proposal', proposal]).ok);
  check('installed the guard plugin (V1 file)', fs.existsSync(path.join(repo, '.opencode', 'plugins', 'agent-kit-guard.mjs')));
  check('installed the guard core (V1 file)', fs.existsSync(path.join(repo, '.opencode', 'plugins', 'agent-kit-guard-core.mjs')));
  check('installed the guard plugin directory (V2)', fs.existsSync(path.join(repo, '.opencode', 'plugins', 'agent-kit-guard', 'index.mjs')));
  check('installed the guard core (V2 dir)', fs.existsSync(path.join(repo, '.opencode', 'plugins', 'agent-kit-guard', 'agent-kit-guard-core.mjs')));
  const oc = JSON.parse(fs.readFileSync(path.join(repo, 'opencode.json'), 'utf8'));
  check('registered the plugin (V1)', oc.plugin.includes('./.opencode/plugins/agent-kit-guard.mjs'));
  check('registered the plugin (V2 dir)', Array.isArray(oc.plugins) && oc.plugins.includes('./.opencode/plugins/agent-kit-guard'));
  check('merged a permission block (V1)', !!oc.permission && !!oc.permission.bash && !!oc.permission.read);
  check('merged a permissions array (V2)', Array.isArray(oc.permissions) && oc.permissions.length > 0);
  check('kept the user model setting', oc.model === 'x/y');
  check('filled the AGENTS.md commands block',
    /commands:start[\s\S]*test:/.test(fs.readFileSync(path.join(repo, 'AGENTS.md'), 'utf8')));
  check('kept user MCP servers', !!JSON.parse(fs.readFileSync(path.join(repo, '.mcp.json'), 'utf8')).mcpServers.userthing);

  console.log('--- idempotency');
  const r2 = kitAttempt(['apply.js', '--target', repo, '--proposal', proposal]);
  check('re-apply is a no-op', r2.ok && /Nothing to do/.test(r2.output));

  console.log('--- remove protects edited files');
  fs.appendFileSync(path.join(repo, '.opencode', 'plugins', 'agent-kit-guard-core.mjs'), '// user edit\n');
  fs.appendFileSync(path.join(repo, '.opencode', 'plugins', 'agent-kit-guard', 'agent-kit-guard-core.mjs'), '// user edit\n');
  check('refuses to remove edited kit files', !kitAttempt(['remove.js', '--target', repo]).ok);
  check('--ignore-hash forces it', kitAttempt(['remove.js', '--target', repo, '--ignore-hash']).ok);

  console.log('--- user files under .agent-kit survive');
  kit(['apply.js', '--target', repo, '--proposal', proposal]);
  fs.writeFileSync(path.join(repo, '.agent-kit', 'approvals.json'), '{"user":true}\n');
  check('remove succeeds', kitAttempt(['remove.js', '--target', repo]).ok);
  check('kept the unrecorded user file', fs.existsSync(path.join(repo, '.agent-kit', 'approvals.json')));
  fs.rmSync(path.join(repo, '.agent-kit'), { recursive: true, force: true });
  run('git', ['reset', '-q', '--hard', 'HEAD'], { cwd: repo });
  run('git', ['clean', '-qfdx'], { cwd: repo });

  console.log('--- rollback on mid-apply failure');
  fs.mkdirSync(path.join(repo, '.opencode', 'plugins', 'agent-kit-guard-core.mjs'), { recursive: true });
  fs.mkdirSync(path.join(repo, '.opencode', 'plugins', 'agent-kit-guard', 'agent-kit-guard-core.mjs'), { recursive: true });
  check('failed apply exits non-zero', !kitAttempt(['apply.js', '--target', repo, '--proposal', proposal, '--overwrite']).ok);
  check('rollback removed .agent-kit', !fs.existsSync(path.join(repo, '.agent-kit')));
  const status = run('git', ['status', '--porcelain'], { cwd: repo })
    .split('\n').filter(Boolean).filter(l => !l.startsWith('?? .opencode/'));
  check('rollback left git clean', status.length === 0, status.join('; '));
  fs.rmSync(path.join(repo, '.opencode'), { recursive: true, force: true });
  run('git', ['clean', '-qfdx'], { cwd: repo });

  console.log('--- round trip restores the repo exactly');
  kit(['apply.js', '--target', repo, '--proposal', proposal]);
  kit(['remove.js', '--target', repo]);
  check('tree is byte-identical to baseline', hashTree(repo) === baseline);
  check('git status is clean', run('git', ['status', '--porcelain'], { cwd: repo }).trim() === '');

  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures) {
    console.log(`${failures} FAILURES`);
    process.exit(1);
  }
  console.log('ALL CHECKS PASSED');
}

main();