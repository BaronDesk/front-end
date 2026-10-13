import type { ReactNode } from 'react';

import { cx } from '../../lib/cx';
import { describeError } from '../../lib/errors';
import styles from './Notice.module.css';

interface NoticeProps {
  tone?: 'info' | 'error';
  align?: 'start' | 'center';
  className?: string;
  children: ReactNode;
}

/** A short line under a form or a list: info in brown, an error in red (announced to screen readers). */
export function Notice({ tone = 'info', align = 'start', className, children }: NoticeProps) {
  return (
    <p className={cx(styles.root, tone === 'error' && styles.error, align === 'center' && styles.center, className)} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}

/** What a button did (useAction's message or error), as a Notice; nothing while there is neither. */
export function ActionNote({ action, align, className }: { action: { message: string | null; error: unknown }; align?: 'start' | 'center'; className?: string }) {
  if (action.error) {
    return (
      <Notice tone="error" align={align} className={className}>
        {describeError(action.error).message}
      </Notice>
    );
  }
  return action.message ? (
    <Notice align={align} className={className}>
      {action.message}
    </Notice>
  ) : null;
}
