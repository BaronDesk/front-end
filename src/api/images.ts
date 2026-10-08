import { config } from '../config';
import { api } from './http';
import type { PublicUser, UploadedImage } from './types';

/**
 * Image uploads. The backend checks the picture (PNG, JPEG or WebP), stores
 * it as WebP and answers its link. Refusals arrive as ApiError with code
 * IMAGE_UNSUPPORTED, IMAGE_TOO_LARGE (413) or IMAGE_REQUIRED.
 */

/** Over this size the backend refuses the picture (IMAGE_TOO_LARGE): check before sending. */
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/** What a file input should offer: <input type="file" accept={IMAGE_ACCEPT}>. */
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';

function form(file: Blob): FormData {
  const body = new FormData();
  body.append('file', file);
  return body;
}

/**
 * Manager+: stores a badge or game image (fitted in 512×512). Save the
 * answered link as the badgeUrl of a membership tier, pass or rank, or the
 * iconUrl of a game.
 */
export async function uploadImage(file: Blob): Promise<string> {
  return (await api<UploadedImage>('POST', '/uploads/images', form(file))).url;
}

/** The gamer's own profile picture (cropped to 256×256); answers the updated user. */
export function setMyAvatar(file: Blob): Promise<PublicUser> {
  return api<PublicUser>('PUT', '/users/me/avatar', form(file));
}

export function removeMyAvatar(): Promise<PublicUser> {
  return api<PublicUser>('DELETE', '/users/me/avatar');
}

/**
 * The <img src> of a stored image (badgeUrl, iconUrl, avatarUrl), or
 * undefined for none. The links are backend paths, so they take the same
 * origin as the API calls.
 */
export function imageSrc(url: string | null | undefined): string | undefined {
  return url ? config.apiBase + url : undefined;
}
