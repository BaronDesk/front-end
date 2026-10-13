import type { ReactNode } from 'react';

import styles from './BranchSection.module.css';

/** One branch's part of a page (Stations, Sessions): its name and figures, then its room and table; branches well apart. */
export function BranchSection({ name, figures, children }: { name: string; figures: string; children: ReactNode }) {
  return (
    <section className={styles.branch}>
      <h2 className={styles.title}>
        {name}
        <span className="muted"> &middot; {figures}</span>
      </h2>
      {children}
    </section>
  );
}
