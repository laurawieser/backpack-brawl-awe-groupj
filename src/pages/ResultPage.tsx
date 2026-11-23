import { HALL_OF_FAME_ERRORS, submitRun } from "../api";
import { HallOfFameForm } from "../components/HallOfFameForm";
import { RunHeader } from "../components/RunHeader";
import { RunOver } from "../components/RunOver";
import { editName, startSubmit, submitBlocker, submitFailed, submitSucceeded } from "../game";
import { runSubmission } from "../hallOfFame";
import { runOutcome } from "../run";
import { useActiveGame } from "../state/GameContext";

export function ResultPage() {
  const { game, update, startNewRun } = useActiveGame();
  const outcome = runOutcome(game.run);
  if (!outcome) return null;

  function handleNameChange(name: string) {
    update((current) => editName(current, name));
  }

  // Leaving the page doesn't cancel the request: the answer still reaches the game state,
  // and submitSucceeded/submitFailed ignore it if a new run was started in the meantime.
  async function handleSubmit() {
    if (submitBlocker(game) !== null) return;
    const submission = runSubmission(game.run, game.submission.name);
    if (!submission) return;
    update(startSubmit);
    try {
      const saved = await submitRun(submission);
      update((current) => submitSucceeded(current, submission.runId, saved));
    } catch (error) {
      const message = error instanceof Error ? error.message : HALL_OF_FAME_ERRORS.unreachable;
      update((current) => submitFailed(current, submission.runId, message));
    }
  }

  // Starting a new run moves the phase to "shop", so RequireRoute redirects to the shop.
  return (
    <>
      <RunHeader run={game.run} />
      <RunOver run={game.run} outcome={outcome} onNewRun={startNewRun} />
      <HallOfFameForm
        submission={game.submission}
        blocker={submitBlocker(game)}
        onNameChange={handleNameChange}
        onSubmit={handleSubmit}
      />
    </>
  );
}
