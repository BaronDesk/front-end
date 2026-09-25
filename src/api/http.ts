import { config, isMocked } from '../config';
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
 * One call to the backend. Routes that are mocked (see config.isMocked) are
 * answered in the browser by src/mocks; the rest go over fetch. Both paths
 * return the same data and throw the same ApiError. On a 401 the access
 * token is refreshed once and the call retried.
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
  let status: number;
  let data: unknown;

  if (isMocked(path)) {
    // Dynamic import keeps the mock code out of the bundle unless it's used.
    const { handleMockRequest } = await import('../mocks/server');
    ({ status, data } = await handleMockRequest(method, path, body, token));
  } else {
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
    status = res.status;
    const text = await res.text();
    data = text ? parseJson(text) : undefined;
  }

  if (status >= 400) {
    const err = data as Partial<ApiErrorBody> | undefined;
    throw new ApiError(status, err?.code ?? `HTTP_${status}`, err?.error ?? `Request failed (${status}).`);
  }
  return data as T;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { error: text, code: 'BAD_RESPONSE' };
  }
}

/** One key per form submit; reuse it when retrying the same submit. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
