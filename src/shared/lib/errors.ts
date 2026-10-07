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
