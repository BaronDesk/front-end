import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../../api/http';
import type { CommandLog, CommandResultEvent, CommandType } from '../../api/types';
import { useRealtimeEvent } from '../../realtime/RealtimeContext';

/**
 * Safety net if command_result never comes (e.g. the socket was down).
 * The backend's own timeout should answer first.
 */
const CLIENT_TIMEOUT_MS = 15_000;
const MAX_NOTICES = 6;

export interface CommandNotice {
  commandId: string;
  machineId: string;
  type: CommandType;
  status: CommandResultEvent['status'] | 'NO_RESULT';
  code: string | null;
  reason: string | null;
  at: string;
}

/**
 * Sends remote commands (POST /commands) and follows each one until its
 * command_result arrives on /dashboard-io (brief §12, rule 3).
 */
export function useCommands(onResult?: (result: CommandResultEvent) => void) {
  const [pending, setPending] = useState<Record<string, CommandLog>>({});
  const [notices, setNotices] = useState<CommandNotice[]>([]);
  // A fast agent can answer before our POST returns; keep those results.
  const early = useRef(new Map<string, CommandResultEvent>());
  // Same ids as `pending`, but readable synchronously when an event lands before a re-render.
  const pendingIds = useRef(new Set<string>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  });

  const settle = useCallback((notice: CommandNotice) => {
    pendingIds.current.delete(notice.commandId);
    clearTimeout(timers.current.get(notice.commandId));
    timers.current.delete(notice.commandId);
    setPending((p) => {
      if (!(notice.commandId in p)) return p;
      const next = { ...p };
      delete next[notice.commandId];
      return next;
    });
    setNotices((n) => [notice, ...n].slice(0, MAX_NOTICES));
  }, []);

  function fromResult(r: CommandResultEvent): CommandNotice {
    return { ...r, at: new Date().toISOString() };
  }

  useRealtimeEvent('command_result', (r) => {
    onResultRef.current?.(r);
    if (pendingIds.current.has(r.commandId)) settle(fromResult(r));
    else {
      // Also receives other staff's results for the branch: keep only the latest few.
      early.current.set(r.commandId, r);
      if (early.current.size > 50) early.current.delete(early.current.keys().next().value!);
    }
  });

  useEffect(() => {
    const all = timers.current;
    return () => all.forEach(clearTimeout);
  }, []);

  const send = useCallback(
    async (machineId: string, type: CommandType, payload: Record<string, unknown> = {}) => {
      const cmd = await api<CommandLog>('POST', '/commands', { machineId, type, payload });
      const already = early.current.get(cmd.id);
      if (already) {
        early.current.delete(cmd.id);
        setNotices((n) => [fromResult(already), ...n].slice(0, MAX_NOTICES));
        return cmd;
      }
      pendingIds.current.add(cmd.id);
      setPending((p) => ({ ...p, [cmd.id]: cmd }));
      timers.current.set(
        cmd.id,
        setTimeout(
          () =>
            settle({
              commandId: cmd.id,
              machineId,
              type,
              status: 'NO_RESULT',
              code: null,
              reason: 'no result received; check the command log',
              at: new Date().toISOString(),
            }),
          CLIENT_TIMEOUT_MS,
        ),
      );
      return cmd;
    },
    [settle],
  );

  /** The command still waiting for this station, if any. */
  const pendingFor = useCallback(
    (machineId: string) => Object.values(pending).find((c) => c.machineId === machineId),
    [pending],
  );

  return { send, pendingFor, notices };
}

export const COMMAND_LABEL: Record<CommandType, string> = {
  LOCK: 'Lock',
  UNLOCK: 'Unlock',
  SHUTDOWN: 'Shut down',
  LAUNCH_GAME: 'Launch game',
  END_SESSION: 'End session',
  POLICY_UPDATE: 'Policy update',
};
