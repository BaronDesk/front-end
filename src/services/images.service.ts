import { api } from '../core/http/client';
import type { PublicUser, UploadedImage } from '../core/api-types';

/**
 * Image uploads. The backend checks the picture (PNG, JPEG or WebP), stores
 * it as WebP and answers its link. Refusals arrive as ApiError with code
 * IMAGE_UNSUPPORTED, IMAGE_TOO_LARGE (413) or IMAGE_REQUIRED.
 */

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
