#!/usr/bin/env node
/**
 * Remove: reverts an apply using <target>/.agent-kit/manifest.json.
 *
 * Usage: node remove.js --target <repo> [--dry-run] [--ignore-hash]
 *
 * Only touches paths listed in the manifest. Never deletes whole directories
 * the kit does not own, and leaves unrecorded user files in .agent-kit/ alone.
 * Refuses if any kit-written file changed since apply, unless --ignore-hash.
 */

const fs = require('fs');
const path = require('path');
const lib = require('./lib');

const args = lib.parseArgs(process.argv.slice(2), ['dry-run', 'ignore-hash']);
const dryRun = !!args['dry-run'];
const ignoreHash = !!args['ignore-hash'];
const target = path.resolve(args.target || process.cwd());

const AGENT_DIR = path.join(target, '.agent-kit');
const MANIFEST = path.join(AGENT_DIR, 'manifest.json');

// Remove empty directories under dir, deepest first. Never removes files.
function pruneEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) pruneEmptyDirs(path.join(dir, entry.name));
  }
  try { fs.rmdirSync(dir); } catch {}
}

function die(msg) {
  console.error(`[remove] ERROR: ${msg}`);
  process.exit(1);
}

const manifest = lib.readJson(MANIFEST);
if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.entries)) {
  die('no valid .agent-kit/manifest.json in target');
}

// Every path in the manifest must stay inside the target.
for (const e of manifest.entries) {
  const abs = path.resolve(target, e.path);
  if (abs !== target && !abs.startsWith(target + path.sep)) die(`manifest entry escapes target: ${e.path}`);
  if (e.backup && (path.isAbsolute(e.backup) || e.backup.split('/').includes('..'))) {
    die(`manifest backup path is unsafe: ${e.backup}`);
  }
}

// 1. Every file apply finished writing must still match what apply wrote.
const changed = [];
for (const e of manifest.entries) {
  if (!e.afterHash) continue; // write never completed; handled below
  const current = lib.hashPath(path.join(target, e.path));
  if (current !== e.afterHash) changed.push(e.path);
}
if (changed.length && !ignoreHash) {
  die(`these files changed since apply and will not be touched:\n  ${changed.join('\n  ')}\nReview them, then re-run with --ignore-hash to force.`);
}

if (dryRun) {
  for (const e of manifest.entries) {
    console.log(`[remove] DRY RUN: ${e.existed ? 'restore' : 'delete'} ${e.path}`);
  }
  console.log('[remove] DRY RUN: would delete only manifest-listed paths, then the empty kit dirs');
  process.exit(0);
}

// 3. Restore originals, delete kit-created files, drop empty kit dirs (shared rules in lib).
lib.restoreEntries(target, manifest);

// 4. Remove the kit's own state: the backups it recorded, then the manifest.
//    Then prune empty directories under the backup root (deepest first).
for (const e of manifest.entries) {
  if (e.backup) fs.rmSync(path.join(target, e.backup), { force: true });
}
fs.rmSync(MANIFEST, { force: true });
pruneEmptyDirs(path.join(target, '.agent-kit', 'backup'));
try { fs.rmdirSync(path.join(target, '.agent-kit', 'backup')); } catch {}
try { fs.rmdirSync(AGENT_DIR); } catch {} // only succeeds if the kit left nothing behind

console.log(`[remove] Reverted kit (applied ${manifest.timestamp}, kit ${manifest.kitCommit}).`);
if (changed.length) console.log(`[remove] Forced past changed files: ${changed.join(', ')}`);
const unfinished = manifest.entries.filter(e => !e.afterHash).length;
if (unfinished) console.log(`[remove] Left ${unfinished} unfinished entries untouched (never written by apply).`);
