/** Shared by every endpoint. */

/** Body of every non-2xx response (common/filters/all-exceptions.filter.ts). */
export interface ApiErrorBody {
  error: string;
  code: string;
  issues?: unknown;
}
