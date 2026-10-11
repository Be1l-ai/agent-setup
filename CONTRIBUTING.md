# Contributing

Thanks for helping. This is a small toolkit with a strong bias toward being
predictable over being clever, so please read the constraints below before
opening a PR.

## Ground rules

1. **Zero runtime dependencies.** Scripts run on stock Node.js 18+ with nothing
   from npm. If your change needs a package, it needs a very good reason.
2. **Additive and reversible.** `apply.js` must never lose a user's file. Any new
   write goes through the manifest so `remove.js` can undo it. If you add a write
   path, add the matching restore path.
3. **No network calls in shipped code.** The only thing that talks to the network
   is the harness the kit installs into.
4. **No secrets.** Never read, log, or commit credentials. The guard blocks secret
   reads; do not work around that guard.
5. **Verify claims.** If you write "this blocks X", add a test or say plainly that
   it is unverified. This repo has been wrong before about exactly this, and the
   wrong claim shipped into `harnesses/opencode.md`.

## Branching and PRs

`main` is protected: it takes a PR and a passing CI run, and no force-pushes.
Branch from `main`, keep commits focused, and open a PR.

## Before you push

Run the self-check. It builds a throwaway repo, applies the kit, removes it, and
compares hashes:

```bash
node scripts/self-test.js
```

It must end with `ALL CHECKS PASSED`. If it does not, fix the code or the test,
not the expectation.

Then check the guard's rules still hold:

```bash
node scripts/guard-test.js
```

## Changing the guard

`plugins/opencode/agent-kit-guard-core.mjs` is the rule set. Keep the logic in the
core and keep the OpenCode plugin a thin wrapper, so the rules stay testable from
plain Node. If a rule can be expressed as a `permission` entry in `opencode.json`
instead, prefer that: the harness enforces it, the plugin only advises.

## Changing skills

Vendored skills are pinned in `SKILLS.lock` with a source commit and license. If
you update or add one, update the lock file in the same PR and keep the original
license and any NOTICE file. Do not edit a vendored skill's prose to change what
upstream says; fork it into your own project instead.

## Changing docs

Docs that describe the guard, the apply flow, or a harness must match the code.
The test suites check the mechanical parts. The judgement calls are yours.