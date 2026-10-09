#!/usr/bin/env node
/**
 * Guard Hook - Blocks dangerous operations before they execute
 * Event: pre-tool-use (or equivalent)
 * 
 * Blocks:
 * - Reading .env, .pem, .key, credential files
 * - rm -rf outside the repo
 * - git push --force
 * - Deploy/publish commands without approval
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = process.env.GIT_ROOT || process.cwd();

// Patterns to block
const BLOCKED_READ_PATTERNS = [
  /\.env($|\.)/,
  /\.pem$/,
  /\.key$/,
  /id_rsa/,
  /id_ed25519/,
  /\.kube\/config/,
  /\.aws\/credentials/,
  /\.docker\/config/,
  /secret/,
  /credential/,
  /token/,
];

const BLOCKED_COMMANDS = [
  { pattern: /rm\s+-rf\s+(?!.*\/\.)/, message: 'rm -rf outside current directory blocked' },
  { pattern: /git\s+push\s+.*--force/, message: 'git push --force blocked' },
  { pattern: /git\s+push\s+.*-f\s/, message: 'git push -f blocked' },
  { pattern: /(npm|yarn|pnpm)\s+publish/, message: 'Publish command blocked - requires approval' },
  { pattern: /(docker|kubectl|helm|terraform)\s+(push|apply|deploy|destroy)/, message: 'Deploy command blocked - requires approval' },
  { pattern: /(vercel|netlify|railway|fly|render)\s+deploy/, message: 'Deploy command blocked - requires approval' },
];

// Check if path is within repo
function isWithinRepo(targetPath) {
  const resolved = path.resolve(targetPath);
  const repoResolved = path.resolve(REPO_ROOT);
  return resolved.startsWith(repoResolved + path.sep) || resolved === repoResolved;
}

// Check if file read is blocked
function checkReadBlock(filePath) {
  const basename = path.basename(filePath);
  for (const pattern of BLOCKED_READ_PATTERNS) {
    if (pattern.test(basename) || pattern.test(filePath)) {
      return `Reading blocked file: ${filePath} (matches ${pattern})`;
    }
  }
  return null;
}

// Check if command is blocked
function checkCommandBlock(command) {
  for (const { pattern, message } of BLOCKED_COMMANDS) {
    if (pattern.test(command)) {
      // Check for approval marker
      const approvalFile = path.join(REPO_ROOT, '.agent-kit', 'approvals.json');
      if (fs.existsSync(approvalFile)) {
        try {
          const approvals = JSON.parse(fs.readFileSync(approvalFile, 'utf8'));
          const key = command.replace(/\s+/g, '_');
          if (approvals[key] === true) {
            return null; // Approved
          }
        } catch {}
      }
      return message;
    }
  }
  return null;
}

// Main
function main() {
  const args = process.argv.slice(2);
  const toolName = args[0];
  const toolArgs = JSON.parse(args[1] || '{}');

  let error = null;

  if (toolName === 'read' || toolName === 'cat' || toolName === 'readFile') {
    const filePath = toolArgs.path || toolArgs.filePath;
    if (filePath) {
      error = checkReadBlock(filePath);
    }
  } else if (toolName === 'bash' || toolName === 'shell' || toolName === 'exec') {
    const command = toolArgs.command || toolArgs.cmd;
    if (command) {
      error = checkCommandBlock(command);
    }
  } else if (toolName === 'write' || toolName === 'edit' || toolName === 'writeFile') {
    const filePath = toolArgs.path || toolArgs.filePath;
    if (filePath && !isWithinRepo(filePath)) {
      error = `Write outside repository blocked: ${filePath}`;
    }
  }

  if (error) {
    console.error(`GUARD BLOCKED: ${error}`);
    process.exit(1);
  }

  process.exit(0);
}

main();