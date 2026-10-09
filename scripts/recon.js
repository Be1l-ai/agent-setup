#!/usr/bin/env node
/**
 * Recon Script - Detects target repo configuration (READ-ONLY)
 * Usage: node recon.js --target <path> --output <json-file> [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const targetIdx = args.indexOf('--target');
const outputIdx = args.indexOf('--output');
const target = targetIdx >= 0 ? args[targetIdx + 1] : process.cwd();
const output = outputIdx >= 0 ? args[outputIdx + 1] : '/tmp/recon-report.json';

function run(cmd, cwd = target) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch {
    return null;
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function exists(file) {
  return fs.existsSync(file);
}

function glob(pattern, cwd = target) {
  try {
    return run(`find . -path ./node_modules -prune -o -path ./.git -prune -o -name "${pattern}" -print`, cwd)
      .split('\n')
      .filter(Boolean)
      .map(p => p.replace(/^\.\//, ''));
  } catch {
    return [];
  }
}

function detectPackageManager() {
  if (exists(path.join(target, 'pnpm-lock.yaml'))) return 'pnpm';
  if (exists(path.join(target, 'yarn.lock'))) return 'yarn';
  if (exists(path.join(target, 'package-lock.json'))) return 'npm';
  if (exists(path.join(target, 'bun.lockb'))) return 'bun';
  if (exists(path.join(target, 'poetry.lock'))) return 'poetry';
  if (exists(path.join(target, 'Pipfile.lock'))) return 'pipenv';
  if (exists(path.join(target, 'requirements.txt'))) return 'pip';
  if (exists(path.join(target, 'Cargo.lock'))) return 'cargo';
  if (exists(path.join(target, 'go.mod'))) return 'go';
  if (exists(path.join(target, 'Makefile'))) return 'make';
  return 'unknown';
}

function detectCommands(pkgManager) {
  const commands = {};
  const pkgPath = path.join(target, 'package.json');
  if (exists(pkgPath)) {
    const pkg = readJson(pkgPath);
    if (pkg?.scripts) {
      const scriptMap = {
        test: ['test', 'test:ci', 'test:unit'],
        lint: ['lint', 'lint:check', 'eslint'],
        format: ['format', 'format:fix', 'prettier'],
        typecheck: ['typecheck', 'tsc', 'type-check'],
        build: ['build', 'compile'],
        check: ['check', 'ci', 'verify'],
      };
      for (const [key, aliases] of Object.entries(scriptMap)) {
        for (const alias of aliases) {
          if (pkg.scripts[alias]) {
            commands[key] = `${pkgManager} run ${alias}`;
            break;
          }
        }
      }
    }
  }
  // Makefile
  const makefile = path.join(target, 'Makefile');
  if (exists(makefile) && Object.keys(commands).length === 0) {
    const content = fs.readFileSync(makefile, 'utf8');
    if (content.includes('test:')) commands.test = 'make test';
    if (content.includes('check:')) commands.check = 'make check';
    if (content.includes('lint:')) commands.lint = 'make lint';
    if (content.includes('format:')) commands.format = 'make format';
  }
  // pyproject.toml
  const pyproject = path.join(target, 'pyproject.toml');
  if (exists(pyproject) && Object.keys(commands).length === 0) {
    commands.test = 'pytest';
    commands.lint = 'ruff check';
    commands.format = 'ruff format';
    commands.typecheck = 'mypy';
  }
  // Cargo.toml
  const cargo = path.join(target, 'Cargo.toml');
  if (exists(cargo) && Object.keys(commands).length === 0) {
    commands.test = 'cargo test';
    commands.lint = 'cargo clippy';
    commands.format = 'cargo fmt';
    commands.build = 'cargo build';
  }
  // go.mod
  const gomod = path.join(target, 'go.mod');
  if (exists(gomod) && Object.keys(commands).length === 0) {
    commands.test = 'go test ./...';
    commands.lint = 'go vet ./...';
    commands.format = 'gofmt -w .';
    commands.build = 'go build ./...';
  }
  return commands;
}

function detectCI() {
  const githubActions = glob('.github/workflows/*.yml').concat(glob('.github/workflows/*.yaml'));
  if (githubActions.length) return 'github-actions';
  if (exists(path.join(target, '.gitlab-ci.yml'))) return 'gitlab-ci';
  if (exists(path.join(target, '.circleci/config.yml'))) return 'circleci';
  if (exists(path.join(target, 'azure-pipelines.yml'))) return 'azure-pipelines';
  if (exists(path.join(target, 'Jenkinsfile'))) return 'jenkins';
  return 'none';
}

function detectMonorepo() {
  const workspaces = [];
  const pkgPath = path.join(target, 'package.json');
  if (exists(pkgPath)) {
    const pkg = readJson(pkgPath);
    if (pkg?.workspaces?.packages) {
      workspaces.push(...pkg.workspaces.packages.map(p => p.replace('/*', '')));
    }
  }
  if (exists(path.join(target, 'pnpm-workspace.yaml'))) return { type: 'pnpm', packages: workspaces };
  if (exists(path.join(target, 'turbo.json'))) return { type: 'turborepo', packages: workspaces };
  if (exists(path.join(target, 'nx.json'))) return { type: 'nx', packages: workspaces };
  if (exists(path.join(target, 'lerna.json'))) return { type: 'lerna', packages: workspaces };
  if (workspaces.length) return { type: 'npm/yarn', packages: workspaces };
  return { type: 'none', packages: [] };
}

function detectLanguages() {
  const langs = new Set();
  const exts = {
    '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
    '.py': 'python', '.rs': 'rust', '.go': 'go', '.java': 'java', '.kt': 'kotlin',
    '.rb': 'ruby', '.php': 'php', '.cs': 'csharp', '.cpp': 'cpp', '.c': 'c',
    '.swift': 'swift', '.dart': 'dart', '.scala': 'scala', '.clj': 'clojure',
  };
  for (const [ext, lang] of Object.entries(exts)) {
    if (glob(`*${ext}`).length > 0) langs.add(lang);
  }
  return Array.from(langs);
}

function detectFrameworks() {
  const frameworks = [];
  const pkgPath = path.join(target, 'package.json');
  if (exists(pkgPath)) {
    const pkg = readJson(pkgPath);
    const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
    const fwMap = {
      'next': 'Next.js', 'react': 'React', 'vue': 'Vue', 'svelte': 'Svelte',
      'express': 'Express', 'fastify': 'Fastify', 'nestjs': 'NestJS',
      'astro': 'Astro', 'remix': 'Remix', 'gatsby': 'Gatsby',
      'vitest': 'Vitest', 'jest': 'Jest', 'playwright': 'Playwright',
      'cypress': 'Cypress', 'tailwindcss': 'Tailwind CSS',
      'typescript': 'TypeScript', 'eslint': 'ESLint', 'prettier': 'Prettier',
    };
    for (const [dep, fw] of Object.entries(fwMap)) {
      if (deps[dep]) frameworks.push(fw);
    }
  }
  return [...new Set(frameworks)];
}

function detectExistingAgentFiles() {
  const files = [];
  const patterns = [
    'AGENTS.md', 'AGENT.md', 'CLAUDE.md', '.cursor/rules/**', '.mcp.json',
    '.claude/**', '.codex/**', '.opencode/**', '.kilocode/**', '.cline/**',
    '.agents/**', '.clinerules/**', '.vscode/cline/**', 'kilo.jsonc', 'opencode.json',
  ];
  for (const pattern of patterns) {
    const matches = glob(pattern);
    if (matches.length) files.push(...matches);
  }
  return [...new Set(files)];
}

function getGitStatus() {
  const status = run('git status --porcelain');
  const branch = run('git branch --show-current');
  const root = run('git rev-parse --show-toplevel');
  return { clean: !status, status: status?.split('\n').filter(Boolean) || [], branch, root };
}

function main() {
  console.log(`[recon] Scanning ${target}...`);

  const pkgManager = detectPackageManager();
  const commands = detectCommands(pkgManager);
  const ci = detectCI();
  const monorepo = detectMonorepo();
  const languages = detectLanguages();
  const frameworks = detectFrameworks();
  const existingAgentFiles = detectExistingAgentFiles();
  const gitStatus = getGitStatus();

  const report = {
    target: path.resolve(target),
    timestamp: new Date().toISOString(),
    packageManager: pkgManager,
    commands,
    ci,
    monorepo,
    languages,
    frameworks,
    existingAgentFiles,
    gitStatus,
    hasNode: exists(path.join(target, 'package.json')),
    hasPython: exists(path.join(target, 'pyproject.toml')) || exists(path.join(target, 'requirements.txt')),
    hasRust: exists(path.join(target, 'Cargo.toml')),
    hasGo: exists(path.join(target, 'go.mod')),
    hasMake: exists(path.join(target, 'Makefile')),
  };

  if (!dryRun) {
    fs.writeFileSync(output, JSON.stringify(report, null, 2));
    console.log(`[recon] Report written to ${output}`);
  } else {
    console.log('[recon] Dry run - report:');
    console.log(JSON.stringify(report, null, 2));
  }
}

main();