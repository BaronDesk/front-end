import { IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../api/images';

/** The backend's image refusals, in words. */
export const IMAGE_REFUSALS: Record<string, string> = {
  IMAGE_UNSUPPORTED: 'That file is not a PNG, JPEG or WebP picture.',
  IMAGE_TOO_LARGE: 'That picture is over 2 MB. Pick a smaller one.',
  IMAGE_REQUIRED: 'Pick a picture first.',
};

/**
 * Why this file can't be sent, or null when it can. Checked before the
 * upload so a wrong file is refused at once; the server checks again (by
 * content, not by the type the browser reports).
 */
export function imageProblem(file: { size: number; type: string }): string | null {
  if (!IMAGE_ACCEPT.split(',').includes(file.type)) return IMAGE_REFUSALS.IMAGE_UNSUPPORTED;
  if (file.size > IMAGE_MAX_BYTES) return IMAGE_REFUSALS.IMAGE_TOO_LARGE;
  return null;
}
