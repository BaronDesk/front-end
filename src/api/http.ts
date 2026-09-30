import { config } from '../config';
import type { ApiErrorBody } from './types';

/** A non-2xx answer, carrying the backend's `{ error, code }`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type TokenProvider = () => string | null;
let tokenProvider: TokenProvider = () => null;

/** src/auth/tokens.ts plugs the in-memory access token in here. */
export function setTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider;
}

type RefreshHandler = () => Promise<boolean>;
let refreshHandler: RefreshHandler | null = null;

/** Called once on a 401; resolves true when a new access token is ready. */
export function setRefreshHandler(handler: RefreshHandler): void {
  refreshHandler = handler;
}

/** These answer 401 for bad credentials, not for an expired token: never retry them. */
const NO_REFRESH = ['/auth/login', '/auth/refresh', '/auth/logout'];

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * One call to the backend. Throws ApiError with the backend's `{ error, code }`
 * on a non-2xx answer. On a 401 the access token is refreshed once and the
 * call retried.
 */
export async function api<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  try {
    return await send<T>(method, path, body);
  } catch (err) {
    const retry = err instanceof ApiError && err.status === 401 && refreshHandler && !NO_REFRESH.includes(path);
    if (retry && (await refreshHandler!())) return send<T>(method, path, body);
    throw err;
  }
}

async function send<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const token = tokenProvider();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(config.apiBase + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server.');
  }
  const text = await res.text();
  const data = text ? parseJson(text) : undefined;

  if (res.status >= 400) {
    const err = data as Partial<ApiErrorBody> | undefined;
    throw new ApiError(res.status, err?.code ?? `HTTP_${res.status}`, err?.error ?? `Request failed (${res.status}).`);
  }
  // Every backend answer is JSON. Anything else (e.g. the dev server's own
  // index.html for a path it doesn't forward) must not pass as data.
  if (data === NOT_JSON) {
    throw new ApiError(res.status, 'BAD_RESPONSE', `The server did not answer ${path} with JSON (is this a backend path?).`);
  }
  return data as T;
}

const NOT_JSON = Symbol('not JSON');

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return NOT_JSON;
  }
}

/** One key per form submit; reuse it when retrying the same submit. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
