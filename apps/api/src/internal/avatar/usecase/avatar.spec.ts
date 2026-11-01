import { describe, expect, it } from 'vitest';
import { detectImageMagicBytes } from './avatar.js';

describe('detectImageMagicBytes', () => {
  it('detects PNG magic bytes', () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    expect(detectImageMagicBytes(pngHeader)).toEqual({
      mime: 'image/png',
      ext: 'png',
    });
  });

  it('detects JPEG magic bytes', () => {
    const jpgHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(detectImageMagicBytes(jpgHeader)).toEqual({
      mime: 'image/jpeg',
      ext: 'jpg',
    });
  });

  it('detects WebP magic bytes', () => {
    const webpHeader = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50, // WEBP
    ]);
    expect(detectImageMagicBytes(webpHeader)).toEqual({
      mime: 'image/webp',
      ext: 'webp',
    });
  });

  it('rejects plain text or html disguised as image', () => {
    const text = Buffer.from('GIF89a this is not a gif or png');
    expect(detectImageMagicBytes(text)).toBeNull();

    const shortBuf = Buffer.from([0x89, 0x50]);
    expect(detectImageMagicBytes(shortBuf)).toBeNull();
  });
});
