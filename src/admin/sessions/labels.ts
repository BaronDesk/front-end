import type { SessionStatus } from '../../api/types';

export const SESSION_STATUS_TEXT: Record<SessionStatus, string> = {
  PENDING: 'Waiting for the PIN on the station',
  ACTIVE: 'Playing',
  PAUSED: 'Paused (station locked)',
  COMPLETED: 'Ended',
  CANCELLED: 'Cancelled',
};

/** Still running: can be ended, and not billed yet. */
export function isOpenSession(status: SessionStatus): boolean {
  return status === 'PENDING' || status === 'ACTIVE' || status === 'PAUSED';
}
