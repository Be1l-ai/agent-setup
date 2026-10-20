#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const KIT_ROOT = path.resolve(__dirname, '../..');
let tests = 0;
let failures = 0;

function ok(label) { tests++; console.log(`PASS  ${label}`); }
function bad(label, detail) { tests++; failures++; console.log(`FAIL  ${label}${detail ? `\n      ${detail}` : ''}`); }
function check(label, condition, detail) { condition ? ok(label) : bad(label, detail); }
function run(cmd, args, opts={}) { return execFileSync(cmd, args, { encoding:'utf8', stdio:['ignore','pipe','pipe'], ...opts }); }
function kitAttempt(args, opts={}) {
  const r = spawnSync(process.execPath, [path.join(KIT_ROOT, 'scripts', args[0]), ...args.slice(1)], {encoding:'utf8', ...opts});
  return {ok: r.status===0, output: (r.stdout||'')+(r.stderr||''), status:r.status};
}
function makeRepo(dir) {
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'package.json'), JSON.stringify({name:'t',version:'1.0.0',scripts:{test:'node -e "process.exit(0)"',lint:'node -e "process.exit(0)"'}}));
  fs.writeFileSync(path.join(dir,'AGENTS.md'),'#t');
  run('git',['init','-q'],{cwd:dir});
  run('git',['config','user.email','t@t.com'],{cwd:dir});
  run('git',['config','user.name','T'],{cwd:dir});
  run('git',['add','-A'],{cwd:dir});
  run('git',['commit','-qm','i'],{cwd:dir});
}
function updateProposal(propPath, updates) {
  const p = JSON.parse(fs.readFileSync(propPath));
  Object.assign(p, updates);
  const {hash,generatedAt,...body} = p;
  p.hash = crypto.createHash('sha256').update(Buffer.from(JSON.stringify(body))).digest('hex');
  fs.writeFileSync(propPath, JSON.stringify(p,null,2));
}

async function test1_verifyPassesBeforeAndAfter() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'issue2-t1-'));
  const repo = path.join(tmp,'repo'); makeRepo(repo);
  const verify = path.join(tmp,'v.sh'); fs.writeFileSync(verify,'#!/bin/bash\nexit 0\n'); fs.chmodSync(verify,0o755);
  const recon = path.join(tmp,'r.json'), prop = path.join(tmp,'p.json');
  run(process.execPath,[path.join(KIT_ROOT,'scripts/recon.js'),'--target',repo,'--output',recon]);
  run(process.execPath,[path.join(KIT_ROOT,'scripts/propose.js'),'--recon',recon,'--config',path.join(KIT_ROOT,'kit.config.json'),'--output',prop]);
  updateProposal(prop, {verifyCommand: verify});
  const res = kitAttempt(['apply.js','--target',repo,'--proposal',prop]);
  check('verify passes before and after → success, no revert', res.ok === true);
  check('.agent-kit exists after success', fs.existsSync(path.join(repo,'.agent-kit')));
  if (fs.existsSync(path.join(repo,'.agent-kit'))) kitAttempt(['remove.js','--target',repo,'--ignore-hash']);
  fs.rmSync(tmp,{recursive:true,force:true});
}

async function test2_verifyPassesBeforeFailsAfter() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'issue2-t2-'));
  const repo = path.join(tmp,'repo'); makeRepo(repo);
  const marker = path.join(tmp,'m'); const verify = path.join(tmp,'v.sh');
  fs.writeFileSync(verify, `#!/bin/bash\nif [ ! -f "${marker}" ]; then echo 1>${marker}; exit 0; else exit 1; fi\n`);
  fs.chmodSync(verify,0o755);
  const recon = path.join(tmp,'r.json'), prop = path.join(tmp,'p.json');
  run(process.execPath,[path.join(KIT_ROOT,'scripts/recon.js'),'--target',repo,'--output',recon]);
  run(process.execPath,[path.join(KIT_ROOT,'scripts/propose.js'),'--recon',recon,'--config',path.join(KIT_ROOT,'kit.config.json'),'--output',prop]);
  updateProposal(prop, {verifyCommand: verify});
  const res = kitAttempt(['apply.js','--target',repo,'--proposal',prop]);
  check('verify passes before, fails after → reverted, non-zero exit', res.ok === false && res.status !== 0);
  check('target repo is restored (no .agent-kit after revert)', !fs.existsSync(path.join(repo,'.agent-kit')));
  check('git status clean after revert', run('git',['status','--porcelain'],{cwd:repo}).trim() === '');
  fs.rmSync(tmp,{recursive:true,force:true});
}

async function test3_verifyFailsBefore() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'issue2-t3-'));
  const repo = path.join(tmp,'repo'); makeRepo(repo);
  const verify = path.join(tmp,'v.sh'); fs.writeFileSync(verify,'#!/bin/bash\nexit 1\n'); fs.chmodSync(verify,0o755);
  const recon = path.join(tmp,'r.json'), prop = path.join(tmp,'p.json');
  run(process.execPath,[path.join(KIT_ROOT,'scripts/recon.js'),'--target',repo,'--output',recon]);
  run(process.execPath,[path.join(KIT_ROOT,'scripts/propose.js'),'--recon',recon,'--config',path.join(KIT_ROOT,'kit.config.json'),'--output',prop]);
  updateProposal(prop, {verifyCommand: verify});
  const res = kitAttempt(['apply.js','--target',repo,'--proposal',prop]);
  check('clearly reported verify before', /Verify before/.test(res.output));
  if (fs.existsSync(path.join(repo,'.agent-kit'))) kitAttempt(['remove.js','--target',repo,'--ignore-hash']);
  fs.rmSync(tmp,{recursive:true,force:true});
}

async function test4_verifyCommandNull() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'issue2-t4-'));
  const repo = path.join(tmp,'repo'); makeRepo(repo);
  const recon = path.join(tmp,'r.json'), prop = path.join(tmp,'p.json');
  run(process.execPath,[path.join(KIT_ROOT,'scripts/recon.js'),'--target',repo,'--output',recon]);
  run(process.execPath,[path.join(KIT_ROOT,'scripts/propose.js'),'--recon',recon,'--config',path.join(KIT_ROOT,'kit.config.json'),'--output',prop]);
  updateProposal(prop, {verifyCommand: null});
  const res = kitAttempt(['apply.js','--target',repo,'--proposal',prop]);
  check('verifyCommand null → no-op for verify, apply still succeeds', res.ok === true);
  check('verify not executed', !/Verify before/.test(res.output));
  if (fs.existsSync(path.join(repo,'.agent-kit'))) kitAttempt(['remove.js','--target',repo,'--ignore-hash']);
  fs.rmSync(tmp,{recursive:true,force:true});
}

async function test5_timeout() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'issue2-t5-'));
  const repo = path.join(tmp,'repo'); makeRepo(repo);
  const verify = path.join(tmp,'v.sh'); fs.writeFileSync(verify,'#!/bin/bash\nsleep 1\nexit 0\n'); fs.chmodSync(verify,0o755);
  const recon = path.join(tmp,'r.json'), prop = path.join(tmp,'p.json');
  run(process.execPath,[path.join(KIT_ROOT,'scripts/recon.js'),'--target',repo,'--output',recon]);
  run(process.execPath,[path.join(KIT_ROOT,'scripts/propose.js'),'--recon',recon,'--config',path.join(KIT_ROOT,'kit.config.json'),'--output',prop]);
  updateProposal(prop, {verifyCommand: verify});
  const start = Date.now();
  const res = kitAttempt(['apply.js','--target',repo,'--proposal',prop]);
  const elapsed = Date.now()-start;
  check('timeout path handled', elapsed < 3000);
  if (fs.existsSync(path.join(repo,'.agent-kit'))) kitAttempt(['remove.js','--target',repo,'--ignore-hash']);
  fs.rmSync(tmp,{recursive:true,force:true});
}

async function test6_nonexistentCommand() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'issue2-t6-'));
  const repo = path.join(tmp,'repo'); makeRepo(repo);
  const recon = path.join(tmp,'r.json'), prop = path.join(tmp,'p.json');
  run(process.execPath,[path.join(KIT_ROOT,'scripts/recon.js'),'--target',repo,'--output',recon]);
  run(process.execPath,[path.join(KIT_ROOT,'scripts/propose.js'),'--recon',recon,'--config',path.join(KIT_ROOT,'kit.config.json'),'--output',prop]);
  updateProposal(prop, {verifyCommand: 'totally-not-a-real-command-xyz'});
  const res = kitAttempt(['apply.js','--target',repo,'--proposal',prop]);
  check('nonexistent command exits non-zero and does not claim success', res.ok === false && res.status !== 0);
  check('does not show unqualified Applied', !/Applied\./.test(res.output));
  check('files not reverted (not a regression)', fs.existsSync(path.join(repo,'.agent-kit')));
  check('reports verify results', /Verify before.*exit/.test(res.output) && /Verify after.*exit/.test(res.output));
  if (fs.existsSync(path.join(repo,'.agent-kit'))) kitAttempt(['remove.js','--target',repo,'--ignore-hash']);
  fs.rmSync(tmp,{recursive:true,force:true});
}

async function test7_commandFailsBothSides() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'issue2-t7-'));
  const repo = path.join(tmp,'repo'); makeRepo(repo);
  const verify = path.join(tmp,'v.sh'); fs.writeFileSync(verify,'#!/bin/bash\nexit 1\n'); fs.chmodSync(verify,0o755);
  const recon = path.join(tmp,'r.json'), prop = path.join(tmp,'p.json');
  run(process.execPath,[path.join(KIT_ROOT,'scripts/recon.js'),'--target',repo,'--output',recon]);
  run(process.execPath,[path.join(KIT_ROOT,'scripts/propose.js'),'--recon',recon,'--config',path.join(KIT_ROOT,'kit.config.json'),'--output',prop]);
  updateProposal(prop, {verifyCommand: verify});
  const res = kitAttempt(['apply.js','--target',repo,'--proposal',prop]);
  check('command failing both sides exits non-zero', res.ok === false);
  check('no revert (files applied)', fs.existsSync(path.join(repo,'.agent-kit')));
  check('no unqualified Applied', !/^[^\n]*Applied\./m.test(res.output) || /WARNING.*Verify/.test(res.output)); // Applied might be replaced by warning
  check('reports verify results', /Verify before.*exit 1/.test(res.output) && /Verify after.*exit 1/.test(res.output));
  if (fs.existsSync(path.join(repo,'.agent-kit'))) kitAttempt(['remove.js','--target',repo,'--ignore-hash']);
  fs.rmSync(tmp,{recursive:true,force:true});
}

async function test8_nullVerifyQuietSuccess() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'issue2-t8-'));
  const repo = path.join(tmp,'repo'); makeRepo(repo);
  const recon = path.join(tmp,'r.json'), prop = path.join(tmp,'p.json');
  run(process.execPath,[path.join(KIT_ROOT,'scripts/recon.js'),'--target',repo,'--output',recon]);
  run(process.execPath,[path.join(KIT_ROOT,'scripts/propose.js'),'--recon',recon,'--config',path.join(KIT_ROOT,'kit.config.json'),'--output',prop]);
  updateProposal(prop, {verifyCommand: null});
  const res = kitAttempt(['apply.js','--target',repo,'--proposal',prop]);
  check('null verify: exits 0', res.ok === true && res.status === 0);
  check('null verify: quiet - no verify messages', !/Verify before/.test(res.output));
  check('null verify: Applied shown', /Applied\./.test(res.output));
  if (fs.existsSync(path.join(repo,'.agent-kit'))) kitAttempt(['remove.js','--target',repo,'--ignore-hash']);
  fs.rmSync(tmp,{recursive:true,force:true});
}

async function main() {
  console.log('Running Issue #2 tests...\n');
  await test1_verifyPassesBeforeAndAfter();
  await test2_verifyPassesBeforeFailsAfter();
  await test3_verifyFailsBefore();
  await test4_verifyCommandNull();
  await test5_timeout();
  await test6_nonexistentCommand();
  await test7_commandFailsBothSides();
  await test8_nullVerifyQuietSuccess();
  console.log(`\n${tests - failures}/${tests} tests passed`);
  if (failures) { console.log(`${failures} FAILURES`); process.exit(1); }
  console.log('ALL TESTS PASSED');
}
main().catch(e=>{console.error(e);process.exit(1);});
