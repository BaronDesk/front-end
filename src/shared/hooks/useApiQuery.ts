import { useCallback, useEffect, useState } from 'react';

import { api } from '../../api/http';

export interface ApiQuery<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  /** Fetch again; the old data stays on screen until the new data arrives. */
  reload(): void;
  /** Patch the data locally, e.g. from a live event. */
  setData(update: (data: T | undefined) => T | undefined): void;
}

/** GET `path` on mount and whenever it changes. `null` = don't fetch. */
export function useApiQuery<T>(path: string | null): ApiQuery<T> {
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(path !== null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let cancelled = false;
    setLoading(true);
    api<T>('GET', path).then(
      (result) => {
        if (cancelled) return;
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
  const setData = useCallback((update: (d: T | undefined) => T | undefined) => setDataState(update), []);

  return { data, error, loading, reload, setData };
}
