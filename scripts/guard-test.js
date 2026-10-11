#!/usr/bin/env node
/**
 * Guard rules test. Plain Node, no harness needed.
 *
 *   node scripts/guard-test.js
 *
 * Checks plugins/opencode/agent-kit-guard-core.mjs against a table of commands and
 * paths. Expected values are what the guard SHOULD do, not what it currently does.
 */

const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');

let failures = 0;
let checks = 0;

async function main() {
  const { checkToolCall } = await import(
    pathToFileURL(path.join(ROOT, 'plugins', 'opencode', 'agent-kit-guard-core.mjs')).href
  );

  const root = '/repo';
  const blocked = (tool, args, label) => {
    checks++;
    if (!checkToolCall(root, tool, args)) {
      failures++;
      console.log(`FAIL  should BLOCK  ${label}`);
    }
  };
  const allowed = (tool, args, label) => {
    checks++;
    if (checkToolCall(root, tool, args)) {
      failures++;
      console.log(`FAIL  should ALLOW  ${label}  -> ${checkToolCall(root, tool, args)}`);
    }
  };

  console.log('--- destructive rm');
  blocked('bash', { command: 'rm -rf /' }, 'rm -rf /');
  blocked('bash', { command: 'rm -rf /etc' }, 'rm -rf /etc');
  blocked('bash', { command: 'rm -fr /etc' }, 'rm -fr /etc');
  blocked('bash', { command: 'rm -r -f /tmp/x' }, 'rm -r -f /tmp/x');
  blocked('bash', { command: 'rm --recursive --force /' }, 'rm --recursive --force /');
  blocked('bash', { command: 'rm -rf ../../x' }, 'rm -rf ../../x');
  blocked('bash', { command: 'rm -rf .' }, 'rm -rf .');
  blocked('bash', { command: 'rm -rf ~' }, 'rm -rf ~');
  allowed('bash', { command: 'rm -rf node_modules/.bin' }, 'rm -rf node_modules/.bin');
  allowed('bash', { command: 'rm file.txt' }, 'rm file.txt');
  allowed('bash', { command: 'rm -f file.txt' }, 'rm -f file.txt');
  allowed('bash', { command: 'npm run clean' }, 'npm run clean');

  console.log('--- shell wrappers');
  blocked('bash', { command: 'bash -c "rm -rf /"' }, 'bash -c');
  blocked('bash', { command: 'sh -c "rm -rf ~"' }, 'sh -c');
  blocked('bash', { command: 'sudo rm -rf /' }, 'sudo rm');
  blocked('bash', { command: 'echo $(rm -rf /)' }, 'command substitution');
  blocked('bash', { command: 'ls && rm -rf /' }, 'chained after &&');

  console.log('--- git');
  blocked('bash', { command: 'git push -f origin main' }, 'git push -f');
  blocked('bash', { command: 'git push --force origin main' }, 'git push --force');
  blocked('bash', { command: 'git push origin main --force-with-lease' }, 'git push --force-with-lease');
  blocked('bash', { command: 'git push origin +main' }, 'git push +refspec');
  blocked('bash', { command: 'git push --mirror origin' }, 'git push --mirror');
  allowed('bash', { command: 'git push origin main' }, 'git push (normal)');
  allowed('bash', { command: 'git commit -m "fix"' }, 'git commit');

  console.log('--- secrets');
  blocked('read', { filePath: '.env' }, 'read .env');
  blocked('read', { filePath: './.env' }, 'read ./.env');
  blocked('read', { filePath: '.envrc' }, 'read .envrc');
  blocked('read', { filePath: 'certs/server.pem' }, 'read .pem');
  blocked('read', { filePath: 'config/secrets.yaml' }, 'read secrets.yaml');
  blocked('read', { filePath: 'id_rsa' }, 'read id_rsa');
  blocked('bash', { command: 'cat .env' }, 'cat .env');
  blocked('bash', { command: 'head -5 .env' }, 'head .env');
  blocked('write', { filePath: '.env' }, 'write .env');
  allowed('read', { filePath: 'src/tokenizer.js' }, 'read tokenizer.js');
  allowed('read', { filePath: 'src/app.js' }, 'read app.js');
  allowed('bash', { command: 'grep token src/tokenizer.js' }, 'grep tokenizer.js');

  console.log('--- kit-protected paths');
  blocked('write', { filePath: '.agent-kit/approvals.json' }, 'write approvals.json');
  blocked('write', { filePath: '.agent-kit/config.json' }, 'write kit config');
  blocked('write', { filePath: '.opencode/plugins/agent-kit-guard.mjs' }, 'write guard plugin');
  blocked('write', { filePath: '.opencode/hooks/x.js' }, 'write hook dir');
  blocked('write', { filePath: '.git/hooks/pre-commit' }, 'write git hook');
  blocked('write', { filePath: 'opencode.json' }, 'write opencode.json');
  blocked('bash', { command: 'echo x > .agent-kit/approvals.json' }, 'redirect into approvals.json');
  blocked('bash', { command: 'echo x >.opencode/plugins/agent-kit-guard.mjs' }, 'redirect without space');
  blocked('bash', { command: 'cp /tmp/x .agent-kit/config.json' }, 'cp into kit config');
  allowed('read', { filePath: '.agent-kit/manifest.json' }, 'read manifest');
  allowed('bash', { command: 'cat .agent-kit/manifest.json' }, 'cat manifest');
  allowed('write', { filePath: 'src/app.js' }, 'write source file');

  console.log('--- deploy and publish');
  blocked('bash', { command: 'npm publish' }, 'npm publish');
  blocked('bash', { command: 'pnpm publish' }, 'pnpm publish');
  blocked('bash', { command: 'kubectl apply -f k8s/' }, 'kubectl apply');
  blocked('bash', { command: 'terraform destroy' }, 'terraform destroy');
  blocked('bash', { command: 'vercel deploy' }, 'vercel deploy');

  console.log('--- unknown tools are not blocked');
  allowed('someOtherTool', { path: '.env' }, 'unknown tool');

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures) {
    console.log(`${failures} FAILURES`);
    process.exit(1);
  }
  console.log('guard: ALL CHECKS PASSED');
}

main();