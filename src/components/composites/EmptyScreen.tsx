import type { ReactNode } from 'react';

import styles from './EmptyScreen.module.css';

/** A screen with nothing but a message, centered: a title, a line, and maybe an action under them. */
export function EmptyScreen({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <section className={styles.root}>
      <div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.text}>{text}</p>
        {children}
      </div>
    </section>
  );
}
