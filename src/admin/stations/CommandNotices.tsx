import { formatClock } from '../../shared/format';
import { COMMAND_LABEL, type CommandNotice } from './useCommands';

const STATUS_TEXT: Record<CommandNotice['status'], string> = {
  ACKED: 'accepted by the station',
  NACKED: 'refused by the station',
  FAILED: 'failed',
  TIMEOUT: 'no response from station',
  NO_RESULT: 'no result yet',
};

/** Latest command results, newest first: "14:05:09 TUN-01 Lock: accepted by the station". */
export function CommandNotices({ notices, stationName }: { notices: CommandNotice[]; stationName(id: string): string }) {
  if (notices.length === 0) return null;
  return (
    <div className="msg">
      <b>Command results</b>
      <ul className="notices">
        {notices.map((n) => (
          <li key={n.commandId} className={n.status === 'ACKED' ? '' : 'status-bad'}>
            {formatClock(n.at)} &nbsp; {stationName(n.machineId)} &nbsp; {COMMAND_LABEL[n.type]}: {STATUS_TEXT[n.status]}
            {n.reason && ` (${n.reason}${n.code ? `, ${n.code}` : ''})`}
          </li>
        ))}
      </ul>
    </div>
  );
}
