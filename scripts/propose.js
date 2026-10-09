#!/usr/bin/env node
/**
 * Propose Script - Generates proposal from recon report + kit config
 * Usage: node propose.js --recon <path> --config <path> --output <path> [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const reconIdx = args.indexOf('--recon');
const configIdx = args.indexOf('--config');
const outputIdx = args.indexOf('--output');
const reconPath = reconIdx >= 0 ? args[reconIdx + 1] : '/tmp/recon-report.json';
const configPath = configIdx >= 0 ? args[configIdx + 1] : path.join(__dirname, '..', 'kit.config.yaml');
const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : '/tmp/proposal.md';

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function readYaml(file) {
  try {
    return yaml.load(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function writeFile(file, content) {
  if (dryRun) {
    console.log(`[propose] DRY RUN: Would write ${file}`);
    return;
  }
  fs.writeFileSync(file, content);
  console.log(`[propose] Proposal written to ${file}`);
}

function loadKitConfig() {
  return readYaml(configPath);
}

function loadRecon() {
  return readJson(reconPath);
}

function determineSkills(recon, config) {
  const skills = [];
  const profiles = config.profiles || [];

  // Always include core debugging skills
  if (profiles.includes('debugging') || profiles.length === 0) {
    skills.push('systematic-debugging', 'test-driven-development');
  }
  if (profiles.includes('code-review') || profiles.length === 0) {
    skills.push('receiving-code-review');
  }
  if (profiles.includes('branch') || profiles.length === 0) {
    skills.push('finishing-a-development-branch');
  }

  // Security review for all
  skills.push('claude-code-security-review');

  // Frontend design only for UI repos
  const hasUI = recon.frameworks.some(f => ['React', 'Vue', 'Svelte', 'Next.js', 'Astro', 'Remix', 'Tailwind CSS'].includes(f));
  if (hasUI) {
    skills.push('frontend-design');
  }

  return [...new Set(skills)];
}

function determineHooks(config) {
  const hooks = config.hooks || {};
  return {
    guard: hooks.guard !== false,
    format_on_edit: hooks.format_on_edit !== false,
    done_gate: hooks.done_gate !== false,
    session_start: hooks.session_start === true,
  };
}

function determineMCP(config) {
  const mcp = config.mcp || {};
  return {
    context7: mcp.context7 === true,
    playwright: mcp.playwright === true,
    github: mcp.github === true,
  };
}

function determinePlugins(config) {
  const plugins = config.plugins || {};
  return {
    claude_mem: plugins.claude_mem === true,
    caveman: plugins.caveman === true,
    ponytail: plugins.ponytail === true,
  };
}

function generateProposal(recon, config) {
  const skills = determineSkills(recon, config);
  const hooks = determineHooks(config);
  const mcp = determineMCP(config);
  const plugins = determinePlugins(config);

  const createdFiles = [];
  const modifiedFiles = [];
  const beforeHashes = {};

  // AGENTS.md
  if (recon.existingAgentFiles.includes('AGENTS.md')) {
    modifiedFiles.push('AGENTS.md');
    beforeHashes['AGENTS.md'] = 'existing';
  } else {
    createdFiles.push('AGENTS.md');
  }

  // Skills
  for (const skill of skills) {
    createdFiles.push(`.agent-kit/skills/${skill}/SKILL.md`);
  }

  // Hooks
  const harness = config.harness || 'generic';
  const hooksDir = {
    'codex': '.codex/hooks',
    'opencode': '.opencode/hooks',
    'kilo': '.kilocode/hooks',
    'cline': '.clinerules/hooks',
    'cursor': '.cursor/hooks',
    'gemini': '.gemini/hooks',
  }[harness] || '.agent-kit/hooks';

  for (const [hook, enabled] of Object.entries(hooks)) {
    if (enabled) {
      createdFiles.push(`${hooksDir}/${hook}.js`);
    }
  }

  // MCP config
  const mcpFiles = ['.mcp.json', '.cursor/mcp.json', '.claude/mcp.json'];
  for (const mcpFile of mcpFiles) {
    if (recon.existingAgentFiles.some(f => f === mcpFile || f.startsWith(mcpFile.replace('.json', '')))) {
      modifiedFiles.push(mcpFile);
    }
  }

  // Config files
  createdFiles.push('.agent-kit/config.json');
  createdFiles.push('.agent-kit/format-config.json');
  createdFiles.push('.agent-kit/verify-config.json');

  return {
    target: recon.target,
    timestamp: new Date().toISOString(),
    kitConfig: config,
    reconSummary: {
      packageManager: recon.packageManager,
      commands: recon.commands,
      ci: recon.ci,
      monorepo: recon.monorepo,
      languages: recon.languages,
      frameworks: recon.frameworks,
      existingAgentFiles: recon.existingAgentFiles,
      gitClean: recon.gitStatus.clean,
    },
    enabledFeatures: {
      skills,
      hooks,
      mcp,
      plugins,
    },
    config: {
      harness: config.harness || 'generic',
      os: config.os || 'linux',
    },
    createdFiles,
    modifiedFiles,
    beforeHashes,
    formatConfig: {
      formatters: {
        '.js': 'prettier --write',
        '.ts': 'prettier --write',
        '.json': 'prettier --write',
        '.py': 'ruff format',
        '.rs': 'rustfmt',
        '.go': 'gofmt -w',
      },
    },
    verifyConfig: {
      verifyCommand: recon.commands.check || recon.commands.test || recon.commands.lint,
    },
    unverified: [],
  };
}

function formatProposal(proposal) {
  let md = `# Agent Kit Apply Proposal\n\n`;
  md += `**Target:** ${proposal.target}\n`;
  md += `**Generated:** ${proposal.timestamp}\n`;
  md += `**Harness:** ${proposal.config.harness}\n`;
  md += `**OS:** ${proposal.config.os}\n\n`;

  md += `## Recon Summary\n\n`;
  md += `- **Package Manager:** ${proposal.reconSummary.packageManager}\n`;
  md += `- **Commands:** ${Object.entries(proposal.reconSummary.commands).map(([k, v]) => `${k}=${v}`).join(', ') || 'none detected'}\n`;
  md += `- **CI:** ${proposal.reconSummary.ci}\n`;
  md += `- **Monorepo:** ${proposal.reconSummary.monorepo.type} (${proposal.reconSummary.monorepo.packages.length} packages)\n`;
  md += `- **Languages:** ${proposal.reconSummary.languages.join(', ') || 'none'}\n`;
  md += `- **Frameworks:** ${proposal.reconSummary.frameworks.join(', ') || 'none'}\n`;
  md += `- **Existing Agent Files:** ${proposal.reconSummary.existingAgentFiles.join(', ') || 'none'}\n`;
  md += `- **Git Clean:** ${proposal.reconSummary.gitClean ? 'Yes' : 'NO - abort!'}\n\n`;

  md += `## Features to Enable\n\n`;
  md += `### Skills (${proposal.enabledFeatures.skills.length})\n`;
  for (const skill of proposal.enabledFeatures.skills) {
    md += `- ${skill}\n`;
  }
  md += `\n`;

  md += `### Hooks\n`;
  for (const [hook, enabled] of Object.entries(proposal.enabledFeatures.hooks)) {
    md += `- ${hook}: ${enabled ? 'ON' : 'OFF'}\n`;
  }
  md += `\n`;

  md += `### MCP Servers\n`;
  for (const [server, enabled] of Object.entries(proposal.enabledFeatures.mcp)) {
    md += `- ${server}: ${enabled ? 'ON' : 'OFF'}\n`;
  }
  md += `\n`;

  md += `### Plugins (all OFF by default)\n`;
  for (const [plugin, enabled] of Object.entries(proposal.enabledFeatures.plugins)) {
    md += `- ${plugin}: ${enabled ? 'ON' : 'OFF'}\n`;
  }
  md += `\n`;

  md += `## Files to Create (${proposal.createdFiles.length})\n`;
  for (const file of proposal.createdFiles) {
    md += `- ${file}\n`;
  }
  md += `\n`;

  md += `## Files to Modify (${proposal.modifiedFiles.length})\n`;
  for (const file of proposal.modifiedFiles) {
    md += `- ${file}\n`;
  }
  md += `\n`;

  if (proposal.unverified.length > 0) {
    md += `## UNVERIFIED Items\n`;
    for (const item of proposal.unverified) {
      md += `- ${item}\n`;
    }
    md += `\n`;
  }

  md += `## Next Steps\n`;
  md += `1. Review this proposal\n`;
  md += `2. If approved, run: \`node scripts/apply.js --target ${proposal.target} --proposal ${outputPath} --kit-root <kit-root>\`\n`;
  md += `3. Verify with: \`node scripts/verify.js --target ${proposal.target} --phase after --commands '<commands>'\`\n`;

  return md;
}

function main() {
  console.log(`[propose] Reading recon from ${reconPath}`);
  console.log(`[propose] Reading config from ${configPath}`);

  const recon = loadRecon();
  const config = loadKitConfig();

  if (!recon) {
    console.error('[propose] Failed to load recon');
    process.exit(1);
  }

  if (!recon.gitStatus.clean) {
    console.error('[propose] Git working tree not clean - aborting');
    process.exit(1);
  }

  const proposal = generateProposal(recon, config);
  const md = formatProposal(proposal);

  // Also write JSON for apply script
  const jsonPath = outputPath.replace('.md', '.json');
  if (!dryRun) {
    fs.writeFileSync(jsonPath, JSON.stringify(proposal, null, 2));
  }

  writeFile(outputPath, md);
}

main();