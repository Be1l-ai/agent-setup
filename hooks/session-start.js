#!/usr/bin/env node
/**
 * Session-start hook: prints git status and the kit config. Read-only. Always exits 0.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = process.env.GIT_ROOT ? path.resolve(process.env.GIT_ROOT) : process.cwd();

function git(...args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

console.log('=== AGENT KIT SESSION START ===');
const status = git('status', '--short');
if (status !== null) console.log(`Git status:\n${status || '(clean)'}`);
const branch = git('branch', '--show-current');
if (branch) console.log(`Branch: ${branch}`);
const log = git('log', '--oneline', '-5');
if (log) console.log(`Recent commits:\n${log}`);

try {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, '.agent-kit', 'config.json'), 'utf8'));
  console.log(`Kit: harness=${cfg.harness}, skills=${cfg.profiles.join(', ') || 'none'}`);
  console.log(`Hooks: ${Object.entries(cfg.hooks).filter(([, on]) => on).map(([h]) => h).join(', ') || 'none'}`);
} catch {}

process.exit(0);
