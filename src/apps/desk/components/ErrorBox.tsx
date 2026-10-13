import { describeError } from '../../../lib/errors';

/** Red box with the server's message and code, e.g. "Access denied (FORBIDDEN_BRANCH)". */
export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  const { message, code } = describeError(error);

  return (
    <div className="msg msg-error" role="alert">
      {message}
      {code && <span className="muted"> ({code})</span>}
    </div>
  );
}
