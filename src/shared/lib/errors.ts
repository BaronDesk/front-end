import { ApiError } from '../../api/http';

/**
 * Rethrows a server refusal in words people understand: when the error's code
 * is in `refusals`, as an Error with that text; anything else as it was.
 * Use as `.catch((err) => explainRefusal(err, MY_REFUSALS))`.
 */
export function explainRefusal(err: unknown, refusals: Record<string, string>): never {
  const text = err instanceof ApiError && err.code ? refusals[err.code] : undefined;
  throw text ? new Error(text) : err;
}

/** What an error says to the user, and the server's code when it sent one: "Access denied: …" (FORBIDDEN_BRANCH). */
export function describeError(error: unknown): { message: string; code: string | null } {
  if (error instanceof ApiError) {
    const message = error.status === 403 && error.code !== 'WRONG_APP' ? `Access denied: ${error.message}` : error.message;
    return { message, code: error.code };
  }
  return { message: error instanceof Error ? error.message : 'Something went wrong.', code: null };
}
