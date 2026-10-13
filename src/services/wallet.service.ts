import { api } from '../core/http/client';
import type { WalletEntry, WalletMovement } from '../core/api-types';

/** Wallets: the gamer reads their own; the desk tops up and corrects a gamer's (by gamer profile id). */
export const walletService = {
  paths: {
    mine: '/wallets/me',
    entries: (take: number) => `/wallets/me/entries?take=${take}`,
    of: (gamerProfileId: string) => `/wallets/${gamerProfileId}`,
    entriesOf: (gamerProfileId: string, take: number) => `/wallets/${gamerProfileId}/entries?take=${take}`,
  },
  /** A top-up or a correction; the idempotency key makes a double click count once. */
  move: (gamerProfileId: string, body: WalletMovement) => api<WalletEntry>('POST', `/wallets/${gamerProfileId}/credit`, body),
};
