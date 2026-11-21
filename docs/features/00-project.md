# 00 · Project-wide decisions

| Owner | Reviewer | Issue | PR | Status |
|---|---|---|---|---|
| Šimek Martin Šimon & Wieser Laura | Šimek Martin Šimon & Wieser Laura | – | #1 (project setup) | done |

## In short

Decisions that affect the whole project rather than a single requirement: workflow, tooling, documentation, AI usage and shared code.

## Where it lives

| File | Role |
|---|---|
| `docs/WORKFLOW.md` | order of work, stages from issue to merge, starter bugs |
| `docs/QUALITY.md` | quality goals |
| `docs/features/` | one doc per requirement, with its decision log |
| `.github/workflows/check.yml` | CI: lint, tests and build on every push |
| `.github/pull_request_template.md` | PR description with definition of done |
| `AGENTS.md` | rules for AI assistants |

## Chosen values

| Setting | Value | Why |
|---|---|---|
| Branch prefixes | `feat/`, `fix/`, `docs/`, `test/`, `chore/` | type of change visible at a glance |
| Commit format | `type(scope): message (#issue)` | commits linked to issues |
| Merge type | merge commit | each feature stays one unit in the history |
| Required before merge | CI green + 1 approval | `master` always works |

## Decision log


### 2026-11-21 · AI writes code, the team decides
- **Chose:** AI assistants only write code and tests; they present options for every real decision and never commit, push or open PRs (`AGENTS.md`)
- **Instead of:** letting AI work freely, including git and documentation
- **Because:** every team member must explain all code and decisions in the exam; commits and PRs are our evidence of who did what
- **Price:** slower, since every decision needs our input
- **Evidence:** PR #1

### 2026-11-21 · Keep the starter's split between game rules and React
- **Chose:** game rules stay in plain TypeScript modules, React components only display and call them
- **Instead of:** writing game logic directly in components
- **Because:** rules can be tested with Vitest without a browser; one blocker function protects both button and action (B1); clear state transitions help against duplicate responses (B5) and make saving simple (B6)
- **Price:** more files, and logic and display live in different places
- **Evidence:** PR #1

### 2026-11-21 · Documentation per feature with built-in decision log
- **Chose:** one file per requirement in `docs/features/`, updated in the same commits as the code
- **Instead of:** one central decision log, or documenting everything at the end
- **Because:** decisions stay next to the feature, the reviewer sees them in the PR, and nothing is forgotten
- **Price:** discipline to update the doc in every feature branch
- **Evidence:** PR #1

### 2026-11-21 · CI check on every push
- **Chose:** `npm run check` (lint, tests, build) in GitHub Actions on every push and PR
- **Instead of:** only running checks locally
- **Because:** every branch shows ✅/❌ before merging, so `master` stays working
- **Price:** about a minute of waiting per push; a red CI blocks the merge
- **Evidence:** PR #1

### 2026-11-21 · GitHub Flow with pull requests
- **Chose:** one `master` branch, one short-lived branch per issue, merged via PR with review
- **Instead of:** Git Flow (develop/release branches), one branch per person, or everyone on `master`
- **Because:** one final submission and no releases make Git Flow overhead; reviews keep `master` stable and everyone sees all of the code
- **Price:** waiting for reviews; rebasing before each PR
- **Evidence:** PR #1
