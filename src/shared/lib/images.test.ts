import { describe, expect, it } from 'vitest';

import { IMAGE_REFUSALS, imageProblem } from './images';

describe('imageProblem', () => {
  it('lets a PNG, JPEG or WebP up to 2 MB through', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(imageProblem({ type, size: 2 * 1024 * 1024 })).toBeNull();
    }
  });

  it('refuses other files and pictures over 2 MB', () => {
    expect(imageProblem({ type: 'image/gif', size: 10 })).toBe(IMAGE_REFUSALS.IMAGE_UNSUPPORTED);
    expect(imageProblem({ type: 'image/svg+xml', size: 10 })).toBe(IMAGE_REFUSALS.IMAGE_UNSUPPORTED);
    expect(imageProblem({ type: '', size: 10 })).toBe(IMAGE_REFUSALS.IMAGE_UNSUPPORTED);
    expect(imageProblem({ type: 'image/png', size: 2 * 1024 * 1024 + 1 })).toBe(IMAGE_REFUSALS.IMAGE_TOO_LARGE);
  });
});
