---
name: claude-code-security-review
description: Security-focused code review prompt for identifying high-confidence vulnerabilities in PR changes. Use when reviewing code for security issues.
license: MIT
---

# Security Code Review Prompt

This skill provides a structured security audit prompt template for reviewing code changes for security vulnerabilities.

## Usage

Read the prompt from `prompts.py` (function `get_security_audit_prompt`) and adapt it for your review context. The prompt is designed for PR review but can be used for any security-focused code analysis.

## Prompt Overview

The prompt instructs the reviewer to:

1. **Focus on HIGH-CONFIDENCE vulnerabilities** (>80% confident of exploitability)
2. **Avoid false positives** - skip theoretical issues, style concerns, low-impact findings
3. **Exclude**: DoS, secrets on disk, rate limiting, resource exhaustion
4. **Examine categories**:
   - Input Validation (SQLi, command injection, XXE, template injection, NoSQLi, path traversal)
   - Auth & Authorization (bypass, privilege escalation, session flaws, JWT issues)
   - Crypto & Secrets (hardcoded keys, weak crypto, improper key storage)
   - Injection & Code Execution (RCE via deserialization, pickle/YAML/eval injection, XSS)
   - Data Exposure (sensitive logging, PII violations, API leakage, debug info)

## Methodology

1. **Repository Context Research** - Use file search tools to understand existing security patterns
2. **Comparative Analysis** - Compare new code against established secure practices
3. **Vulnerability Assessment** - Trace data flow from inputs to sensitive operations

## Output Format

Structured JSON with findings array containing: file, line, severity, category, description, exploit_scenario, recommendation, confidence

## Tool Name Mapping

| Prompt References | Use Harness Equivalent |
|-------------------|------------------------|
| "repository exploration tools" | Your harness's file search/glob tool |
| "file search tools" | Your harness's grep/search tool |
| "repository exploration tools" | Your harness's read/list tools |

## Notes

- Requires Anthropic API key at runtime (not stored in kit)
- Original GitHub Action infrastructure NOT vendored - only the prompt template
- Marked UNVERIFIED for harnesses without file exploration capabilities