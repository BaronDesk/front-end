import { imageSrc } from '../../api/images';

/**
 * A stored image (badge, game image, avatar) as a small square, or nothing
 * when there is none. `round` for avatars.
 */
export function Thumb({ url, size = 32, alt = '', round = false }: { url: string | null | undefined; size?: number; alt?: string; round?: boolean }) {
  const src = imageSrc(url);
  if (!src) return null;
  return <img className={round ? 'thumb thumb-round' : 'thumb'} src={src} width={size} height={size} alt={alt} loading="lazy" />;
}
