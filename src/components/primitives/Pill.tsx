import type { ButtonHTMLAttributes } from 'react';

import { cx } from '../../lib/cx';
import styles from './Pill.module.css';

/** A Pill: a small outlined button showing a choice (ChipPicker opens its chips from it). Place it with className. */
export function Pill({ className, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={cx(styles.root, className)} {...rest} />;
}
