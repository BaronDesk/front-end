/** Why a session ended (backend endReason). Unknown reasons show as-is. */
const END_REASON: Record<string, string> = {
  STAFF_ENDED: 'Ended by staff',
  USER_ENDED: 'Ended by the gamer',
  BALANCE_EXHAUSTED: 'Balance ran out (station auto-locked)',
  SHUTDOWN: 'Station shut down',
};

export function endReasonLabel(reason: string | null): string {
  return reason ? (END_REASON[reason] ?? reason) : '—';
}
