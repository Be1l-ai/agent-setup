# Review Report: anthropics/claude-code-security-review

## Source
- **Repository**: https://github.com/anthropics/claude-code-security-review
- **Owner**: anthropics (Anthropic)
- **Commit**: 0c6a49f1fa56a1d472575da86a94dbc1edb78eda
- **License**: MIT
- **Copy Date**: 2026-10-09

## Component Reviewed
- Security audit prompt from `claudecode/prompts.py` (function `get_security_audit_prompt`)
- **NOT** the GitHub Action (`action.yml`), Python scripts, or infrastructure

## Findings

### Security Audit Prompt
- **Type**: Prompt template for LLM-based security review
- **Suspicious patterns**: None found in the prompt itself
- **Network calls**: None (the prompt instructs use of "repository exploration tools" which are agent tools)
- **Shell execution**: None
- **Credential access**: None (prompt mentions API keys/secrets as things to FLAG, not to read)
- **Writes outside project**: None
- **Hide actions/ignore rules/skip confirmation**: None
- **Subagent references**: None
- **Vendor-specific tool names**: References "repository exploration tools", "file search tools" - generic agent capabilities

### Excluded Components
- `action.yml` - GitHub Actions workflow (not portable, requires GitHub infrastructure)
- `claudecode/github_action_audit.py` - Python script that runs the action
- `claudecode/claude_api_client.py` - Anthropic API client
- All test files and eval infrastructure
- `scripts/comment-pr-findings.js` - GitHub PR commenting script

## License Compliance
- MIT license permits redistribution with attribution
- License file included

## Notes for SKILLS.lock
- The prompt references "repository exploration tools" and "file search tools" - map to harness equivalents in AGENTS.template.md
- Designed for PR review context but prompt is adaptable
- Requires Anthropic API key at runtime (not stored in kit)

## Verdict: APPROVED for vendoring (prompt only)
The security audit prompt is a well-structured security review guideline. Only the prompt template is vendored, not the GitHub Action infrastructure.