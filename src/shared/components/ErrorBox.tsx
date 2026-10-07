import { ApiError } from '../../api/http';

/** Red box with the server's message and code, e.g. "Access denied (FORBIDDEN_BRANCH)". */
export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;

  let message = 'Something went wrong.';
  let code: string | null = null;
  if (error instanceof ApiError) {
    message = error.status === 403 && error.code !== 'WRONG_APP' ? `Access denied: ${error.message}` : error.message;
    code = error.code;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="msg msg-error" role="alert">
      {message}
      {code && <span className="muted"> ({code})</span>}
    </div>
  );
}
