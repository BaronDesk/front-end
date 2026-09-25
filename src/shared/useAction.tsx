import { useCallback, useState } from 'react';

import { ErrorBox } from './ErrorBox';

export interface Action {
  /** Key of the action in progress (e.g. a row id), or null. */
  busy: string | null;
  error: unknown;
  message: string | null;
  /**
   * Run `fn`, tracking busy/error. On success shows `success` (text, or built
   * from the result). Resolves to the result, or undefined on error.
   */
  run<T>(key: string, fn: () => Promise<T>, success?: string | ((result: T) => string)): Promise<T | undefined>;
  clear(): void;
}

/** Pending / success / error state for the buttons of one page (brief §12, rule 3). */
export function useAction(): Action {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<T>, success?: string | ((result: T) => string)) => {
      setBusy(key);
      setError(null);
      setMessage(null);
      try {
        const result = await fn();
        if (success) setMessage(typeof success === 'string' ? success : success(result));
        return result;
      } catch (err) {
        setError(err);
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const clear = useCallback(() => {
    setError(null);
    setMessage(null);
  }, []);

  return { busy, error, message, run, clear };
}

/** The action's error (red) or success message. */
export function ActionMessages({ action }: { action: Action }) {
  return (
    <>
      <ErrorBox error={action.error} />
      {action.message && <div className="msg msg-ok">{action.message}</div>}
    </>
  );
}
