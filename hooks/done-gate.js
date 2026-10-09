#!/usr/bin/env node
/**
 * Done-Gate Hook - Runs repo's test+lint before allowing "done"
 * Event: pre-completion / user-says-done
 * 
 * Runs repo's own test+lint command, blocks on failure
 * Max 2 retries, then reports instead of looping
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = process.env.GIT_ROOT || process.cwd();
const CONFIG_FILE = path.join(REPO_ROOT, '.agent-kit', 'verify-config.json');
const STATE_FILE = path.join(REPO_ROOT, '.agent-kit', 'done-gate-state.json');

function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch {}
  }
  return {};
}

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch {}
  }
  return { retries: 0 };
}

function saveState(state) {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function getVerifyCommand(config) {
  // Priority: config > package.json > Makefile > pyproject.toml > defaults
  if (config.verifyCommand) {
    return config.verifyCommand;
  }
  
  const pkgPath = path.join(REPO_ROOT, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      // Common patterns
      if (pkg.scripts && pkg.scripts.check) return pkg.scripts.check;
      if (pkg.scripts && pkg.scripts['test:ci']) return pkg.scripts['test:ci'];
      if (pkg.scripts && pkg.scripts.test && pkg.scripts.lint) {
        return `${pkg.scripts.lint} && ${pkg.scripts.test}`;
      }
      if (pkg.scripts && pkg.scripts.test) return pkg.scripts.test;
      if (pkg.scripts && pkg.scripts.lint) return pkg.scripts.lint;
    } catch {}
  }
  
  const makefilePath = path.join(REPO_ROOT, 'Makefile');
  if (fs.existsSync(makefilePath)) {
    const content = fs.readFileSync(makefilePath, 'utf8');
    if (content.includes('test:')) return 'make test';
    if (content.includes('check:')) return 'make check';
  }
  
  const pyprojectPath = path.join(REPO_ROOT, 'pyproject.toml');
  if (fs.existsSync(pyprojectPath)) {
    return 'ruff check && pytest';
  }
  
  const cargoPath = path.join(REPO_ROOT, 'Cargo.toml');
  if (fs.existsSync(cargoPath)) {
    return 'cargo test && cargo clippy';
  }
  
  const goModPath = path.join(REPO_ROOT, 'go.mod');
  if (fs.existsSync(goModPath)) {
    return 'go test ./... && go vet ./...';
  }
  
  return null;
}

function main() {
  const config = loadConfig();
  const state = loadState();
  const command = getVerifyCommand(config);
  
  if (!command) {
    console.log('DONE-GATE: No verify command configured, skipping');
    // Reset state on success
    saveState({ retries: 0 });
    process.exit(0);
  }
  
  console.log(`DONE-GATE: Running verify command: ${command}`);
  
  try {
    execSync(command, {
      cwd: REPO_ROOT,
      timeout: 120000, // 2 minute timeout
      stdio: 'inherit',
      shell: true,
    });
    
    console.log('DONE-GATE: Verify passed');
    saveState({ retries: 0 });
    process.exit(0);
  } catch (e) {
    state.retries = (state.retries || 0) + 1;
    saveState(state);
    
    console.error(`DONE-GATE: Verify failed (attempt ${state.retries}/2)`);
    
    if (state.retries >= 2) {
      console.error('DONE-GATE: Max retries reached. Reporting failure instead of looping.');
      console.error('Fix the issues above before marking done.');
      process.exit(1); // Block "done"
    }
    
    console.error('DONE-GATE: Retry allowed. Fix issues and try again.');
    process.exit(1); // Block "done" but allow retry
  }
}

main();