#!/usr/bin/env node
/**
 * Merge JSON - Merges kit JSON config into existing config key-by-key (never replaces)
 * Usage: node merge-json.js --target <path> --kit-config <path> --output <path> [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const targetIdx = args.indexOf('--target');
const kitIdx = args.indexOf('--kit-config');
const outputIdx = args.indexOf('--output');
const target = targetIdx >= 0 ? args[targetIdx + 1] : process.cwd();
const kitConfigPath = kitIdx >= 0 ? args[kitIdx + 1] : null;
const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : null;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(file, obj) {
  if (dryRun) {
    console.log(`[merge-json] DRY RUN: Would write ${file}`);
    return;
  }
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
  console.log(`[merge-json] Wrote ${file}`);
}

function deepMerge(target, source, path = '') {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = target[key];
    const newPath = path ? `${path}.${key}` : key;

    if (srcVal === null || srcVal === undefined) {
      continue; // Don't overwrite with null/undefined
    }

    if (tgtVal === null || tgtVal === undefined) {
      result[key] = srcVal;
      console.log(`[merge-json] Added ${newPath}`);
      continue;
    }

    if (Array.isArray(srcVal) && Array.isArray(tgtVal)) {
      // For arrays, merge unique items (source wins on conflicts)
      const merged = [...tgtVal];
      for (const item of srcVal) {
        if (!merged.some(m => JSON.stringify(m) === JSON.stringify(item))) {
          merged.push(item);
        }
      }
      result[key] = merged;
      console.log(`[merge-json] Merged array ${newPath}`);
      continue;
    }

    if (typeof srcVal === 'object' && typeof tgtVal === 'object' && !Array.isArray(srcVal)) {
      // Recurse for objects
      result[key] = deepMerge(tgtVal, srcVal, newPath);
      continue;
    }

    // Primitive values - target wins (user config takes precedence)
    console.log(`[merge-json] Kept user value for ${newPath}`);
  }
  return result;
}

function main() {
  if (!kitConfigPath || !outputPath) {
    console.error('Usage: merge-json.js --kit-config <kit.json> --output <target.json> [--target <dir>] [--dry-run]');
    process.exit(1);
  }

  const kitConfig = readJson(kitConfigPath);
  if (!kitConfig) {
    console.error(`[merge-json] Kit config not found: ${kitConfigPath}`);
    process.exit(1);
  }

  const targetConfig = readJson(outputPath) || {};
  const merged = deepMerge(targetConfig, kitConfig);

  writeJson(outputPath, merged);
}

main();