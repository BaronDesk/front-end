import type { HttpMethod } from '../api/http';
import type { MockUser } from './db';

/** Thrown by handlers; becomes `{ error, code }` with this status. */
export class MockHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface MockContext {
  params: Record<string, string>;
  query: URLSearchParams;
  /** The endpoint's request DTO; handlers validate what they read. */
  body: any;
  user: MockUser | null;
}

type Handler = (ctx: MockContext) => unknown;

interface RouteDef {
  method: HttpMethod;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

const routes: RouteDef[] = [];

/** Register a handler, e.g. route('GET', '/stations/:id', ...). */
export function route(method: HttpMethod, path: string, handler: Handler): void {
  const keys: string[] = [];
  const pattern = new RegExp(
    '^' +
      path.replace(/:([a-zA-Z]+)/g, (_, key: string) => {
        keys.push(key);
        return '([^/]+)';
      }) +
      '$',
  );
  routes.push({ method, pattern, keys, handler });
}

export interface MockResponse {
  status: number;
  data: unknown;
}

export async function dispatch(
  method: HttpMethod,
  fullPath: string,
  body: unknown,
  user: MockUser | null,
): Promise<MockResponse> {
  const [path, queryString = ''] = fullPath.split('?');
  const query = new URLSearchParams(queryString);

  let pathMatched = false;
  for (const r of routes) {
    const m = r.pattern.exec(path);
    if (!m) continue;
    pathMatched = true;
    if (r.method !== method) continue;

    const params: Record<string, string> = {};
    r.keys.forEach((key, i) => (params[key] = decodeURIComponent(m[i + 1])));

    try {
      const data = await r.handler({ params, query, body: body ?? {}, user });
      // Deep copy: callers must never hold references into the mock db.
      return data === undefined ? { status: 204, data: undefined } : { status: 200, data: structuredClone(data) };
    } catch (err) {
      if (err instanceof MockHttpError) {
        return { status: err.status, data: { error: err.message, code: err.code } };
      }
      console.error('[mock] handler crashed', method, fullPath, err);
      return { status: 500, data: { error: String(err), code: 'INTERNAL_ERROR' } };
    }
  }

  return pathMatched
    ? { status: 405, data: { error: `${method} not allowed on ${path}`, code: 'METHOD_NOT_ALLOWED' } }
    : { status: 404, data: { error: `No mock for ${method} ${path}`, code: 'NOT_FOUND' } };
}
