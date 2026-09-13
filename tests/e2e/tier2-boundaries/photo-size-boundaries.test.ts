import { describe, it, expect } from 'vitest';
import {
  MAX_PHOTO_BYTES,
  MAX_DIMENSION,
  ImageDimensions,
  calculateDownscaledDimensions,
  generateByteAccurateDataUrl,
  getByteSizeFromDataUrl,
  CompressionResult,
  simulateProcessFieldPhoto,
} from '../../../src/services/imageCompressionService';

export {
  MAX_PHOTO_BYTES,
  MAX_DIMENSION,
  calculateDownscaledDimensions,
  generateByteAccurateDataUrl,
  getByteSizeFromDataUrl,
  simulateProcessFieldPhoto,
};
export type { ImageDimensions, CompressionResult };

describe('Tier 2 Boundary: Photo Size & Compression Boundaries (photo-size-boundaries.test.ts)', () => {
  // 1. Boundary: Exactly 499 KB (accepted without downsampling)
  it('accepts 499 KB photo without downsampling or titration loss', () => {
    const dataUrl499 = generateByteAccurateDataUrl(499 * 1024);
    const size499 = getByteSizeFromDataUrl(dataUrl499);
    expect(size499).toBe(499 * 1024);
    expect(size499).toBeLessThan(MAX_PHOTO_BYTES);

    const result = simulateProcessFieldPhoto(dataUrl499, 1920, 1080);
    expect(result.sizeBytes).toBeLessThanOrEqual(MAX_PHOTO_BYTES);
    expect(result.sizeBytes).toBe(size499);
    expect(result.downsampled).toBe(false);
    expect(result.qualityApplied).toBe(1.0);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
  });

  // 2. Boundary: Exactly 500 KB boundary condition
  it('accepts 500 KB photo exactly at the boundary threshold', () => {
    const dataUrl500 = generateByteAccurateDataUrl(500 * 1024);
    const size500 = getByteSizeFromDataUrl(dataUrl500);
    expect(size500).toBe(500 * 1024);
    expect(size500).toBeLessThanOrEqual(MAX_PHOTO_BYTES);

    const result = simulateProcessFieldPhoto(dataUrl500, 1920, 1080);
    expect(result.sizeBytes).toBeLessThanOrEqual(MAX_PHOTO_BYTES);
  });

  // 3. Boundary: 501 KB (titrated down strictly < 500 KB)
  it('titrates 501 KB photo down so final size is strictly < 500 KB', () => {
    const dataUrl501 = generateByteAccurateDataUrl(501 * 1024);
    const size501 = getByteSizeFromDataUrl(dataUrl501);
    expect(size501).toBe(501 * 1024);
    expect(size501).toBeGreaterThan(MAX_PHOTO_BYTES);

    const result = simulateProcessFieldPhoto(dataUrl501, 1920, 1080);
    expect(result.sizeBytes).toBeLessThan(MAX_PHOTO_BYTES);
    expect(result.downsampled).toBe(true);
    expect(result.qualityApplied).toBeLessThan(1.0);
  });

  // 4. Large raw photo (1.2 MB) compression
  it('compresses 1.2 MB raw camera photo down to well under 500 KB', () => {
    const dataUrlRaw = generateByteAccurateDataUrl(1200 * 1024);
    const rawBytes = getByteSizeFromDataUrl(dataUrlRaw);
    expect(rawBytes).toBe(1200 * 1024);
    expect(rawBytes).toBeGreaterThan(1_000_000);

    const result = simulateProcessFieldPhoto(dataUrlRaw, 3840, 2160);
    expect(result.sizeBytes).toBeLessThan(MAX_PHOTO_BYTES);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.downsampled).toBe(true);
  });

  // 5. 4K Resolution Downscaling (3840x2160 -> 1920x1080)
  it('downscales 4K resolution (3840x2160) to 1920x1080 preserving 16:9 aspect ratio', () => {
    const dims = calculateDownscaledDimensions(3840, 2160, 1920);
    expect(dims.width).toBe(1920);
    expect(dims.height).toBe(1080);
    // Aspect ratio check
    const originalRatio = 3840 / 2160;
    const scaledRatio = dims.width / dims.height;
    expect(Math.abs(originalRatio - scaledRatio)).toBeLessThan(0.001);
  });

  // 6. Extreme Aspect Ratios (Ultra-wide and Ultra-tall)
  it('handles extreme panoramic (4000x1000) and ultra-tall (1000x4000) aspect ratios', () => {
    // Panoramic
    const panoramaDims = calculateDownscaledDimensions(4000, 1000, 1920);
    expect(panoramaDims.width).toBe(1920);
    expect(panoramaDims.height).toBe(480);
    expect(Math.max(panoramaDims.width, panoramaDims.height)).toBeLessThanOrEqual(1920);

    // Ultra-tall vertical
    const tallDims = calculateDownscaledDimensions(1000, 4000, 1920);
    expect(tallDims.width).toBe(480);
    expect(tallDims.height).toBe(1920);
    expect(Math.max(tallDims.width, tallDims.height)).toBeLessThanOrEqual(1920);
  });

  // 7. Corrupted image data handling
  it('guards against corrupted image data, malformed data URLs, and non-positive dimensions', () => {
    expect(() => getByteSizeFromDataUrl('not-a-data-url')).toThrow('Invalid data URL format');
    expect(() => getByteSizeFromDataUrl('data:image/jpeg;base64')).toThrow('Malformed data URL');
    expect(() => calculateDownscaledDimensions(0, 100)).toThrow('Invalid image dimensions');
    expect(() => calculateDownscaledDimensions(-50, -50)).toThrow('Invalid image dimensions');
  });
});
