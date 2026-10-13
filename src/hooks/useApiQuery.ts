import { useCallback, useEffect, useState } from 'react';

import { api } from '../core/http/client';

export interface ApiQuery<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  /** Fetch again; the old data stays on screen until the new data arrives. */
  reload(): void;
  /** Patch the data locally, e.g. from a live event. */
  setData(update: (data: T | undefined) => T | undefined): void;
}

/*
 * The last answer of every path read in this tab, so a page seen before shows
 * its data at once (no blank page while the network answers) and then
 * refreshes it in the background (stale-while-revalidate). One request per
 * path at a time: components asking for the same data share it.
 */
const cache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

/** Forgets every answer: on logout and login, so an account never sees another's data. */
export function clearQueryCache(): void {
  cache.clear();
  inflight.clear();
}

/** GET `path`, sharing a request already on its way unless `fresh` (a reload after an action wants new data). */
function get<T>(path: string, fresh: boolean): Promise<T> {
  let request = fresh ? undefined : inflight.get(path);
  if (!request) {
    request = api<T>('GET', path);
    inflight.set(path, request);
    const mine = request;
    void request.finally(() => inflight.get(path) === mine && inflight.delete(path)).catch(() => undefined);
  }
  return request as Promise<T>;
}

/** GET `path` on mount and whenever it changes. `null` = don't fetch. A path read before starts from its last answer. */
export function useApiQuery<T>(path: string | null): ApiQuery<T> {
  const [data, setDataState] = useState<T | undefined>(() => (path === null ? undefined : (cache.get(path) as T | undefined)));
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(path !== null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let cancelled = false;
    // A path read before: its last answer at once (otherwise the previous data stays until the new arrives).
    if (cache.has(path)) setDataState(cache.get(path) as T);
    setLoading(true);
    get<T>(path, version > 0).then(
      (result) => {
        if (cancelled) return;
        cache.set(path, result);
        setDataState(result);
        setError(null);
        setLoading(false);
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(err);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback(
    (update: (d: T | undefined) => T | undefined) =>
      setDataState((d) => {
        const next = update(d);
        if (path !== null) {
          if (next === undefined) cache.delete(path);
          else cache.set(path, next);
        }
        return next;
      }),
    [path],
  );

  return { data, error, loading, reload, setData };
}
