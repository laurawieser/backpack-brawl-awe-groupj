import type { FormEvent } from "react";
import { Link } from "react-router";
import { ROUTES } from "../game";
import { NAME_RULE } from "../hallOfFame";
import type { Submission } from "../types";

interface HallOfFameFormProps {
  submission: Submission;
  /** Why the run can't be sent right now (`submitBlocker`), or `null`. */
  blocker: string | null;
  onNameChange: (name: string) => void;
  onSubmit: () => void;
}

const PANEL = "mx-auto flex w-full max-w-lg flex-col gap-3 rounded-lg border border-panel-edge bg-panel p-6";

/** Name field and save button for a finished run; once saved, its rank and a link to the list. */
export function HallOfFameForm({ submission, blocker, onNameChange, onSubmit }: HallOfFameFormProps) {
  if (submission.saved) {
    const { entry, rank } = submission.saved;
    return (
      <section className={`${PANEL} items-center text-center`} aria-live="polite">
        <p className="font-display text-xl font-bold text-gold">
          🏆 Saved as {entry.name}: rank #{rank}
        </p>
        <Link to={ROUTES.hallOfFame} className="underline hover:text-gold">
          See how your run compares
        </Link>
      </section>
    );
  }

  const sending = submission.status === "sending";
  // The rule is shown up front; once something is typed, the reason it can't be sent replaces it.
  const nameProblem = !sending && submission.name !== "" ? blocker : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={sending} className={PANEL}>
      <label htmlFor="hall-of-fame-name" className="font-display text-lg font-bold">
        🏆 Enter the hall of fame
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="hall-of-fame-name"
          value={submission.name}
          onChange={(event) => onNameChange(event.target.value)}
          disabled={sending}
          placeholder="Your name"
          autoComplete="nickname"
          aria-describedby="hall-of-fame-rule"
          className="min-w-0 flex-1 rounded-md border border-panel-edge bg-ink px-3 py-2 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={blocker !== null}
          title={blocker ?? undefined}
          className="shrink-0 rounded-md bg-gold px-4 py-2 font-display font-bold text-ink hover:brightness-110 disabled:bg-panel-edge disabled:text-muted"
        >
          {sending ? "Saving…" : "Save run"}
        </button>
      </div>
      <p id="hall-of-fame-rule" className={`text-sm ${nameProblem ? "text-life" : "text-muted"}`}>
        {nameProblem ?? NAME_RULE}
      </p>
      {submission.error && (
        <p role="alert" className="text-life">
          ⚠️ {submission.error} Try again.
        </p>
      )}
    </form>
  );
}
