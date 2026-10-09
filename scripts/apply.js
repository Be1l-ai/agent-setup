#!/usr/bin/env node
/**
 * Apply Script - Main orchestration for applying the kit to a target repo
 * Usage: node apply.js --target <path> --proposal <path> --kit-root <path> [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const targetIdx = args.indexOf('--target');
const proposalIdx = args.indexOf('--proposal');
const kitRootIdx = args.indexOf('--kit-root');
const target = targetIdx >= 0 ? args[targetIdx + 1] : process.cwd();
const proposalPath = proposalIdx >= 0 ? args[proposalIdx + 1] : null;
const kitRoot = kitRootIdx >= 0 ? args[kitRootIdx + 1] : path.join(__dirname, '..');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeFile(file, content) {
  if (dryRun) {
    console.log(`[apply] DRY RUN: Would write ${file}`);
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const data = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  fs.writeFileSync(file, data);
  console.log(`[apply] Wrote ${file}`);
}

function copyFile(src, dest) {
  if (dryRun) {
    console.log(`[apply] DRY RUN: Would copy ${src} -> ${dest}`);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`[apply] Copied ${dest}`);
}

function copyDir(src, dest) {
  if (dryRun) {
    console.log(`[apply] DRY RUN: Would copy dir ${src} -> ${dest}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
  console.log(`[apply] Copied dir ${dest}`);
}

function run(cmd, cwd = target) {
  if (dryRun) {
    console.log(`[apply] DRY RUN: Would run: ${cmd}`);
    return { success: true };
  }
  try {
    execSync(cmd, { cwd, stdio: 'inherit', shell: true });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function loadProposal() {
  if (!proposalPath) {
    console.error('[apply] --proposal required');
    process.exit(1);
  }
  const proposal = readJson(proposalPath);
  if (!proposal) {
    console.error('[apply] Failed to read proposal');
    process.exit(1);
  }
  return proposal;
}

function applyAGENTS(proposal) {
  const templatePath = path.join(kitRoot, 'AGENTS.template.md');
  const template = fs.readFileSync(templatePath, 'utf8');
  const START = '<!-- agent-kit:start -->';
  const END = '<!-- agent-kit:end -->';
  const startIdx = template.indexOf(START);
  const endIdx = template.indexOf(END);
  const kitContent = template.slice(startIdx, endIdx + END.length);

  const agentsPath = path.join(target, 'AGENTS.md');
  let existing = '';
  if (fs.existsSync(agentsPath)) {
    existing = fs.readFileSync(agentsPath, 'utf8');
  }

  const existingStart = existing.indexOf(START);
  const existingEnd = existing.indexOf(END);

  let merged;
  if (existingStart === -1 || existingEnd === -1) {
    merged = (existing.trim() ? existing.trimEnd() + '\n\n' : '') + kitContent + '\n';
  } else {
    merged = existing.slice(0, existingStart) + kitContent + existing.slice(existingEnd + END.length);
  }

  writeFile(agentsPath, merged);
}

function applySkills(proposal) {
  const skills = proposal.enabledFeatures?.skills || [];
  for (const skill of skills) {
    const srcDir = path.join(kitRoot, 'skills', skill);
    const destDir = path.join(target, '.agent-kit', 'skills', skill);
    if (fs.existsSync(srcDir)) {
      copyDir(srcDir, destDir);
    }
  }
}

function applyHooks(proposal, harness) {
  const hooksConfig = proposal.enabledFeatures?.hooks || {};
  const harnessHooksDir = path.join(target, getHarnessHooksDir(harness));

  for (const [hookName, enabled] of Object.entries(hooksConfig)) {
    if (!enabled) continue;
    const hookFile = path.join(kitRoot, 'hooks', `${hookName}.js`);
    if (fs.existsSync(hookFile)) {
      copyFile(hookFile, path.join(harnessHooksDir, `${hookName}.js`));
    }
  }
}

function getHarnessHooksDir(harness) {
  const map = {
    'codex': '.codex/hooks',
    'opencode': '.opencode/hooks',
    'kilo': '.kilocode/hooks',
    'cline': '.clinerules/hooks',
    'cursor': '.cursor/hooks',
    'gemini': '.gemini/hooks',
  };
  return map[harness] || '.agent-kit/hooks';
}

function applyMCP(proposal) {
  const mcpConfig = proposal.enabledFeatures?.mcp || {};
  const serversPath = path.join(kitRoot, 'mcp', 'servers.json');
  const servers = readJson(serversPath);

  const targetMCP = getTargetMCPPath();
  let existing = readJson(targetMCP) || { mcpServers: {} };

  for (const [serverName, enabled] of Object.entries(mcpConfig)) {
    if (!enabled) continue;
    if (servers.servers[serverName]) {
      existing.mcpServers[serverName] = servers.servers[serverName];
    }
  }

  writeFile(targetMCP, existing);
}

function getTargetMCPPath() {
  // Try common locations
  const locations = [
    '.mcp.json',
    '.cursor/mcp.json',
    '.claude/mcp.json',
    '.vscode/mcp.json',
    '.kilocode/mcp_settings.json',
  ];
  for (const loc of locations) {
    const full = path.join(target, loc);
    if (fs.existsSync(full)) return full;
  }
  return path.join(target, '.mcp.json');
}

function applyConfigFiles(proposal) {
  // Write kit config for reference
  const configPath = path.join(target, '.agent-kit', 'config.json');
  writeFile(configPath, proposal.config || {});

  // Write format/verify configs from recon
  if (proposal.formatConfig) {
    writeFile(path.join(target, '.agent-kit', 'format-config.json'), proposal.formatConfig);
  }
  if (proposal.verifyConfig) {
    writeFile(path.join(target, '.agent-kit', 'verify-config.json'), proposal.verifyConfig);
  }
}

function main() {
  console.log(`[apply] Target: ${target}`);
  console.log(`[apply] Kit root: ${kitRoot}`);
  console.log(`[apply] Dry run: ${dryRun}`);

  const proposal = loadProposal();

  // Apply each component
  applyAGENTS(proposal);
  applySkills(proposal);
  applyHooks(proposal, proposal.config?.harness || 'generic');
  applyMCP(proposal);
  applyConfigFiles(proposal);

  // Write manifest
  const { execSync } = require('child_process');
  const manifestScript = path.join(kitRoot, 'scripts', 'manifest.js');
  run(`node "${manifestScript}" write --target "${target}" --kit-root "${kitRoot}" --proposal "${proposalPath}"`);

  console.log('[apply] Done');
}

main();