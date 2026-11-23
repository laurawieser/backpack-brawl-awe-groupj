import cors from "cors";
import express from "express";
import { createHallOfFame, validateRun } from "./hallOfFame.js";
import { opponentForRound, parseRound } from "./opponents.js";

const app = express();
const port = Number(process.env.PORT ?? 4200);
/** Kept in memory only: restarting the server empties the hall of fame. */
const hallOfFame = createHallOfFame();

app.use(cors()); app.use(express.json());
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "backpack-brawl" }));

/** Simulated delay in ms: `?latency=` or API_LATENCY, clamped to 0–5000; 1200 if missing or not a number. */
function latencyOf(req) {
  const requested = Number(req.query.latency ?? process.env.API_LATENCY ?? 1200);
  return Number.isFinite(requested) ? Math.max(0, Math.min(5000, requested)) : 1200;
}

/** `true` if the request (`?fail=true`) or the server (`API_FAIL=true`) forces a failure. */
const failureForced = (req) => req.query.fail === "true" || process.env.API_FAIL === "true";

app.get("/api/opponents", (req, res) => {
  setTimeout(() => {
    const round = parseRound(req.query.round);
    if (round === null) return res.status(400).json({ error: "round must be a positive whole number" });
    if (failureForced(req)) {
      return res.status(503).json({ error: "The arena gates are shut. No challenger answered the call." });
    }
    res.json(opponentForRound(round));
  }, latencyOf(req));
});

app.get("/api/hall-of-fame", (req, res) => {
  setTimeout(() => {
    if (failureForced(req)) return res.status(503).json({ error: "The hall of fame is closed. Try again in a moment." });
    res.json(hallOfFame.top());
  }, latencyOf(req));
});

app.post("/api/runs", (req, res) => {
  setTimeout(() => {
    const { run, error } = validateRun(req.body);
    if (error) return res.status(400).json({ error });
    if (failureForced(req)) return res.status(503).json({ error: "The hall of fame is closed. Your run was not saved." });
    // A run id that is already stored gets the stored entry back, so a retry never adds a run twice.
    const { entry, rank, created } = hallOfFame.add(run);
    res.status(created ? 201 : 200).json({ entry, rank });
  }, latencyOf(req));
});

// Errors from express.json() (malformed or too large body) get the usual { error } shape instead of an HTML page.
app.use((error, _req, res, _next) => {
  if (error.type === "entity.parse.failed") return res.status(400).json({ error: "the body must be valid JSON" });
  if (error.type === "entity.too.large") return res.status(413).json({ error: "the body is too large" });
  res.status(500).json({ error: "the server could not handle the request" });
});

app.listen(port, () => console.log(`Backpack Brawl API listening on http://localhost:${port}`));
