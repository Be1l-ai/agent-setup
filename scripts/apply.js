#!/usr/bin/env node
/**
 * Apply: installs the kit into a target repo from a proposal.json.
 *
 * Usage: node apply.js --target <repo> --proposal <proposal.json> [--dry-run]
 *                      [--overwrite] [--allow-dirty]
 *
 * Guarantees:
 *  - Preflight validates everything before the first write.
 *  - Every pre-existing file is backed up into <target>/.agent-kit/backup/ first.
 *  - Manifest <target>/.agent-kit/manifest.json is written before changes and
 *    updated after each write, so remove.js can always revert.
 *  - Any failure mid-apply rolls back. Re-applying the same proposal is a no-op.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const lib = require('./lib');

const args = lib.parseArgs(process.argv.slice(2), ['dry-run', 'overwrite', 'allow-dirty']);
const dryRun = !!args['dry-run'];
const overwrite = !!args.overwrite;
const allowDirty = !!args['allow-dirty'];
const target = path.resolve(args.target || process.cwd());
const proposalPath = args.proposal;

const AGENT_DIR = path.join(target, '.agent-kit');
const MANIFEST = path.join(AGENT_DIR, 'manifest.json');
const BACKUP_ROOT = '.agent-kit/backup';
const START = '<!-- agent-kit:start -->';
const END = '<!-- agent-kit:end -->';
const CMDS_START = '<!-- agent-kit:commands:start -->';
const CMDS_END = '<!-- agent-kit:commands:end -->';

function die(msg) {
  console.error(`[apply] ERROR: ${msg}`);
  process.exit(1);
}
const log = msg => console.log(`[apply] ${msg}`);

// ---------- preflight (no writes) ----------

if (!proposalPath) die('--proposal <proposal.json> is required');
const proposal = lib.readJson(proposalPath);
if (!proposal || proposal.version !== 1 || !proposal.hash) die(`proposal missing or invalid: ${proposalPath}`);
if (!fs.existsSync(target)) die(`target does not exist: ${target}`);
if (path.resolve(proposal.target) !== target) die(`proposal was generated for ${proposal.target}, not ${target}`);

// Verify the proposal was not edited after generation (hash covers the body only).
{
  const { hash, generatedAt, ...body } = proposal;
  if (lib.sha256(Buffer.from(JSON.stringify(body))) !== hash) {
    die('proposal hash does not match its contents. Regenerate it with propose.js.');
  }
}

const templatePath = path.join(lib.KIT_ROOT, 'AGENTS.template.md');
if (!fs.existsSync(templatePath)) die('AGENTS.template.md missing from kit');
const template = fs.readFileSync(templatePath, 'utf8');
if (template.split(START).length !== 2 || template.split(END).length !== 2) {
  die('AGENTS.template.md must contain exactly one agent-kit start and end marker');
}
let kitBlock = template.slice(template.indexOf(START), template.indexOf(END) + END.length);

// Fill the commands block with what recon detected.
const detected = proposal.detectedCommands || {};
const cmdLines = Object.keys(detected).length
  ? Object.entries(detected).map(([k, v]) => `- ${k}: \`${v}\``).join('\n')
  : '_No standard commands detected. Ask the user how to build, test, and lint._';
const cs = kitBlock.indexOf(CMDS_START);
const ce = kitBlock.indexOf(CMDS_END);
if (cs !== -1 && ce !== -1 && ce > cs) {
  kitBlock = kitBlock.slice(0, cs + CMDS_START.length) + '\n' + cmdLines + '\n' + kitBlock.slice(ce);
}

// Already applied with this proposal => no-op. Different proposal => must remove first.
const existing = lib.readJson(MANIFEST);
if (existing) {
  if (existing.proposalHash === proposal.hash) {
    log('Already applied with this proposal. Nothing to do.');
    process.exit(0);
  }
  die('kit already applied with a different proposal. Run remove.js first.');
}

// Clean tree check.
let status = null;
try {
  status = execFileSync('git', ['status', '--porcelain'], { cwd: target, encoding: 'utf8' })
    .split('\n').filter(Boolean);
} catch {
  status = null;
}
if (status === null && !allowDirty) die('target is not a git repo. Use --allow-dirty to proceed without a clean-tree check.');
if (status && status.length && !allowDirty) {
  die(`target working tree is not clean (${status.length} changes). Commit or stash first, or use --allow-dirty.`);
}

// Build the write plan. Each entry: { path, source?, kind }.
// kind: 'marker' (AGENTS.md block), 'json-merge' (opencode.json / .mcp.json), 'file' (copy/generate), 'dir' (skill folders).
const plan = [];
const seen = new Set();
function addPlan(rel, kind, extra = {}) {
  if (seen.has(rel)) return;
  seen.add(rel);
  const abs = path.join(target, rel);
  const exists = fs.existsSync(abs);
  if (exists && kind === 'file' && !overwrite) {
    die(`${rel} already exists. Use --overwrite to back it up and replace it.`);
  }
  if (exists && kind === 'file' && fs.statSync(abs).isDirectory()) {
    die(`${rel} exists and is a directory. Refusing to replace it.`);
  }
  plan.push({ path: rel, kind, existed: exists, ...extra });
}

for (const f of proposal.files) {
  if (f.action === 'create-dir') {
    // Skill folders: check every file the skill will write.
    const srcDir = path.join(lib.KIT_ROOT, f.source);
    if (!fs.existsSync(srcDir)) die(`skill source missing: ${f.source}`);
    for (const rel of lib.listFiles(srcDir)) {
      addPlan(`${f.path}/${rel}`, 'file', { source: path.join(srcDir, rel) });
    }
    continue;
  }
  if (f.action === 'merge' && f.path === 'AGENTS.md') {
    addPlan('AGENTS.md', 'marker');
    continue;
  }
  if (f.action === 'merge') {
    addPlan(f.path, 'json-merge');
    continue;
  }
  if (f.source) {
    const src = path.join(lib.KIT_ROOT, f.source);
    if (!fs.existsSync(src)) die(`kit file missing: ${f.source}`);
    addPlan(f.path, 'file', { source: src });
    continue;
  }
  addPlan(f.path, 'file', { generated: true });
}
for (const rel of ['.agent-kit/config.json', '.agent-kit/format-config.json', '.agent-kit/verify-config.json', '.agent-kit/.gitignore']) {
  addPlan(rel, 'file', { generated: true });
}

// AGENTS.md validation.
let agentsExisting = null;
if (fs.existsSync(path.join(target, 'AGENTS.md'))) {
  agentsExisting = fs.readFileSync(path.join(target, 'AGENTS.md'), 'utf8');
  const starts = agentsExisting.split(START).length - 1;
  const ends = agentsExisting.split(END).length - 1;
  if (starts !== ends || starts > 1) die('AGENTS.md has unbalanced or duplicate agent-kit markers. Fix by hand first.');
  if (starts === 1 && agentsExisting.indexOf(END) < agentsExisting.indexOf(START)) {
    die('AGENTS.md has END before START. Fix by hand first.');
  }
}

// JSON merge targets must parse. Never replace an unparseable config.
const jsonMerges = {};
for (const p of plan.filter(x => x.kind === 'json-merge')) {
  const abs = path.join(target, p.path);
  if (!fs.existsSync(abs)) {
    jsonMerges[p.path] = {};
    continue;
  }
  const parsed = lib.readJson(abs);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    die(`${p.path} exists but is not a valid JSON object. Refusing to replace it.`);
  }
  jsonMerges[p.path] = parsed;
}

// Hook/plugin sources must exist (guard plugin only, others are standalone).
for (const p of plan) {
  if (p.kind === 'file' && p.path.startsWith('.opencode/plugins/') && !p.source) die(`plugin source missing for ${p.path}`);
}

// Directories the kit will create (recorded so rollback/remove can clean up).
const createdDirs = [];
for (const p of plan) {
  let d = path.dirname(p.path);
  while (d && d !== '.' && !fs.existsSync(path.join(target, d))) {
    if (!createdDirs.includes(d)) createdDirs.push(d);
    d = path.dirname(d);
  }
}
if (!fs.existsSync(AGENT_DIR) && !createdDirs.includes('.agent-kit')) createdDirs.push('.agent-kit');

log(`Target: ${target}`);
log(`Harness: ${proposal.harness}; skills=${proposal.skills.length}; hooks=${proposal.hooks.join(',') || 'none'}; mcp=${proposal.mcpServers.join(',') || 'none'}`);
for (const p of plan) {
  const tag = p.kind === 'marker' ? 'merge  ' : p.kind === 'json-merge' ? 'merge  ' : (p.existed ? 'replace' : 'create ');
  log(`  ${tag} ${p.path}${p.existed && p.kind === 'file' ? '  (backup first)' : ''}`);
}
if (proposal.permission || (proposal.plugins && proposal.plugins.length)) log('  merge   opencode.json (V2 permissions/plugins/skills + V1 permission/plugin)');

if (dryRun) {
  log('DRY RUN: no changes made.');
  process.exit(0);
}

// ---------- apply ----------

const manifest = {
  version: 1,
  kitCommit: lib.kitCommit(),
  proposalHash: proposal.hash,
  timestamp: new Date().toISOString(),
  target,
  harness: proposal.harness,
  skills: proposal.skills,
  hooks: proposal.hooks,
  mcpServers: proposal.mcpServers,
  pluginsRegistered: proposal.plugins || [],
  createdDirs,
  entries: [], // { path, existed, backup, beforeHash, afterHash }
};

function writeManifest() {
  fs.mkdirSync(AGENT_DIR, { recursive: true });
  const tmp = MANIFEST + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2));
  fs.renameSync(tmp, MANIFEST);
}

function rollback(reason) {
  console.error(`[apply] FAILED: ${reason}. Rolling back.`);
  try {
    lib.restoreEntries(target, manifest);
    fs.rmSync(MANIFEST, { force: true });
    fs.rmSync(path.join(target, BACKUP_ROOT), { recursive: true, force: true });
    for (const d of [...createdDirs].sort((a, b) => b.length - a.length)) {
      try { fs.rmdirSync(path.join(target, d)); } catch {}
    }
    console.error('[apply] Rollback complete.');
  } catch (e) {
    console.error(`[apply] Rollback incomplete: ${e.message}. Run remove.js --target ${target}`);
  }
  process.exit(1);
}

// Record a file in the manifest and back up its original content first.
function recordBefore(rel) {
  const abs = path.join(target, rel);
  const existed = fs.existsSync(abs);
  const entry = { path: rel, existed, backup: null, beforeHash: null, afterHash: null };
  if (existed) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupRel = path.posix.join(BACKUP_ROOT, stamp, rel);
    fs.mkdirSync(path.dirname(path.join(target, backupRel)), { recursive: true });
    fs.copyFileSync(abs, path.join(target, backupRel));
    entry.backup = backupRel;
    entry.beforeHash = lib.hashPath(abs);
  }
  manifest.entries.push(entry);
  writeManifest(); // intent recorded before the write
  return entry;
}

function writeRecorded(rel, content) {
  const entry = recordBefore(rel);
  const abs = path.join(target, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  entry.afterHash = lib.hashPath(abs);
  writeManifest();
}

try {
  writeManifest();

  for (const p of plan) {
    if (p.kind === 'marker') {
      let content;
      if (agentsExisting === null) {
        content = kitBlock + '\n';
      } else if (agentsExisting.indexOf(START) === -1) {
        content = agentsExisting.trimEnd() + '\n\n' + kitBlock + '\n';
      } else {
        const s = agentsExisting.indexOf(START);
        const e = agentsExisting.indexOf(END) + END.length;
        content = agentsExisting.slice(0, s) + kitBlock + agentsExisting.slice(e);
      }
      writeRecorded(p.path, content);
    } else if (p.kind === 'json-merge') {
      const base = jsonMerges[p.path] || {};
      const next = { ...base };
      if (p.path === 'opencode.json') {
        // --- config translation helpers (pure, scoped to this block) ---
        // V1 identified permission rules by tool name; V2 uses opaque action
        // strings. Map the keys the kit emits onto their V2 action names.
        const v2Action = t => (t === 'bash' ? 'shell' : t === 'task' ? 'subagent' : t);
        // V1 nested object { bash: { pattern: effect } } -> V2 ordered array
        // [{ action, resource, effect }]. Object key order is preserved, and the
        // kit lists "*" first, so the V2 "last match wins" rule keeps the same
        // outcome as V1 (specific rules after the catch-all).
        const toV2Permissions = perm => {
          const out = [];
          for (const tool of Object.keys(perm)) {
            const rules = perm[tool];
            if (!rules || typeof rules !== 'object') continue;
            for (const resource of Object.keys(rules)) {
              out.push({ action: v2Action(tool), resource, effect: rules[resource] });
            }
          }
          return out;
        };
        // V2 rejects a plugin config entry that resolves to a file
        // ("configured plugin path must be a directory"), so translate the V1
        // file entry (./x/agent-kit-guard.mjs) to its directory
        // (./x/agent-kit-guard). The install side must place an index.mjs there.
        const toV2PluginTarget = entry =>
          typeof entry === 'string' ? entry.replace(/\.(mjs|cjs|js|ts|tsx|jsx)$/, '') : entry;
        const appendUnique = (arr, items) => {
          const seen = new Set(arr.map(x => JSON.stringify(x)));
          for (const it of items) {
            const k = JSON.stringify(it);
            if (!seen.has(k)) { seen.add(k); arr.push(it); }
          }
          return arr;
        };

        if (proposal.permission) {
          // V1 shape: "permission": { bash: {...}, read: {...} }.
          next.permission = { ...(base.permission || {}), ...proposal.permission };
          // V2 shape: ordered "permissions" array, last match wins.
          next.permissions = appendUnique(
            Array.isArray(base.permissions) ? [...base.permissions] : [],
            toV2Permissions(proposal.permission),
          );
        }
        if (proposal.plugins && proposal.plugins.length) {
          // V1 shape: "plugin": ["./.opencode/plugins/agent-kit-guard.mjs"].
          next.plugin = appendUnique(Array.isArray(base.plugin) ? [...base.plugin] : [], proposal.plugins);
          // V2 shape: "plugins": ["./.opencode/plugins/agent-kit-guard"] (a directory).
          next.plugins = appendUnique(
            Array.isArray(base.plugins) ? [...base.plugins] : [],
            proposal.plugins.map(toV2PluginTarget),
          );
        }
        // V2 discovers .opencode/skills/ automatically; the kit installs skills
        // under .agent-kit/, so point the "skills" array at that directory too.
        if (Array.isArray(proposal.skills) && proposal.skills.length) {
          next.skills = appendUnique(
            Array.isArray(base.skills) ? [...base.skills] : [],
            ['./.agent-kit/skills'],
          );
        }
        if (!next.$schema) next.$schema = 'https://opencode.ai/config.json';
      }
      if (p.path === '.mcp.json' && proposal.mcpServers.length) {
        const catalog = lib.readJson(path.join(lib.KIT_ROOT, 'mcp', 'servers.json'));
        next.mcpServers = { ...(base.mcpServers || {}) };
        for (const name of proposal.mcpServers) {
          const def = { ...catalog.servers[name] };
          for (const k of lib.MCP_META_KEYS) delete def[k];
          next.mcpServers[name] = def;
        }
      }
      writeRecorded(p.path, JSON.stringify(next, null, 2) + '\n');
    } else if (p.source) {
      writeRecorded(p.path, fs.readFileSync(p.source));
    } else {
      // Generated kit config files.
      const content = generated(p.path);
      writeRecorded(p.path, content);
    }
  }

  log('Applied.');
  log(`Undo with: node ${path.join(lib.KIT_ROOT, 'scripts', 'remove.js')} --target ${target}`);
  if (proposal.hooks.includes('done-gate') && !proposal.verifyCommand) {
    log('WARNING: done-gate needs a verify command. Set one in .agent-kit/verify-config.json.');
  }
  if (proposal.harness === 'opencode') {
    log('OpenCode: merged opencode.json — V2 "plugins"/"permissions"/"skills" plus V1 "plugin"/"permission" for compatibility. Restart OpenCode to load them.');
    if (proposal.plugins && proposal.plugins.length) {
      log('OpenCode: V2 loads the guard from a plugin directory (.opencode/plugins/agent-kit-guard/index.mjs). If that directory is missing, OpenCode 2.x logs "failed to load plugin"; see harnesses/opencode.md.');
    }
  }
} catch (e) {
  rollback(e.message);
}

function generated(rel) {
  switch (rel) {
    case '.agent-kit/config.json':
      return JSON.stringify({
        harness: proposal.harness,
        os: proposal.os,
        hooks: Object.fromEntries(lib.HOOK_NAMES.map(h => [h, proposal.hooks.includes(h)])),
        profiles: proposal.skills,
        mcp: proposal.mcpServers,
      }, null, 2) + '\n';
    case '.agent-kit/format-config.json':
      return JSON.stringify({ formatters: proposal.formatters }, null, 2) + '\n';
    case '.agent-kit/verify-config.json':
      return JSON.stringify({ verifyCommand: proposal.verifyCommand }, null, 2) + '\n';
    case '.agent-kit/.gitignore':
      return '*\n';
    default:
      throw new Error(`no generator for ${rel}`);
  }
}
