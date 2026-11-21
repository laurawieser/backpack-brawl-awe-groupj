# Backpack Brawl Requirements

## B1 — Shop economy (10%)

As a player, I want to sell items from my backpack for half their price (rounded down) and to reroll the shop offers for 1 🪙.

Gold never becomes negative, an item I pay for always ends up in my backpack, and an item is never lost or duplicated by buying or selling. Every action either completes fully or changes nothing. When an action is not possible, the interface tells me why before I try it, and the same rule also protects the action itself. Shop and backpack actions are only possible while I am shopping.

## B2 — Backpack arrangement (15%)

As a player, I want to arrange my backpack. I can select an item, see that it is selected, and move it to another slot. Moving onto an occupied slot swaps the two items. The interface shows which moves are possible, and I can cancel a selection.

## B3 — Status effects (15%)

As a player, I want two new effects in battle:

- **Poison** adds stacks to the enemy. A poisoned fighter regularly loses HP for every stack. Poison stacks up and ignores block.
- **Heal** restores the fighter's own HP, but never above their max HP.

The catalog contains **at least 3 items per effect**, new or existing items changed, and the shop offers them. Opponents may use them. Poison and heal are shown in the battle view (for example a poison counter per fighter), in the combat log and in the rules panel and tooltips. Your team chooses the exact tick interval and values. They must be deterministic and explained in the interface.

## B4 — Item sets (20%)

As a player, I want items to belong to sets that reward collecting them. There are **at least 2 sets**, one of them **Fire**. Each set has **at least 3 items**. Sets may reuse existing items. Each set grants a bonus while **2 or more** of its items are in a backpack. Bonuses apply to the player and to opponents alike. Set badges are shown on items in the shop and in battle, and active bonuses are visible.

The Fire set adds a new status, **Burn**, a damage-over-time effect that is clearly different from poison:

- it **stacks faster** and **deals more damage** than poison,
- it **does not ignore block**: block absorbs burn damage first,
- it **decays** over time until it wears off.

Your team chooses the exact tick, stack, damage and decay values. They must be deterministic and explained in the rules panel. Burn is shown in the battle view and the combat log.

B3 and B4 do not depend on each other. If B3 is not built, Burn is the first status effect, and the other set bonuses can boost damage or block instead.

## B5 — Resilient matchmaking (10%)

As a player, I want looking for an opponent to be reliable. While a search is running I see that it is running, and I cannot start a second one. A failed or unavailable API returns me to a usable shop with an understandable message and lets me try again.

A battle is only ever started for the current round and the current search. A slow, duplicate or late response must never restart a battle, start a battle outside a search, or apply a result twice.

## B6 — Save and resume (10%)

As a player, I want to refresh the browser and continue my run where I left it, on the matching screen. Your team decides which state is meaningful for continuing a run and stores it in the browser.

Saved data that is malformed, incompatible or describes an impossible run must not break the game; the game falls back to a playable state. Your team defines and communicates a policy for a refresh during a search or a battle replay. Refreshing must not become a way to get a free reroll, a different opponent, a second result, or to avoid a loss.

## B7 — Hall of fame (20%)

As a player, I want to enter my name at the end of a run and see how it compares with other runs. Finished runs are sent to the local API, which stores them and lists the best runs in an order your team defines and shows (for example: victories first, then more wins, then fewer rounds).

The API validates every submitted run and rejects invalid or implausible data with a clear error. The interface shows loading, empty and error states, lets me retry a failed submission without retyping, and never submits the same run twice. The hall of fame is reachable as its own page. The new endpoints are documented in `docs/API.md`.

Storing the entries in memory on the server is sufficient; a database is not required.

## Qualitative requirements and team decisions

In addition to the functional requirements, your team must define a small set of qualitative goals for your solution. Choose goals that are relevant to your implementation and the way you expect the application to be used.

Document the selected goals, why they matter, and the decisions or trade-offs you made to support them. You should also consider how you can evaluate whether your solution meets those goals.

There is no single required architecture, or design pattern. During the exam, team members must be able to explain and defend the chosen non functionals, and discuss the resulting engineering decisions.