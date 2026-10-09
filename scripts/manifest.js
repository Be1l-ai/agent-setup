#!/usr/bin/env node
/**
 * Manifest Script - Writes/reads manifest.json for apply/remove tracking
 * Usage: 
 *   node manifest.js write --target <path> --kit-root <path> --proposal <path> [--dry-run]
 *   node manifest.js read --target <path>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const cmd = args[0];
const targetIdx = args.indexOf('--target');
const kitRootIdx = args.indexOf('--kit-root');
const proposalIdx = args.indexOf('--proposal');
const target = targetIdx >= 0 ? args[targetIdx + 1] : process.cwd();
const kitRoot = kitRootIdx >= 0 ? args[kitRootIdx + 1] : path.join(__dirname, '..');
const proposalPath = proposalIdx >= 0 ? args[proposalIdx + 1] : null;

const MANIFEST_DIR = '.agent-kit';
const MANIFEST_FILE = 'manifest.json';

function hashFile(file) {
  try {
    const crypto = require('crypto');
    const content = fs.readFileSync(file);
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  } catch {
    return null;
  }
}

function getKitCommit() {
  try {
    return execSync('git rev-parse HEAD', { cwd: kitRoot, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function readProposal(proposalPath) {
  try {
    return JSON.parse(fs.readFileSync(proposalPath, 'utf8'));
  } catch {
    return null;
  }
}

function writeManifest() {
  if (!proposalPath) {
    console.error('Usage: manifest.js write --proposal <proposal.json>');
    process.exit(1);
  }

  const proposal = readProposal(proposalPath);
  if (!proposal) {
    console.error('Failed to read proposal');
    process.exit(1);
  }

  const manifestDir = path.join(target, MANIFEST_DIR);
  const manifestPath = path.join(manifestDir, MANIFEST_FILE);

  const manifest = {
    version: '1.0',
    kitCommit: getKitCommit(),
    timestamp: new Date().toISOString(),
    kitRoot: path.resolve(kitRoot),
    targetRoot: path.resolve(target),
    createdFiles: [],
    modifiedFiles: [],
    enabledFeatures: proposal.enabledFeatures || {},
    config: proposal.config || {},
  };

  // Process created files
  for (const file of proposal.createdFiles || []) {
    const fullPath = path.join(target, file);
    manifest.createdFiles.push({
      path: file,
      hash: hashFile(fullPath),
    });
  }

  // Process modified files
  for (const file of proposal.modifiedFiles || []) {
    const fullPath = path.join(target, file);
    manifest.modifiedFiles.push({
      path: file,
      beforeHash: proposal.beforeHashes?.[file] || null,
      afterHash: hashFile(fullPath),
    });
  }

  if (!dryRun) {
    fs.mkdirSync(manifestDir, { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`[manifest] Written to ${manifestPath}`);
  } else {
    console.log('[manifest] DRY RUN - would write:');
    console.log(JSON.stringify(manifest, null, 2));
  }
}

function readManifest() {
  const manifestPath = path.join(target, MANIFEST_DIR, MANIFEST_FILE);
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
}

function main() {
  if (cmd === 'write') {
    writeManifest();
  } else if (cmd === 'read') {
    const manifest = readManifest();
    if (manifest) {
      console.log(JSON.stringify(manifest, null, 2));
    } else {
      console.error('[manifest] No manifest found');
      process.exit(1);
    }
  } else {
    console.error('Usage: manifest.js <write|read> --target <path> ...');
    process.exit(1);
  }
}

main();