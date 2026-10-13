import { useAuth } from '../../../../providers/AuthProvider';
import { useMyWallet, useWalletEntries } from '../../../../hooks/queries';
import { dayDateTime } from '../../../../lib/dates';
import { groupThousands } from '../../../../lib/format';
import { entryText } from '../../../../domain/wallet';
import { WalletCard } from '../../../../components/composites/WalletCard';
import { Notice } from '../../../../components/primitives/Notice';
import { Card } from '../../../../components/primitives/Card';
import { SectionTitle } from '../../../../components/primitives/SectionTitle';
import { PageTitle } from '../../../../components/primitives/PageTitle';
import { Page } from '../../../../components/layout/Page';
import { cx } from '../../../../lib/cx';
import styles from './WalletPage.module.css';

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${groupThousands(Math.abs(n))}`;

/**
 * My wallet (brief §6.7; Profile's wallet card, Bookings' coins), in the
 * design's style: the balance, how to top up (at the desk, which finds the
 * gamer by username) and the latest movements.
 */
export function WalletPage() {
  const { user } = useAuth();
  const wallet = useMyWallet();
  const entries = useWalletEntries(30);
  const list = entries.data ?? [];

  return (
    <Page>
      <PageTitle>My Wallet</PageTitle>
      <div className={styles.pageCard}>
        <WalletCard balance={wallet.data?.balance} />
      </div>

      <Card as="p" className={styles.topup}>
        <b>Top up at the desk:</b> pay in cash and give them your username, <b>{user?.username}</b>. 1000 coins = 1 DT.
      </Card>

      <SectionTitle className={styles.head}>History</SectionTitle>
      <div className={styles.entries}>
        {list.map((x) => (
          <Card as="article" key={x.id} className={styles.entry}>
            <div>
              <p className={styles.entryWhat}>{entryText(x)}</p>
              <p className={styles.entryWhen}>{dayDateTime(x.createdAt)}</p>
            </div>
            <div className={styles.entryRight}>
              <p className={x.amount < 0 ? cx(styles.entryAmount, styles.entryOut) : styles.entryAmount}>{signed(x.amount)}</p>
              <p className={styles.entryWhen}>balance {groupThousands(x.balanceAfter)}</p>
            </div>
          </Card>
        ))}
        {entries.data && list.length === 0 && <Card as="p">No movement yet.</Card>}
        {Boolean(wallet.error ?? entries.error) && <Notice tone="error">Your wallet could not be loaded.</Notice>}
      </div>
    </Page>
  );
}
