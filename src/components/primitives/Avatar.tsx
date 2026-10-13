import { imageSrc } from '../../lib/images';
import bidiHead from '../assets/avatar-bidi.svg';
import { u } from './Art';
import { cx } from '../../lib/cx';
import styles from './Avatar.module.css';

/** The gamer's picture in a ringed circle; BIDI's head until they upload one. `size`: its Figma size in px. */
export function Avatar({ url, size, className }: { url: string | null | undefined; size: number; className?: string }) {
  const photo = imageSrc(url);
  return (
    <span className={cx(styles.root, className)} style={{ width: u(size), height: u(size) }}>
      {photo ? <img className={styles.photo} src={photo} alt="" /> : <img className={styles.bidi} src={bidiHead} alt="" />}
    </span>
  );
}
