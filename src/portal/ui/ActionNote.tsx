import { describeError } from '../../shared/lib/errors';

/** What a button did, in the design's words: done in brown, a refusal in the charter's red. */
export function ActionNote({ action }: { action: { message: string | null; error: unknown } }) {
  if (action.error) {
    return (
      <p className="bd-note bd-note-error" role="alert">
        {describeError(action.error).message}
      </p>
    );
  }
  return action.message ? (
    <p className="bd-note" role="status">
      {action.message}
    </p>
  ) : null;
}
