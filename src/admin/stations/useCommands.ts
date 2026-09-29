import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../../api/http';
import type { Command, CommandStatus, CommandType, IssueCommandBody } from '../../api/types';
import { useRealtimeEvent } from '../../realtime/RealtimeContext';
import { STATIONS_PATH } from './station';

/**
 * Safety net if the final command_update never comes (e.g. the socket was
 * down). The backend answers first: ack timeout 10 s, 2 attempts by default.
 */
const CLIENT_TIMEOUT_MS = 30_000;
const MAX_NOTICES = 6;

/** Statuses a command can still leave. TIMEOUT is final here, though a late ack may still replace it in the log. */
const OPEN: ReadonlySet<CommandStatus> = new Set(['PENDING', 'SENT']);

export function isOpen(status: CommandStatus): boolean {
  return OPEN.has(status);
}

export interface CommandNotice {
  commandId: string;
  machineId: string;
  type: CommandType;
  status: Exclude<CommandStatus, 'PENDING' | 'SENT'> | 'NO_RESULT';
  /** The agent's nack code, if any. */
  code: string | null;
  reason: string | null;
  at: string;
}

function toNotice(c: Command): CommandNotice {
  return {
    commandId: c.commandId,
    machineId: c.machineId,
    type: c.type,
    status: c.status as CommandNotice['status'],
    code: c.nackCode,
    reason: c.nackReason ?? c.failureReason,
    at: c.resolvedAt ?? new Date().toISOString(),
  };
}

/**
 * Sends remote commands (POST /api/v1/stations/:id/commands, 202) and follows
 * each one through its command_update events until a final status
 * (brief §12, rule 3). `onUpdate` sees every update, e.g. to patch a command log.
 */
export function useCommands(onUpdate?: (command: Command) => void) {
  const [pending, setPending] = useState<Record<string, Command>>({});
  const [notices, setNotices] = useState<CommandNotice[]>([]);
  // A fast agent can answer before our POST returns; keep those final updates.
  const early = useRef(new Map<string, Command>());
  // Same ids as `pending`, but readable synchronously when an event lands before a re-render.
  const pendingIds = useRef(new Set<string>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
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
    setNotices((n) => [notice, ...n.filter((x) => x.commandId !== notice.commandId)].slice(0, MAX_NOTICES));
  }, []);

  useRealtimeEvent('command_update', (c) => {
    onUpdateRef.current?.(c);
    if (isOpen(c.status)) {
      if (pendingIds.current.has(c.commandId)) setPending((p) => ({ ...p, [c.commandId]: c }));
      return;
    }
    if (pendingIds.current.has(c.commandId)) settle(toNotice(c));
    else {
      // Also receives other staff's commands for the branch: keep only the latest few.
      early.current.set(c.commandId, c);
      if (early.current.size > 50) early.current.delete(early.current.keys().next().value!);
    }
  });

  useEffect(() => {
    const all = timers.current;
    return () => all.forEach(clearTimeout);
  }, []);

  const send = useCallback(
    async (machineId: string, body: IssueCommandBody) => {
      const cmd = await api<Command>('POST', `${STATIONS_PATH}/${machineId}/commands`, body);
      const already = early.current.get(cmd.commandId);
      if (already) {
        early.current.delete(cmd.commandId);
        setNotices((n) => [toNotice(already), ...n].slice(0, MAX_NOTICES));
        return already;
      }
      if (!isOpen(cmd.status)) {
        // e.g. FAILED at once when the server could not queue it.
        setNotices((n) => [toNotice(cmd), ...n].slice(0, MAX_NOTICES));
        return cmd;
      }
      pendingIds.current.add(cmd.commandId);
      setPending((p) => ({ ...p, [cmd.commandId]: cmd }));
      timers.current.set(
        cmd.commandId,
        setTimeout(
          () =>
            settle({
              commandId: cmd.commandId,
              machineId,
              type: body.type,
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
  CATALOG_UPDATE: 'Game list sync',
};
