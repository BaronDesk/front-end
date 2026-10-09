/** Wallets and their ledger (amounts in coins). */

/** wallet ledger entry types (Prisma TransactionType). A session charge is a PAYMENT with a sessionId. */
export type TransactionType = 'PAYMENT' | 'REFUND' | 'ADJUSTMENT' | 'CREDIT' | 'DEBIT';

/** GET /wallets/me, GET /wallets/:gamerProfileId (wallet/util/public-wallet.ts). */
export interface Wallet {
  id: string;
  /** The gamer's profile id: what every staff wallet route takes (the desk finds it with GET /gamers?q=). */
  gamerProfileId: string;
  /** Coins. */
  balance: number;
  updatedAt: string;
}

/** GET …/entries, POST …/credit and …/debit. */
export interface WalletEntry {
  id: string;
  walletId: string;
  /** Coins: positive = credit, negative = debit. */
  amount: number;
  balanceAfter: number;
  type: TransactionType;
  /** Set on a session charge. */
  sessionId: string | null;
  createdAt: string;
}

/** POST /wallets/:gamerProfileId/credit|debit body. */
export interface WalletMovement {
  /** Coins, a positive whole number. */
  amount: number;
  type?: TransactionType;
  sessionId?: string;
  idempotencyKey?: string;
}
