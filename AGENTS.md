# AGENTS

Instructions for AI coding assistants in this repository.

## Context

This is a university exam project (Advanced Web Engineering). AI may help with code, but **the team makes every decision and must be able to explain all code in the exam.** Your job is to help us build and understand, not to decide for us.

## 1. Decisions belong to the team

- For every real decision, **present 2–3 options with pros and cons, then ask which one to use.** Don't pick one yourself.
- Real decisions: game values and rules, data structures and types, architecture, save formats, API endpoints and validation, new dependencies, anything listed under "To decide" in `docs/features/`.
- Not real decisions: naming, formatting, small implementation details. Just do these.
- If a requirement is unclear, ask instead of guessing.

## 2. You write code, we do the rest

- **Allowed:** read files, write and change code and tests, run `npm run check`, `npm test`, `npm run lint`, `npm run dev`, and read-only git commands (`status`, `diff`, `log`).
- **Not allowed:** any git command that changes history, branches or the remote (`commit`, `push`, `merge`, `rebase`, `reset`, `checkout`/`switch`), creating issues or PRs, installing packages.
- **Don't write** decision log entries in `docs/features/`, `docs/QUALITY.md` or the diary. You may suggest wording; we write it ourselves.

## 3. Work in small, explained steps

- Stay within the current task. Don't change unrelated files, don't refactor "while you're at it".
- **Ask before changing shared files:** `src/types.ts`, `src/run.ts`, `src/game.ts`, `src/rules.ts`, `server/opponents.js`.
- Keep changes small enough to review (roughly one function or component at a time).
- After every change, summarize: which files changed, what each change does, and anything we should understand before committing.
- Say clearly when you're unsure or something might be wrong.

## 4. Project architecture (follow the starter)

The app is **React 19 + TypeScript**, with React Router and Tailwind CSS. Keep the starter's split:

- **Game rules** (what happens) live in plain TypeScript modules: `run.ts`, `shop.ts`, `battle.ts`, `game.ts`. Every rule function takes the current state and returns a new one without mutating it. These modules don't import React, so they can be tested without a browser.
- **React components and pages** (what the player sees and clicks) live in `src/components/` and `src/pages/`. They display state and call the rule functions; they don't calculate game rules themselves.
- **Every action has a blocker function** (`…Blocker(state)` returns a reason or `null`). The component shows the reason and disables the control; the action checks the same function. Example: `buyBlocker` in `run.ts`, used by `Shop.tsx`.
- **Deterministic:** no `Math.random()` or `Date.now()` in game rules; use the seeded RNG in the run state.
- **Explanations come from constants:** rule texts and tooltips are built in `rules.ts` from the same values the game uses.
- Shared game state lives in `GameProvider` (React context); pages use `useGame` / `useActiveGame`.
- The API (`server/`) is Express with ES modules and validates every input.

## 5. Code standards

- TypeScript: no `any`; explicit types for domain data and API payloads in `src/types.ts`.
- React: function components and hooks, styling with Tailwind classes like the existing components, no `dangerouslySetInnerHTML`.
- `const` by default, `async`/`await` with error handling, no leftover `console.log`.
- **Tests:** new or changed rules get Vitest tests in a `*.test.ts` file next to the module. Code must pass `npm run check` (lint + tests + build).
- Code, comments and docs in English.