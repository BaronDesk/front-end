import { config } from '../core/config';

/** Over this size the backend refuses the picture (IMAGE_TOO_LARGE): check before sending. */
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/** What a file input should offer: <input type="file" accept={IMAGE_ACCEPT}>. */
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';

/**
 * The <img src> of a stored image (badgeUrl, iconUrl, avatarUrl), or
 * undefined for none. The links are backend paths, so they take the same
 * origin as the API calls.
 */
export function imageSrc(url: string | null | undefined): string | undefined {
  return url ? config.apiBase + url : undefined;
}
