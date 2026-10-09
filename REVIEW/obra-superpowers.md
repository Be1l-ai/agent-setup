# Review Report: obra/superpowers

## Source
- **Repository**: https://github.com/obra/superpowers
- **Owner**: obra (Jesse Vincent)
- **Commit**: 8ca22dba9a94f28898bbce59f2537ff4d87c747d
- **License**: MIT
- **Copy Date**: 2026-10-09

## Skills Reviewed
1. systematic-debugging
2. test-driven-development
3. receiving-code-review
4. finishing-a-development-branch

## Excluded Skills (per requirements)
- using-superpowers
- brainstorming
- subagent-driven-development
- plan skills (executing-plans, writing-plans)
- requesting-code-review (subagent dependent)
- diagnosing-superpowers
- dispatching-parallel-agents
- verification-before-completion
- using-git-worktrees
- writing-skills

## Findings

### systematic-debugging
- **Type**: Process/guidance skill (no code execution)
- **Suspicious patterns**: None found
- **Network calls**: None
- **Shell execution**: Only example bash commands for demonstration
- **Credential access**: None
- **Writes outside project**: None
- **Hide actions/ignore rules/skip confirmation**: None
- **Subagent references**: References `superpowers:test-driven-development` and `superpowers:verification-before-completion` skills
- **Vendor-specific tool names**: Uses generic `bash`, `grep`, `env` commands

### test-driven-development
- **Type**: Process/guidance skill (no code execution)
- **Suspicious patterns**: None found
- **Network calls**: None
- **Shell execution**: Only example `npm test` commands for demonstration
- **Credential access**: None
- **Writes outside project**: None
- **Hide actions/ignore rules/skip confirmation**: None
- **Subagent references**: None
- **Vendor-specific tool names**: Uses generic `npm test`, `pytest`, `cargo test`, `go test`

### receiving-code-review
- **Type**: Process/guidance skill (no code execution)
- **Suspicious patterns**: None found
- **Network calls**: None
- **Shell execution**: References `gh api` for GitHub thread replies (optional, external tool)
- **Credential access**: None
- **Writes outside project**: None
- **Hide actions/ignore rules/skip confirmation**: None - explicitly forbids performative agreement
- **Subagent references**: None
- **Vendor-specific tool names**: References `gh` (GitHub CLI) for replying to review comments

### finishing-a-development-branch
- **Type**: Process/guidance skill (no code execution)
- **Suspicious patterns**: None found
- **Network calls**: None
- **Shell execution**: Git commands for branch/worktree management
- **Credential access**: None
- **Writes outside project**: None (operates within git repo)
- **Hide actions/ignore rules/skip confirmation**: None
- **Subagent references**: None
- **Vendor-specific tool names**: Uses standard `git` commands

## License Compliance
- MIT license permits redistribution with attribution
- License file included in each skill folder

## Notes for SKILLS.lock
- systematic-debugging references `superpowers:test-driven-development` and `superpowers:verification-before-completion` (excluded) - add tool name mapping
- receiving-code-review references `gh` CLI for GitHub replies - add tool name mapping
- finishing-a-development-branch uses git worktree commands - standard git, no mapping needed

## Verdict: APPROVED for vendoring
All four skills are pure process guidance with no executable code, no network calls, no credential access, and no instructions to bypass safety controls.