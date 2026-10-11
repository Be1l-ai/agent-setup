#!/usr/bin/env node
/**
 * Shared helpers for the kit scripts (propose, apply, remove).
 * Hooks are NOT allowed to require this file: they are copied into target repos
 * and must be self-contained.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const KIT_ROOT = path.resolve(__dirname, '..');

// Hook-like features the kit ships. guard is the only one installed as a harness plugin.
// done-gate / format-on-edit / session-start are standalone scripts the user runs or wires up.
const HOOK_NAMES = ['guard', 'format-on-edit', 'done-gate', 'session-start'];

// Only harnesses with a verified native integration get files installed.
// Everything else is generic: nothing is registered, the proposal says so.
const SUPPORTED_HARNESSES = ['opencode', 'generic'];

const PROFILE_SKILLS = {
  debugging: ['systematic-debugging', 'test-driven-development'],
  'code-review': ['receiving-code-review'],
  branch: ['finishing-a-development-branch'],
  'security-review': ['claude-code-security-review'],
  frontend: ['frontend-design'],
};

const DEFAULT_FORMATTERS = {
  '.js': 'prettier --write',
  '.jsx': 'prettier --write',
  '.ts': 'prettier --write',
  '.tsx': 'prettier --write',
  '.json': 'prettier --write',
  '.css': 'prettier --write',
  '.md': 'prettier --write',
  '.py': 'ruff format',
  '.rs': 'rustfmt',
  '.go': 'gofmt -w',
};

// Keys in mcp/servers.json that are catalog metadata and must not reach the target config.
const MCP_META_KEYS = ['enabled', 'needsKey', 'keyEnvVar', 'keyUrl', 'access', 'description', 'notes'];

function parseArgs(argv, boolFlags = []) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      out._.push(a);
      continue;
    }
    const key = a.slice(2);
    if (boolFlags.includes(key)) {
      out[key] = true;
    } else {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`missing value for --${key}`);
      }
      out[key] = value;
      i++;
    }
  }
  return out;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(abs, base));
    } else {
      out.push(path.relative(base, abs).split(path.sep).join('/'));
    }
  }
  return out;
}

function hashPath(file) {
  try {
    return sha256(fs.readFileSync(file));
  } catch {
    return null;
  }
}

// Reverts the entries apply recorded. Rules:
//  - existed=true  -> copy the backup back over the path.
//  - existed=false -> delete the path, but only if apply finished writing it
//    (afterHash set). An unfinished entry was never written by us, so leave it.
//  - Empty createdDirs are removed last (rmdir refuses non-empty dirs).
function restoreEntries(target, manifest) {
  for (const e of manifest.entries || []) {
    const dest = path.join(target, e.path);
    if (e.existed) {
      if (!e.backup) throw new Error(`no backup recorded for ${e.path}`);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(target, e.backup), dest);
    } else if (e.afterHash && fs.existsSync(dest)) {
      fs.unlinkSync(dest);
    }
  }
  const dirs = [...(manifest.createdDirs || [])].sort((a, b) => b.length - a.length);
  for (const d of dirs) {
    try { fs.rmdirSync(path.join(target, d)); } catch {}
  }
}

function kitCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: KIT_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

module.exports = {
  KIT_ROOT,
  HOOK_NAMES,
  SUPPORTED_HARNESSES,
  PROFILE_SKILLS,
  DEFAULT_FORMATTERS,
  MCP_META_KEYS,
  parseArgs,
  readJson,
  sha256,
  hashPath,
  listFiles,
  restoreEntries,
  kitCommit,
};
