import { Link } from 'react-router';

import { ApiError } from '../../api/http';
import { ErrorBox } from '../../shared/components/ErrorBox';
import { commandErrorHint } from './station';

/**
 * A refused remote command. The refusals the desk can act on (nothing to
 * unlock, the gamer's money ran out) say what to do; anything else shows the
 * server's message.
 */
export function CommandError({ error, stationName }: { error: unknown; stationName: string }) {
  const hint = error instanceof ApiError ? commandErrorHint(error.code, stationName) : null;
  if (!hint || !(error instanceof ApiError)) return <ErrorBox error={error} />;
  return (
    <div className="msg msg-error" role="alert">
      {hint}
      {error.code === 'INSUFFICIENT_FUNDS' && (
        <>
          {' '}
          <Link to="/wallet">Wallet »</Link>
        </>
      )}
      <span className="muted"> ({error.code})</span>
    </div>
  );
}
