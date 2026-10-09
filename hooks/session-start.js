#!/usr/bin/env node
/**
 * Session-Start Hook - Prints git status and repo summary
 * Event: session-start (optional, off by default)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = process.env.GIT_ROOT || process.cwd();

function run(cmd, silent = false) {
  try {
    return execSync(cmd, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: silent ? 'pipe' : 'inherit',
      shell: true,
    }).trim();
  } catch {
    return null;
  }
}

function main() {
  console.log('\n=== AGENT KIT SESSION START ===\n');
  
  // Git status
  const gitStatus = run('git status --short', true);
  if (gitStatus) {
    console.log('Git status:');
    console.log(gitStatus || '(clean)');
    console.log('');
  }
  
  // Current branch
  const branch = run('git branch --show-current', true);
  if (branch) {
    console.log(`Branch: ${branch}`);
  }
  
  // Recent commits
  const log = run('git log --oneline -5', true);
  if (log) {
    console.log('\nRecent commits:');
    console.log(log);
  }
  
  // Repo summary
  const pkgPath = path.join(REPO_ROOT, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      console.log(`\nProject: ${pkg.name || 'unknown'} v${pkg.version || '0.0.0'}`);
      if (pkg.description) console.log(`Description: ${pkg.description}`);
    } catch {}
  }
  
  // Kit config
  const kitConfigPath = path.join(REPO_ROOT, '.agent-kit', 'config.json');
  if (fs.existsSync(kitConfigPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(kitConfigPath, 'utf8'));
      console.log('\nKit config:');
      console.log(`  Harness: ${config.harness || 'generic'}`);
      console.log(`  Hooks: guard=${config.hooks?.guard}, format=${config.hooks?.format_on_edit}, done-gate=${config.hooks?.done_gate}`);
      console.log(`  Skills: ${config.profiles?.join(', ') || 'none'}`);
    } catch {}
  }
  
  console.log('\n=== READY ===\n');
}

main();