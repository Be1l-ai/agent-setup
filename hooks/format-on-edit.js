#!/usr/bin/env node
/**
 * Format-on-Edit Hook - Runs the repo's formatter on edited files
 * Event: post-tool-use (after file edit)
 * 
 * Reads formatter command from repo's package.json/Makefile/pyproject.toml at apply time
 * Runs with timeout, never fails the edit
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = process.env.GIT_ROOT || process.cwd();
const CONFIG_FILE = path.join(REPO_ROOT, '.agent-kit', 'format-config.json');

// Default formatters by language
const DEFAULT_FORMATTERS = {
  '.js': 'prettier --write',
  '.jsx': 'prettier --write',
  '.ts': 'prettier --write',
  '.tsx': 'prettier --write',
  '.json': 'prettier --write',
  '.css': 'prettier --write',
  '.scss': 'prettier --write',
  '.html': 'prettier --write',
  '.md': 'prettier --write',
  '.py': 'ruff format',
  '.rs': 'rustfmt',
  '.go': 'gofmt -w',
  '.java': 'google-java-format -i',
  '.kt': 'ktfmt -i',
  '.swift': 'swift-format -i',
  '.rb': 'rubocop -a',
  '.php': 'php-cs-fixer fix',
};

// Load config from apply-time detection
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch {}
  }
  return {};
}

function getFormatterForFile(filePath, config) {
  const ext = path.extname(filePath);
  
  // Check config first (from recon)
  if (config.formatters && config.formatters[ext]) {
    return config.formatters[ext];
  }
  
  // Check package.json scripts
  const pkgPath = path.join(REPO_ROOT, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.scripts && pkg.scripts.format) {
        return pkg.scripts.format;
      }
      if (pkg.scripts && pkg.scripts['format:fix']) {
        return pkg.scripts['format:fix'];
      }
    } catch {}
  }
  
  // Fallback to defaults
  return DEFAULT_FORMATTERS[ext] || null;
}

function main() {
  const args = process.argv.slice(2);
  const toolName = args[0];
  const toolArgs = JSON.parse(args[1] || '{}');

  // Only run after write/edit operations
  if (toolName !== 'write' && toolName !== 'edit' && toolName !== 'writeFile' && toolName !== 'editFile') {
    process.exit(0);
  }

  const filePath = toolArgs.path || toolArgs.filePath;
  if (!filePath) {
    process.exit(0);
  }

  const config = loadConfig();
  const formatter = getFormatterForFile(filePath, config);
  
  if (!formatter) {
    // No formatter configured for this file type
    process.exit(0);
  }

  // Run formatter with timeout
  try {
    const fullPath = path.resolve(REPO_ROOT, filePath);
    const cmd = `${formatter} "${fullPath}"`;
    
    execSync(cmd, {
      cwd: REPO_ROOT,
      timeout: 10000, // 10 second timeout
      stdio: 'ignore', // Never fail the edit
    });
  } catch (e) {
    // Silently ignore - never fail the edit
  }

  process.exit(0);
}

main();