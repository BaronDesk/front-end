import { afterEach, describe, expect, it, vi } from 'vitest';

import { imageSrc, uploadImage } from './images';

describe('image uploads', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the picture as multipart, leaving the content type to the browser', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ url: '/uploads/images/a.webp' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadImage(new Blob(['png'], { type: 'image/png' }))).resolves.toBe('/uploads/images/a.webp');

    const [path, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe('/uploads/images');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('file')).toBeInstanceOf(Blob);
    expect(init.headers).not.toHaveProperty('Content-Type');
  });

  it('turns a stored link into an img src, and no link into none', () => {
    expect(imageSrc('/uploads/images/a.webp')).toBe('/uploads/images/a.webp');
    expect(imageSrc(null)).toBeUndefined();
    expect(imageSrc(undefined)).toBeUndefined();
  });
});
