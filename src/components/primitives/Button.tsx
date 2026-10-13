import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';

import { cx } from '../../lib/cx';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface Look {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** An icon before the label. */
  icon?: ReactNode;
}

const classes = ({ variant = 'primary', size = 'md' }: Look, className?: string) => cx(styles.root, styles[size], styles[variant], className);

/** A button in the design system's look: pick a variant and a size, place it with className. */
export function Button({ variant, size, icon, className, children, type = 'button', ...rest }: Look & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={classes({ variant, size }, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

/** A link that looks like a Button (navigation, not an action). */
export function ButtonLink({ variant, size, icon, className, children, ...rest }: Look & LinkProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return (
    <Link className={classes({ variant, size }, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

/** Buttons side by side, wrapping to the next line when the row is full. */
export function ButtonRow({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx(styles.row, className)}>{children}</div>;
}
