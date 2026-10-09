# Review Report: anthropics/skills (frontend-design)

## Source
- **Repository**: https://github.com/anthropics/skills
- **Owner**: anthropics (Anthropic)
- **Commit**: 9d630808e4add0a7146de4af9384155d5dee350a
- **License**: Apache 2.0
- **Copy Date**: 2026-10-09

## Skill Reviewed
- frontend-design (from `skills/frontend-design/`)

## Findings

### frontend-design
- **Type**: Design guidance skill (no code execution)
- **Suspicious patterns**: None found
- **Network calls**: None
- **Shell execution**: None
- **Credential access**: None
- **Writes outside project**: None
- **Hide actions/ignore rules/skip confirmation**: None
- **Subagent references**: None
- **Vendor-specific tool names**: None - pure design guidance

### License Compliance
- Apache 2.0 license permits redistribution with attribution
- License file (LICENSE.txt) included
- Requires retaining copyright/patent/trademark/attribution notices
- Must include copy of license with redistributed work

## Notes for SKILLS.lock
- Marked as "only for repos with a UI" per requirements
- No tool name mappings needed
- Pure design process guidance

## Verdict: APPROVED for vendoring
The frontend-design skill is pure design guidance with no executable code, no network calls, and no safety concerns. Apache 2.0 license allows redistribution with proper attribution.