import type { WalletEntry } from '../api/types';

/** What a ledger line is, for people. A session charge is a PAYMENT with a sessionId. */
export function entryText(entry: Pick<WalletEntry, 'type' | 'sessionId'>): string {
  switch (entry.type) {
    case 'CREDIT':
      return 'Top-up';
    case 'REFUND':
      return 'Refund';
    case 'PAYMENT':
      return entry.sessionId ? 'Play time' : 'Plan purchase';
    case 'DEBIT':
      return 'Debit';
    case 'ADJUSTMENT':
      return 'Correction';
    default:
      return entry.type;
  }
}
