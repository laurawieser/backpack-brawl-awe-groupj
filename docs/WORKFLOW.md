# Workflow

One GitHub issue per requirement, so the status and ownership can be found there. 
One feature doc per requirement in `docs/features/`, so the decisions and tests can be found there.

## Work split

There is no fixed work split for now. Assign a GitHub issue to claim it.

## Order of work

| Phase | Requirements | Can start when… |
|---|---|---|
| 1 | B1, B3, B5, B7 | right away, in parallel |
| 2 | B2, B4 | B1 is merged (B2), B3 is merged (B4) |
| 3 | B6 | B5 and B7 are merged |

B6 comes last because it has to save everything the other features add to the game state.

## Start to finish

| Stage | Code | Feature doc (`docs/features/Bx-….md`) |
|---|---|---|
| 1. Claim | Assign yourself to the issue | Fill in Owner and Issue |
| 2. Branch | Create a branch from the latest `master` | Status → `in progress` |
| 3. Build | Small commits, push at least once a day | Log every decision **in the same commit**, add chosen values |
| 4. Sync | Bring the branch up to date with `master`, run the checks | – |
| 5. Review | Open a PR, a teammate tests it and approves | Fill in Where it lives and Tested by, add the PR number, status → `in review`. The reviewer ticks ✓ in Tested by |
| 6. Merge | Merge on GitHub once CI is green and approved, delete the branch | Status → `merged` (last commit before merging) |
| 7. Share | Tell the team what was merged | Copy decisions into the diary if applicable (Google Docs) |


### Commands

```bash
# 2. Branch
git switch master && git pull
git switch -c feat/b<numberOfRequirement>-<shortName>

# 3. Build
git add <files> docs/features/B<n>-<name>.md
git commit -m "feat(<featureName>): <message> (#<issueNumber>)"
git push -u origin feat/b<numberOfRequirement>-<shortName>

# 4. Sync
git fetch
git rebase origin/master
npm run check
git push --force-with-lease
```

### Rules

- Never commit to `master` directly.
- Use only the following branch prefixes: `feat/`, `fix/`, `docs/`, `test/`, `chore/`
- Only rebase your own branch, never `master` or someone else's branch.
- Merge with **"Create a merge commit"** so each feature stays one unit in the history.
- Write `Closes #<issue>` in the PR description, so the issue closes automatically on merge.
- Decisions affecting several features (e.g. `types.ts`, run id) go into `docs/features/00-project.md`.

## Feature docs

Fill them in while working, not at the end. Decision log entries, newest first:

```markdown
### YYYY-MM-DD · short title
- **Chose:** what we did
- **Instead of:** the alternative(s)
- **Because:** the reason
- **Price:** what we gave up
- **Evidence:** PR #n
```

## Known starter bugs

| # | Bug | Where | How to reproduce | Fixed in |
|---|---|---|---|---|
| 1 | Buying with a full backpack takes the gold but loses the item | `buyItem` in `run.ts` | Fill all 6 slots, buy one more item | B1 |
| 2 | After a failed search the shop and backpack stay locked | `searchFailed` in `game.ts` | Start the API with `API_FAIL=true`, click "Find opponent" | B5 |
| 3 | "Find opponent" can be clicked again while searching | `FightBar.tsx`, `startSearch` in `game.ts` | Double-click "Find opponent", two requests appear in the browser's Network tab | B5 |
| 4 | A late or duplicate response starts or restarts a battle | `startBattle` in `game.ts` | Double-click "Find opponent", the second response restarts the replay | B5 |