import type { ReactNode } from 'react';

import styles from './BranchSection.module.css';

/** One branch's part of a page (Stations, Bookings): its name (and figures, if any), then its room and tables; branches well apart. */
export function BranchSection({ name, figures, children }: { name: string; figures?: string; children: ReactNode }) {
  return (
    <section className={styles.branch}>
      <h2 className={styles.title}>
        {name}
        {figures && <span className="muted"> &middot; {figures}</span>}
      </h2>
      {children}
    </section>
  );
}
