#!/usr/bin/env node
/**
 * Merge AGENTS.md - Merges kit content into existing AGENTS.md between marker comments
 * Usage: node merge-agents-md.js --target <path> --kit-template <path> [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const targetIdx = args.indexOf('--target');
const templateIdx = args.indexOf('--kit-template');
const target = targetIdx >= 0 ? args[targetIdx + 1] : process.cwd();
const templatePath = templateIdx >= 0 ? args[templateIdx + 1] : path.join(__dirname, '..', 'AGENTS.template.md');

const START_MARKER = '<!-- agent-kit:start -->';
const END_MARKER = '<!-- agent-kit:end -->';

function readFile(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function writeFile(file, content) {
  if (dryRun) {
    console.log(`[merge-agents-md] DRY RUN: Would write ${file}`);
    return;
  }
  fs.writeFileSync(file, content);
  console.log(`[merge-agents-md] Wrote ${file}`);
}

function extractKitContent(template) {
  const start = template.indexOf(START_MARKER);
  const end = template.indexOf(END_MARKER);
  if (start === -1 || end === -1) {
    throw new Error('Markers not found in template');
  }
  return template.slice(start, end + END_MARKER.length);
}

function merge(existing, kitContent) {
  const startIdx = existing.indexOf(START_MARKER);
  const endIdx = existing.indexOf(END_MARKER);

  if (startIdx === -1 || endIdx === -1) {
    // No markers - append kit content at end
    if (existing.trim()) {
      return existing.trimEnd() + '\n\n' + kitContent + '\n';
    }
    return kitContent + '\n';
  }

  // Replace content between markers
  const before = existing.slice(0, startIdx);
  const after = existing.slice(endIdx + END_MARKER.length);
  return before + kitContent + after;
}

function main() {
  console.log(`[merge-agents-md] Target: ${target}`);
  console.log(`[merge-agents-md] Template: ${templatePath}`);

  const template = readFile(templatePath);
  if (!template) {
    console.error('[merge-agents-md] Template not found');
    process.exit(1);
  }

  const kitContent = extractKitContent(template);
  const agentsPath = path.join(target, 'AGENTS.md');
  const existing = readFile(agentsPath);

  const merged = merge(existing, kitContent);

  if (existing === merged) {
    console.log('[merge-agents-md] No changes needed');
    return;
  }

  writeFile(agentsPath, merged);
}

main();