// Agent Kit guard core. Pure logic, no I/O except realpath checks.
// Advisory guardrail against accidents. NOT a security boundary: shell commands
// can still do damage through paths this parser does not see (e.g. python -c).
// Returns a reason string to block, or null to allow.

import fs from "node:fs";
import path from "node:path";

const SECRET_BASENAME = [
  /^\.env($|\.|rc$)/,
  /\.pem$/i,
  /\.key$/i,
  /^id_(rsa|ed25519|ecdsa|dsa)/,
  /\.(p12|pfx|keystore|jks)$/i,
  /^\.netrc$/,
  /^\.npmrc$/,
  /^\.pypirc$/,
  /^credentials(\.json)?$/i,
  /(^|[._-])(secrets?|credentials?)([._-]|$)/i,
  /(^|[._-])tokens?([._-]|$)\.(json|txt|ya?ml|env|ini)$/i,
];
const SECRET_PATH_FRAGMENTS = [".aws/", ".ssh/", ".kube/config", ".docker/config", ".gnupg/"];

// Repo-relative paths the agent must not write, delete, or redirect into.
const PROTECTED_REL = [
  /^\.agent-kit(\/|$)/,
  /^\.opencode\/agent-kit(\/|$)/,
  /^\.opencode\/plugins\/agent-kit-/,
  /^\.opencode\/hooks(\/|$)/,
  /^\.opencode\/(opencode\.jsonc?)$/,
  /^opencode\.jsonc?$/,
  /^\.git\/hooks(\/|$)/,
  /^\.git\/config$/,
];
// Substrings used to catch protected paths inside arbitrary shell text.
const PROTECTED_SUBSTRINGS = [".agent-kit", ".opencode/agent-kit", ".opencode/plugins/agent-kit-", ".opencode/hooks", "opencode.json", ".git/hooks", ".git/config"];

const READ_ONLY_VERBS = new Set(["cat", "head", "tail", "less", "more", "ls", "stat", "file", "wc", "grep", "rg", "find", "diff"]);
const WRAPPERS = new Set(["sudo", "doas", "env", "nohup", "time", "exec", "command", "builtin", "nice", "xargs", "stdbuf", "timeout"]);
const DEPLOY = [
  [/^(npm|yarn|pnpm|bun)$/, /^publish$/],
  [/^(docker|kubectl|helm|terraform)$/, /^(push|apply|deploy|destroy)$/],
  [/^(vercel|netlify|railway|fly|render)$/, /^deploy$/],
  [/^gh$/, /^release$/],
];

function basenameMatchesSecret(p) {
  const b = path.basename(p);
  if (SECRET_BASENAME.some(re => re.test(b))) return true;
  return SECRET_PATH_FRAGMENTS.some(f => p.includes(f));
}

function relToRoot(root, p) {
  const abs = path.resolve(root, p);
  return { abs, rel: path.relative(root, abs).split(path.sep).join("/") };
}

function outsideRoot(root, p) {
  const { rel } = relToRoot(root, p);
  return rel === ".." || rel.startsWith("../") || path.isAbsolute(rel);
}

// Resolve symlinks on the nearest existing ancestor and confirm it stays in root.
function escapesViaSymlink(root, p) {
  let cur = path.resolve(root, p);
  while (!fs.existsSync(cur)) {
    const parent = path.dirname(cur);
    if (parent === cur) return false;
    cur = parent;
  }
  let real;
  let realRoot;
  try {
    real = fs.realpathSync(cur);
    realRoot = fs.realpathSync(root);
  } catch {
    return false;
  }
  const rel = path.relative(realRoot, real);
  return rel === ".." || rel.startsWith("../") || path.isAbsolute(rel);
}

function protectedRel(root, p) {
  const { rel } = relToRoot(root, p);
  return PROTECTED_REL.some(re => re.test(rel));
}

// ---- file tools ----

export function checkRead(root, filePath) {
  if (!filePath) return null;
  if (basenameMatchesSecret(filePath)) return `read blocked (secret file): ${filePath}`;
  return null;
}

export function checkWrite(root, filePath) {
  if (!filePath) return null;
  if (outsideRoot(root, filePath)) return `write outside repo blocked: ${filePath}`;
  if (escapesViaSymlink(root, filePath)) return `write through symlink outside repo blocked: ${filePath}`;
  if (protectedRel(root, filePath)) return `write to protected kit path blocked: ${filePath}`;
  if (basenameMatchesSecret(filePath)) return `write to secret-like file blocked: ${filePath}`;
  return null;
}

// ---- shell ----

// Expand "sh -c '...'" and "eval ..." so the inner command is checked too.
function unwrapNested(cmd, depth = 0) {
  if (depth > 3) return [cmd];
  const parts = [cmd];
  const re = /\b(?:sh|bash|zsh|dash)\s+-c\s+(?:"([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(cmd))) parts.push(...unwrapNested(m[1] ?? m[2] ?? "", depth + 1));
  const ev = /\beval\s+(?:"([^"]*)"|'([^']*)'|(\S.*))/g;
  while ((m = ev.exec(cmd))) parts.push(...unwrapNested(m[1] ?? m[2] ?? m[3] ?? "", depth + 1));
  return parts;
}

function splitSegments(cmd) {
  return cmd
    .replace(/\$\(|`/g, ";")
    .split(/;|&&|\|\||\||&|\n|\(|\)|\{|\}/)
    .map(s => s.trim())
    .filter(Boolean);
}

function tokenize(seg) {
  return (seg.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || []).map(t => t.replace(/^["']|["']$/g, ""));
}

function stripWrappers(toks) {
  let t = toks.slice();
  while (t.length) {
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t[0])) { t.shift(); continue; }
    if (WRAPPERS.has(t[0])) { t.shift(); while (t.length && t[0].startsWith("-")) t.shift(); continue; }
    break;
  }
  return t;
}

function checkRm(root, args) {
  let recursive = false;
  let force = false;
  const targets = [];
  let endOpts = false;
  for (const t of args) {
    if (!endOpts && t === "--") { endOpts = true; continue; }
    if (!endOpts && t === "--recursive") { recursive = true; continue; }
    if (!endOpts && t === "--force") { force = true; continue; }
    if (!endOpts && /^-[a-zA-Z]+$/.test(t)) {
      if (/[rR]/.test(t)) recursive = true;
      if (/f/.test(t)) force = true;
      continue;
    }
    targets.push(t);
  }
  if (!recursive && !force) {
    // Plain rm of a protected path is still a protected write.
    for (const t of targets) if (protectedRel(root, t)) return `rm of protected kit path blocked: ${t}`;
    return null;
  }
  for (const t of targets) {
    if (t.startsWith("~") || t.includes("$") || path.isAbsolute(t) || outsideRoot(root, t)) {
      return `rm outside repo blocked: ${t}`;
    }
    // Block wiping the repo root itself. A nested path like node_modules/.bin is fine.
    const { rel } = relToRoot(root, t);
    if (rel === "" || rel === "." || rel === "*" || t === "*" || t === "." || t === "./" || t === "/*") {
      return `rm of whole repo blocked: ${t}`;
    }
    // Bare "./*" style targets still mean the whole tree.
    if (/^\.\/?\*$/.test(t) || /^\*\/?$/.test(t)) {
      return `rm of whole repo blocked: ${t}`;
    }
    if (protectedRel(root, t) || rel.startsWith(".agent-kit")) return `rm of protected kit path blocked: ${t}`;
  }
  return null;
}

function checkGitPush(args) {
  for (const t of args) {
    if (t === "-f" || t.startsWith("--force") || t === "--mirror") return `git push with force blocked: ${t}`;
    if (/^-[a-zA-Z]*f[a-zA-Z]*$/.test(t)) return `git push with force blocked: ${t}`;
    if (t.startsWith("+")) return `git push with forced refspec blocked: ${t}`;
    if (t.includes(":") && t.split(":")[0].startsWith("+")) return `git push with forced refspec blocked: ${t}`;
  }
  return null;
}

function checkSegment(root, seg) {
  const toks = stripWrappers(tokenize(seg));
  if (!toks.length) return null;
  const [head, ...args] = toks;

  if (head === "rm") {
    const e = checkRm(root, args);
    if (e) return e;
  }
  if (head === "git" && args[0] === "push") {
    const e = checkGitPush(args.slice(1));
    if (e) return e;
  }
  if (head === "find" && (args.includes("-delete") || args.some((a, i) => a === "-exec" && args[i + 1] === "rm"))) {
    return "find with delete blocked";
  }
  for (const [cmdRe, subRe] of DEPLOY) {
    if (cmdRe.test(head) && subRe.test(args[0] || "")) return `${head} ${args[0]} blocked: needs human approval`;
  }
  for (const t of toks) {
    if (basenameMatchesSecret(t)) return `shell access to secret file blocked: ${t}`;
    if (!t.startsWith("-") && protectedRel(root, t)) {
      if (!READ_ONLY_VERBS.has(head) || /[>]/.test(seg)) return `shell write to protected kit path blocked: ${t}`;
    }
  }
  return null;
}

export function checkBash(root, command) {
  if (!command) return null;
  for (const variant of unwrapNested(command)) {
    for (const seg of splitSegments(variant)) {
      const e = checkSegment(root, seg);
      if (e) return e;
    }
    // Text-level backstop: protected paths mentioned in a non-read-only context.
    for (const seg of splitSegments(variant)) {
      const mentions = PROTECTED_SUBSTRINGS.some(s => seg.includes(s));
      if (!mentions) continue;
      const head = stripWrappers(tokenize(seg))[0] || "";
      if (!READ_ONLY_VERBS.has(head) || seg.includes(">")) {
        return `shell command references protected kit path: ${seg.slice(0, 80)}`;
      }
    }
  }
  return null;
}

// Map an OpenCode tool call onto a check. Tool names: bash, read, write, edit.
export function checkToolCall(root, tool, args = {}) {
  const file = args.filePath ?? args.file_path ?? args.path;
  switch (tool) {
    case "bash":
      return checkBash(root, String(args.command ?? ""));
    case "read":
      return checkRead(root, file);
    case "write":
    case "edit":
    case "patch":
      return checkWrite(root, file);
    default:
      return null;
  }
}
