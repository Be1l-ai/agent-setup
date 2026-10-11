#!/usr/bin/env node
/**
 * Format-on-edit hook (post-tool-use). Runs the repo's formatter on the edited file.
 *
 * Input: JSON on stdin: { "tool": "write"|"edit", "input": { "file_path": "..." } }
 * Always exits 0: formatting failures never fail the edit.
 * The formatter runs with argv array (no shell), so filenames cannot inject commands.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = process.env.GIT_ROOT ? path.resolve(process.env.GIT_ROOT) : process.cwd();
const CONFIG = path.join(ROOT, '.agent-kit', 'format-config.json');

function loadFormatters() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG, 'utf8')).formatters || {};
  } catch {
    return {};
  }
}

let raw = '';
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let event = {};
  try { event = JSON.parse(raw || '{}'); } catch { process.exit(0); }
  if (event.tool !== 'write' && event.tool !== 'edit') process.exit(0);

  const file = event.input?.file_path || event.input?.path;
  if (!file) process.exit(0);

  const ext = path.extname(file);
  const formatter = loadFormatters()[ext];
  if (!formatter) process.exit(0);

  // formatter is a trusted command string from config; the file path is a separate argv element.
  const [bin, ...baseArgs] = formatter.split(/\s+/);
  spawnSync(bin, [...baseArgs, path.resolve(ROOT, file)], {
    cwd: ROOT,
    timeout: 10000,
    stdio: 'ignore',
  });
  process.exit(0);
});
