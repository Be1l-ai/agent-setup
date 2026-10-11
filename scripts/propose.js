#!/usr/bin/env node
/**
 * Propose: builds proposal.json from a recon report and kit.config.json.
 * Makes NO changes to the target.
 *
 * Usage: node propose.js --recon <recon.json> [--config kit.config.json] --output <proposal.json>
 */

const fs = require('fs');
const path = require('path');
const lib = require('./lib');

const args = lib.parseArgs(process.argv.slice(2));
const reconPath = args.recon;
const configPath = args.config || path.join(lib.KIT_ROOT, 'kit.config.json');
const outputPath = args.output || '/tmp/proposal.json';

function fail(msg) {
  console.error(`[propose] ${msg}`);
  process.exit(1);
}

if (!reconPath) fail('--recon <recon.json> is required');
const recon = lib.readJson(reconPath);
if (!recon) fail(`cannot read recon report: ${reconPath}`);
const config = lib.readJson(configPath);
if (!config) fail(`cannot parse kit config (must be valid JSON): ${configPath}`); // fail closed

const harness = config.harness || 'generic';
if (!lib.SUPPORTED_HARNESSES.includes(harness)) {
  fail(`harness "${harness}" has no verified integration. Supported: ${lib.SUPPORTED_HARNESSES.join(', ')}`);
}

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

// Skills: only the profiles listed in config. Empty list = no skills.
const skills = [];
for (const profile of config.profiles || []) {
  if (!has(lib.PROFILE_SKILLS, profile)) {
    console.error(`[propose] unknown profile "${profile}" ignored`);
    continue;
  }
  for (const name of lib.PROFILE_SKILLS[profile]) {
    if (name === 'frontend-design' && !(recon.frameworks || []).some(f => /React|Vue|Svelte|Next|Astro|Remix|Tailwind/.test(f))) {
      continue; // UI skill only for UI repos
    }
    if (!skills.includes(name)) skills.push(name);
  }
}

// Hooks: explicit true only. Missing key = off.
const hooks = lib.HOOK_NAMES.filter(h => config.hooks && config.hooks[h] === true);

// MCP: only servers explicitly enabled and present in mcp/servers.json.
const catalog = lib.readJson(path.join(lib.KIT_ROOT, 'mcp', 'servers.json')) || { servers: {} };
const mcpServers = Object.keys(config.mcp || {}).filter(
  name => config.mcp[name] === true && has(catalog.servers, name)
);

const verifyCommand = (config.verifyCommand || (recon.commands && (recon.commands.check || recon.commands.test || recon.commands.lint)) || null);
const detectedCommands = (recon.commands && typeof recon.commands === 'object') ? recon.commands : {};

// Files the apply step will write. Paths are repo-relative.
const files = [];
files.push({ path: 'AGENTS.md', action: 'merge' });
if (harness === 'opencode') {
  // Native OpenCode plugin: guard only. Done-gate/format/session-start are standalone scripts.
  if (hooks.includes('guard')) {
    // V1 single-file layout (backward compatible)
    files.push({ path: '.opencode/plugins/agent-kit-guard.mjs', action: 'create', source: 'plugins/opencode/agent-kit-guard.mjs' });
    files.push({ path: '.opencode/plugins/agent-kit-guard-core.mjs', action: 'create', source: 'plugins/opencode/agent-kit-guard-core.mjs' });
    // V2 directory layout (ensures the plugin actually loads)
    files.push({ path: '.opencode/plugins/agent-kit-guard/index.mjs', action: 'create', source: 'plugins/opencode/agent-kit-guard/index.mjs' });
    files.push({ path: '.opencode/plugins/agent-kit-guard/agent-kit-guard-core.mjs', action: 'create', source: 'plugins/opencode/agent-kit-guard/agent-kit-guard-core.mjs' });
  }
  files.push({ path: 'opencode.json', action: 'merge' }); // permission + plugin registration
}
if (mcpServers.length && harness !== 'opencode') {
  files.push({ path: '.mcp.json', action: 'merge' });
}
for (const skill of skills) {
  files.push({ path: `.agent-kit/skills/${skill}`, action: 'create-dir', source: `skills/${skill}` });
}
files.push({ path: '.agent-kit/config.json', action: 'create' });
files.push({ path: '.agent-kit/format-config.json', action: 'create' });
files.push({ path: '.agent-kit/verify-config.json', action: 'create' });
files.push({ path: '.agent-kit/.gitignore', action: 'create' });

// Plugins registered in opencode.json "plugin". Directory auto-discovery of
// .opencode/plugins/ did NOT load in opencode 1.18.35 (verified); explicit registration does.
const pluginEntries = hooks.includes('guard') && harness === 'opencode'
  ? ['./.opencode/plugins/agent-kit-guard.mjs']
  : [];

// Permission rules merged into opencode.json. Hard denies enforced by the harness.
const permission = harness === 'opencode' ? {
  bash: {
    '*': 'allow',
    'rm -rf *': 'deny',
    'rm -fr *': 'deny',
    'git push * --force*': 'deny',
    'git push -f*': 'deny',
    'git push * -f*': 'deny',
    'git push * +*': 'deny',
    'npm publish*': 'ask',
    'yarn publish*': 'ask',
    'pnpm publish*': 'ask',
    'cat .env*': 'deny',
    'cat *.pem': 'deny',
    'cat *.key': 'deny',
  },
  read: {
    '*': 'allow',
    '*.env': 'deny',
    '*.env.*': 'deny',
    '*.pem': 'deny',
    '*.key': 'deny',
  },
} : null;

const proposal = {
  version: 1,
  target: recon.target,
  harness,
  os: config.os || 'linux',
  skills,
  hooks,
  mcpServers,
  verifyCommand,
  detectedCommands,
  formatters: lib.DEFAULT_FORMATTERS,
  permission,
  plugins: pluginEntries,
  files,
  // Stable hash input: everything above, no timestamp.
  notes: [
    'OpenCode: guard installs as a native plugin (tool.execute.before). Verified against opencode 1.18.35.',
    'OpenCode: permission block is merged into opencode.json and enforced by the harness.',
    'Other harnesses: no integration installed. Hooks are not registered.',
    'done-gate, format-on-edit, session-start are standalone scripts, not auto-registered.',
  ],
};

// Hash covers the body only; generatedAt is added after and is not part of the hash.
proposal.hash = lib.sha256(Buffer.from(JSON.stringify(proposal)));
proposal.generatedAt = new Date().toISOString();

fs.writeFileSync(outputPath, JSON.stringify(proposal, null, 2));
console.log(`[propose] Wrote ${outputPath}`);
console.log(`[propose] Harness: ${harness}`);
console.log(`[propose] Skills: ${skills.join(', ') || 'none'}`);
console.log(`[propose] Hooks: ${hooks.join(', ') || 'none'}`);
console.log(`[propose] MCP: ${mcpServers.join(', ') || 'none'}`);
console.log(`[propose] Verify command: ${verifyCommand || 'NONE (done-gate will fail closed)'}`);
