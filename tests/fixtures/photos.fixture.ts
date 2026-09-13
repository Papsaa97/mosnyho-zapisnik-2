export interface EntryPhoto {
  id: string;
  entryId: string;
  createdAt: string;
  caption?: string;
  dataUrl: string;       // Compressed image with watermark (< 500 KB)
  thumbnailUrl: string;  // Fast thumbnail (320x240)
  sizeBytes: number;
  width: number;
  height: number;
}

// Helper to generate simulated Base64 data URLs with exact approximate byte sizes
export function generateMockImageDataUrl(targetBytes: number, mimeType = 'image/jpeg'): string {
  // Base64 encoding inflates size by ~4/3. A payload of length L represents ~ (L * 3/4) bytes.
  // In a data URL, the string length itself is what is stored in memory.
  const prefix = `data:${mimeType};base64,`;
  const base64Len = Math.max(16, targetBytes - prefix.length);
  const chunk = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const repeats = Math.ceil(base64Len / chunk.length);
  const payload = chunk.repeat(repeats).slice(0, base64Len);
  return `${prefix}${payload}`;
}

/** Photo < 500 KB (target 280 KB compressed JPEG) */
export const PHOTO_UNDER_500KB_DATA_URL = generateMockImageDataUrl(280 * 1024, 'image/jpeg');

/** Photo > 500 KB (target 1.2 MB raw high-res camera photo) */
export const PHOTO_OVER_500KB_RAW_DATA_URL = generateMockImageDataUrl(1200 * 1024, 'image/jpeg');

/** Boundary photo: exactly 499 KB */
export const PHOTO_BOUNDARY_499KB_DATA_URL = generateMockImageDataUrl(499 * 1024, 'image/jpeg');

/** Boundary photo: exactly 500 KB */
export const PHOTO_BOUNDARY_500KB_DATA_URL = generateMockImageDataUrl(500 * 1024, 'image/jpeg');

/** Boundary photo: 501 KB (requires titration) */
export const PHOTO_BOUNDARY_501KB_DATA_URL = generateMockImageDataUrl(501 * 1024, 'image/jpeg');

/** Fast thumbnail (320x240, ~18 KB) */
export const PHOTO_THUMBNAIL_DATA_URL = generateMockImageDataUrl(18 * 1024, 'image/jpeg');

/** Watermarked photo data URL (< 500 KB) */
export const PHOTO_WATERMARKED_DATA_URL = generateMockImageDataUrl(310 * 1024, 'image/jpeg');

/** Realistic EntryPhoto fixture with watermarked full image and thumbnail */
export const SAMPLE_ENTRY_PHOTO_FIXTURE: EntryPhoto = {
  id: 'photo-svary-01',
  entryId: 'entry-01',
  createdAt: '2026-03-02T14:30:00.000Z',
  caption: 'TIG svár nerezového hrdla DN150 – kořen a krycí vrstva',
  dataUrl: PHOTO_WATERMARKED_DATA_URL,
  thumbnailUrl: PHOTO_THUMBNAIL_DATA_URL,
  sizeBytes: 310 * 1024,
  width: 1920,
  height: 1080,
};

/** Second photo fixture (VT2 inspection) */
export const SAMPLE_ENTRY_PHOTO_VT2_FIXTURE: EntryPhoto = {
  id: 'photo-vt2-02',
  entryId: 'entry-01',
  createdAt: '2026-03-02T15:00:00.000Z',
  caption: 'Vizuální kontrola VT2 svaru č. 4 – bez povrchových vad',
  dataUrl: PHOTO_UNDER_500KB_DATA_URL,
  thumbnailUrl: PHOTO_THUMBNAIL_DATA_URL,
  sizeBytes: 280 * 1024,
  width: 1920,
  height: 1080,
};
