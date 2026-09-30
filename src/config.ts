/*
 * Build-time switches (Vite env). See .env.example.
 */

function parsePrefixes(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

export const config = {
  /**
   * Prefix for every REST call (the server origin, when not same-origin).
   * Paths already carry their own `/api/v1` where the backend has one.
   */
  apiBase: import.meta.env.VITE_API_BASE ?? '',
  /** true = endpoints are answered in the browser by src/mocks. */
  useMocks: import.meta.env.VITE_USE_MOCKS === 'true',
  /**
   * With mocks on, requests under these prefixes still go to the real
   * backend, e.g. "/auth,/users,/employees,/api" (everything the backend
   * serves today; the rest stays fake). A `*` stands for one path segment:
   * "/branches/*\/pricing" sends branch pricing to the backend while the
   * fake-only /branches and /branches/summary stay fake.
   */
  realPrefixes: parsePrefixes(import.meta.env.VITE_REAL_PREFIXES).map(prefixPattern),
};

/** "/branches/*\/pricing" → matches that path and anything below it, not a query string on the prefix itself. */
export function prefixPattern(prefix: string): RegExp {
  const body = prefix
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[^/?]+');
  return new RegExp(`^${body}(?:/|$)`);
}

export function isMocked(path: string): boolean {
  if (!config.useMocks) return false;
  return !config.realPrefixes.some((pattern) => pattern.test(path));
}
