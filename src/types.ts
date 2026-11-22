export interface ItemEffects {
  damage?: number;
  block?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  price: number;
  /** Cooldown in battle ticks (1 tick = 0.5 s). */
  cooldown: number;
  effects: ItemEffects;
}

/** A concrete item the player owns; several instances may share one `itemId`. */
export interface ItemInstance {
  uid: string;
  itemId: string;
}

/** Fixed-size grid, row by row; `null` marks a free slot. */
export type Backpack = (ItemInstance | null)[];

/** Shop offers by item id; `null` marks an offer that was already bought. */
export type ShopOffers = (string | null)[];

export type Phase = "shop" | "searching" | "battle" | "finished";

/** The result of one battle from the player's side. */
export type RoundResult = "win" | "loss";

export type RunOutcome = "victory" | "defeat";

export interface RunState {
  /** Unique id of this run. The server stores a run with the same id only once in the hall of fame. */
  runId: string;
  round: number;
  gold: number;
  lives: number;
  wins: number;
  /** Result of every battle so far, in order. Sent to the hall of fame so the server can check the run. */
  results: RoundResult[];
  /** Seed for the next shop roll — keeps every shop deterministic. */
  seed: number;
  shop: ShopOffers;
  backpack: Backpack;
  /** Counter for generating unique `ItemInstance.uid`s. */
  nextUid: number;
}

export interface Opponent {
  id: string;
  name: string;
  icon: string;
  hp: number;
  round: number;
  items: string[];
}

/** Body of every error response from the API, e.g. a 503 from `GET /api/opponents`. */
export interface ApiError {
  error: string;
}

/** A finished run as sent to `POST /api/runs`. */
export interface RunSubmission {
  runId: string;
  name: string;
  outcome: RunOutcome;
  wins: number;
  lives: number;
  rounds: number;
  results: RoundResult[];
}

/** A run stored in the hall of fame, as listed by `GET /api/hall-of-fame`. */
export interface HallOfFameEntry {
  /** The run's `runId`. */
  id: string;
  name: string;
  outcome: RunOutcome;
  wins: number;
  lives: number;
  rounds: number;
}

/** Answer of `POST /api/runs`: the stored entry and its place in the ranking (1 = best). */
export interface SavedRun {
  entry: HallOfFameEntry;
  rank: number;
}

/** Sending the finished run to the hall of fame. */
export interface Submission {
  /** The name as typed. Kept after a failed attempt, so a retry needs no retyping. */
  name: string;
  /** `editing` → `sending` → `saved`, or back to `editing` with an `error`. */
  status: "editing" | "sending" | "saved";
  /** Why the last attempt failed, shown next to the form. */
  error: string | null;
  /** The server's answer, set once `status === "saved"`. */
  saved: SavedRun | null;
}

export type Side = "player" | "opponent";

export interface FighterSnapshot {
  hp: number;
  maxHp: number;
  block: number;
}

export type BattleEventKind = "damage" | "block";

export interface BattleEvent {
  tick: number;
  /** Who caused the event. */
  source: Side;
  /** Who is affected by it. */
  target: Side;
  kind: BattleEventKind;
  amount: number;
  /** Item that triggered the event. */
  itemId: string;
  message: string;
}

export interface BattleFrame {
  tick: number;
  player: FighterSnapshot;
  opponent: FighterSnapshot;
  /** Events that happened during this tick. */
  events: BattleEvent[];
}

export interface BattleResult {
  winner: Side;
  reason: "knockout" | "timeout";
  frames: BattleFrame[];
  events: BattleEvent[];
}

/** An item as it fights: the catalog values it brings into battle. */
export interface FighterItem {
  itemId: string;
  name: string;
  icon: string;
  cooldown: number;
  effects: ItemEffects;
}

/** Everything `simulateBattle` needs to know about one side. */
export interface Fighter {
  name: string;
  maxHp: number;
  items: FighterItem[];
}

/** A simulated battle being replayed frame by frame. */
export interface BattleReplay {
  opponent: Opponent;
  player: Fighter;
  enemy: Fighter;
  result: BattleResult;
  /** Index into `result.frames` that is currently shown. */
  frame: number;
}

/** Everything the UI needs: the run plus where in the round loop we are. */
export interface GameState {
  phase: Phase;
  run: RunState;
  /** Set while `phase === "battle"`. */
  battle: BattleReplay | null;
  /** Last opponent-search error, shown in the shop. */
  error: string | null;
  /**
   * Id of the running opponent search, set while `phase === "searching"`.
   * A response that carries another id is stale and gets ignored.
   */
  searchId: string | null;
  /** The hall of fame submission; only possible while `phase === "finished"`. */
  submission: Submission;
}
