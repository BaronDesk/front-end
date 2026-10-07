import type { Action } from '../hooks/useAction';
import { ErrorBox } from './ErrorBox';

/** The action's error (red) or success message. */
export function ActionMessages({ action }: { action: Action }) {
  return (
    <>
      <ErrorBox error={action.error} />
      {action.message && <div className="msg msg-ok">{action.message}</div>}
    </>
  );
}
