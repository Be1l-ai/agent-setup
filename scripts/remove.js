#!/usr/bin/env node
/**
 * Remove Script - Uninstalls the kit using the manifest
 * Usage: node remove.js --target <path> [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const targetIdx = args.indexOf('--target');
const target = targetIdx >= 0 ? args[targetIdx + 1] : process.cwd();

const MANIFEST_DIR = '.agent-kit';
const MANIFEST_FILE = 'manifest.json';

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function removeFile(file) {
  const fullPath = path.join(target, file);
  if (!fs.existsSync(fullPath)) {
    console.log(`[remove] Not found (already removed): ${file}`);
    return;
  }
  if (dryRun) {
    console.log(`[remove] DRY RUN: Would delete ${file}`);
    return;
  }
  fs.unlinkSync(fullPath);
  console.log(`[remove] Deleted ${file}`);
}

function restoreFile(file, beforeHash) {
  const fullPath = path.join(target, file);
  if (!fs.existsSync(fullPath)) {
    console.log(`[remove] File missing, cannot restore: ${file}`);
    return;
  }
  if (dryRun) {
    console.log(`[remove] DRY RUN: Would restore ${file} (before: ${beforeHash})`);
    return;
  }
  // We don't have the original content, so we can only delete
  // In a real implementation, we'd store backup during apply
  console.log(`[remove] WARNING: Cannot auto-restore ${file} (no backup stored)`);
  console.log(`[remove] Manual restore needed from git: git checkout HEAD -- ${file}`);
}

function removeDir(dir) {
  const fullPath = path.join(target, dir);
  if (!fs.existsSync(fullPath)) return;
  if (dryRun) {
    console.log(`[remove] DRY RUN: Would remove dir ${dir}`);
    return;
  }
  fs.rmSync(fullPath, { recursive: true, force: true });
  console.log(`[remove] Removed dir ${dir}`);
}

function main() {
  console.log(`[remove] Target: ${target}`);

  const manifestPath = path.join(target, MANIFEST_DIR, MANIFEST_FILE);
  const manifest = readJson(manifestPath);

  if (!manifest) {
    console.error('[remove] No manifest found. Cannot uninstall automatically.');
    console.error('[remove] Run manual cleanup (see REMOVE.md)');
    process.exit(1);
  }

  console.log(`[remove] Kit commit: ${manifest.kitCommit}`);
  console.log(`[remove] Applied: ${manifest.timestamp}`);

  // Remove created files
  for (const file of manifest.createdFiles || []) {
    removeFile(file.path);
  }

  // Restore modified files
  for (const file of manifest.modifiedFiles || []) {
    restoreFile(file.path, file.beforeHash);
  }

  // Remove .agent-kit directory
  removeDir(MANIFEST_DIR);

  // Check for other kit-created directories
  const kitDirs = [
    '.claude/hooks',
    '.codex/hooks',
    '.opencode/hooks',
    '.kilocode/hooks',
    '.clinerules/hooks',
    '.cursor/hooks',
  ];
  for (const dir of kitDirs) {
    const fullDir = path.join(target, dir);
    if (fs.existsSync(fullDir)) {
      // Only remove if it only contains kit hooks
      const files = fs.readdirSync(fullDir);
      const kitHooks = ['guard.js', 'format-on-edit.js', 'done-gate.js', 'session-start.js'];
      const onlyKitHooks = files.every(f => kitHooks.includes(f));
      if (onlyKitHooks) {
        removeDir(dir);
      }
    }
  }

  console.log('[remove] Done. Run git status to verify.');
  if (!dryRun) {
    console.log('[remove] Consider committing the removal: git add -A && git commit -m "Remove agent kit"');
  }
}

main();