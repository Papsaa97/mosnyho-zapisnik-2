import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MAX_PHOTO_BYTES,
  MAX_WIDTH,
  MAX_HEIGHT,
  MAX_DIMENSION,
  validateImageFile,
  calculateTargetDimensions,
  calculateDownscaledDimensions,
  getByteSizeFromDataUrl,
  generateByteAccurateDataUrl,
  stampPhotoWatermark,
  compressImageToUnder500KB,
  processFieldPhoto,
  preparePhotosForProtocol,
} from '../src/services/imageCompressionService';
import { EntryPhoto } from '../src/types';

describe('Milestone M4 Challenger: Empirical Stress Test Suite (imageCompressionService)', () => {

  // =========================================================================
  // Section 1: File Size Ceiling (< 500 KB / 512,000 bytes) & Titration
  // =========================================================================
  describe('1. File Size Ceiling (< 500 KB / 512,000 bytes) & Titration', () => {

    it('verifies MAX_PHOTO_BYTES constant strictly equals 512,000 bytes (500 KB)', () => {
      expect(MAX_PHOTO_BYTES).toBe(500 * 1024);
      expect(MAX_PHOTO_BYTES).toBe(512000);
    });

    it('compresses moderate raw photos (600 KB - 1 MB) down to strictly < 500 KB', () => {
      const sizesToTest = [513_000, 600_000, 750_000, 900_000, 1_000_000];
      for (const rawSize of sizesToTest) {
        const result = compressImageToUnder500KB(rawSize);
        expect(result.finalSizeBytes).toBeLessThan(MAX_PHOTO_BYTES);
        expect(result.iterations).toBeGreaterThanOrEqual(1);
      }
    });

    it('stress-tests compressImageToUnder500KB with large payloads (1.5 MB, 2 MB, 5 MB, 10 MB)', () => {
      // Construction photos from modern phones are often 2 MB - 10 MB.
      // Verified: compressImageToUnder500KB iterative scaling guarantees < MAX_PHOTO_BYTES
      const largePayloads = [1_400_000, 2_000_000, 5_000_000, 10_000_000];
      const results = largePayloads.map(size => ({
        initial: size,
        ...compressImageToUnder500KB(size),
      }));

      for (const res of results) {
        expect(res.finalSizeBytes).toBeLessThan(MAX_PHOTO_BYTES);
        expect(res.iterations).toBeGreaterThanOrEqual(5);
      }
    });

    it('stress-tests processFieldPhoto under simulated high-entropy canvas output (> 500 KB)', async () => {
      // Mock createImageBitmap on both globalThis and window for hermetic test environment
      const originalGlobalBmp = (globalThis as any).createImageBitmap;
      const originalWindowBmp = typeof window !== 'undefined' ? (window as any).createImageBitmap : undefined;

      const mockBmpFn = vi.fn().mockResolvedValue({
        width: 3840,
        height: 2160,
        close: vi.fn(),
      });
      (globalThis as any).createImageBitmap = mockBmpFn;
      if (typeof window !== 'undefined') {
        (window as any).createImageBitmap = mockBmpFn;
      }

      // Simulate high-entropy canvas where initial JPEG export at 0.85 is 750 KB,
      // and even after 0.8x downscale and quality 0.60, it stays above 500 KB (550 KB).
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

      let callCount = 0;
      HTMLCanvasElement.prototype.toDataURL = vi.fn(function (
        this: HTMLCanvasElement,
        type: string = 'image/jpeg',
        quality: number = 0.85
      ) {
        callCount++;
        // If requesting thumbnail (canvas width <= 320)
        if (this.width <= 320) {
          return generateByteAccurateDataUrl(15_000, type);
        }
        // For full photo canvas: simulate noisy image where size remains > 500 KB
        // Even at 0.60 quality, return 520,000 bytes (exceeds 512,000 bytes MAX_PHOTO_BYTES)
        const simulatedDecodedBytes = Math.max(520_000, Math.round(750_000 * (quality / 0.85)));
        return generateByteAccurateDataUrl(simulatedDecodedBytes, type);
      });

      try {
        const dummyBlob = new Blob(['test-image-content'], { type: 'image/jpeg' });
        const result = await processFieldPhoto({
          file: dummyBlob,
          projectCode: 'STRESS-01',
          projectName: 'High Entropy Noise Test',
          welderName: 'Jan Svářeč',
          caption: 'Sparks and metal reflections',
        });

        // Verify that processFieldPhoto attempted titration
        expect(callCount).toBeGreaterThan(1);
        expect(result.thumbnailDataUrl).toBeDefined();
        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);

        // EMPIRICAL VULNERABILITY FINDING:
        // When canvas output remains high-entropy (> 500 KB) after the single 0.8x downscaling step at quality 0.60,
        // processFieldPhoto does NOT loop or further compress; it returns an oversized photo (> 512,000 bytes)!
        expect(result.sizeBytes).toBeGreaterThan(MAX_PHOTO_BYTES);
      } finally {
        HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
        (globalThis as any).createImageBitmap = originalGlobalBmp;
        if (typeof window !== 'undefined') {
          (window as any).createImageBitmap = originalWindowBmp;
        }
      }
    }, 15000);
  });

  // =========================================================================
  // Section 2: Extreme Image Dimensions
  // =========================================================================
  describe('2. Extreme Image Dimensions (50 MP, panoramic, ultra-tall, 10x10)', () => {

    it('downscales 50 MP (8000x6000, 4:3 landscape) strictly into 1920x1080 bounding box', () => {
      const target = calculateTargetDimensions(8000, 6000);
      expect(target.width).toBeLessThanOrEqual(MAX_WIDTH);
      expect(target.height).toBeLessThanOrEqual(MAX_HEIGHT);
      expect(target.width).toBe(1440);
      expect(target.height).toBe(1080);
      // Aspect ratio check
      expect(target.width / target.height).toBeCloseTo(8000 / 6000, 4);

      const downscaled = calculateDownscaledDimensions(8000, 6000, 1920);
      expect(downscaled.width).toBe(1920);
      expect(downscaled.height).toBe(1440); // Note: calculateDownscaledDimensions only checks max(w,h) <= 1920
      expect(Math.max(downscaled.width, downscaled.height)).toBe(1920);
    });

    it('downscales 50 MP portrait (6000x8000, 3:4 portrait) into bounding box', () => {
      const target = calculateTargetDimensions(6000, 8000);
      expect(target.width).toBeLessThanOrEqual(MAX_WIDTH);
      expect(target.height).toBeLessThanOrEqual(MAX_HEIGHT);
      expect(target.height).toBe(1080);
      expect(target.width).toBe(810);
      expect(target.width / target.height).toBeCloseTo(6000 / 8000, 4);
    });

    it('handles extreme panoramic (5000x500, 10:1 aspect ratio)', () => {
      const target = calculateTargetDimensions(5000, 500);
      expect(target.width).toBe(1920);
      expect(target.height).toBe(192);
      expect(target.width / target.height).toBeCloseTo(5000 / 500, 2);

      const downscaled = calculateDownscaledDimensions(5000, 500, 1920);
      expect(downscaled.width).toBe(1920);
      expect(downscaled.height).toBe(192);
    });

    it('handles extreme ultra-tall vertical (500x5000, 1:10 aspect ratio)', () => {
      const target = calculateTargetDimensions(500, 5000);
      expect(target.width).toBe(108);
      expect(target.height).toBe(1080);
      expect(target.width / target.height).toBeCloseTo(500 / 5000, 2);

      const downscaled = calculateDownscaledDimensions(500, 5000, 1920);
      expect(downscaled.width).toBe(192);
      expect(downscaled.height).toBe(1920);
    });

    it('preserves tiny dimensions (10x10, 1x1) without upscaling', () => {
      const target10 = calculateTargetDimensions(10, 10);
      expect(target10.width).toBe(10);
      expect(target10.height).toBe(10);

      const target1 = calculateTargetDimensions(1, 1);
      expect(target1.width).toBe(1);
      expect(target1.height).toBe(1);

      const down10 = calculateDownscaledDimensions(10, 10);
      expect(down10.width).toBe(10);
      expect(down10.height).toBe(10);
    });
  });

  // =========================================================================
  // Section 3: Boundary Tests around 1920x1080
  // =========================================================================
  describe('3. Boundary Tests around 1920x1080', () => {

    it('leaves exact 1920x1080 unchanged', () => {
      const dims = calculateTargetDimensions(1920, 1080);
      expect(dims.width).toBe(1920);
      expect(dims.height).toBe(1080);

      const down = calculateDownscaledDimensions(1920, 1080);
      expect(down.width).toBe(1920);
      expect(down.height).toBe(1080);
    });

    it('downscales 1921x1081 (1 pixel above boundary) to fit strictly within 1920x1080', () => {
      const dims = calculateTargetDimensions(1921, 1081);
      expect(dims.width).toBeLessThanOrEqual(MAX_WIDTH);
      expect(dims.height).toBeLessThanOrEqual(MAX_HEIGHT);
      expect(dims.width).toBe(1919);
      expect(dims.height).toBe(1080);
    });

    it('downscales 1921x1080 (width 1 pixel over)', () => {
      const dims = calculateTargetDimensions(1921, 1080);
      expect(dims.width).toBeLessThanOrEqual(MAX_WIDTH);
      expect(dims.height).toBeLessThanOrEqual(MAX_HEIGHT);
      expect(dims.width).toBe(1920);
      expect(dims.height).toBe(1079);
    });

    it('downscales 1920x1081 (height 1 pixel over)', () => {
      const dims = calculateTargetDimensions(1920, 1081);
      expect(dims.width).toBeLessThanOrEqual(MAX_WIDTH);
      expect(dims.height).toBeLessThanOrEqual(MAX_HEIGHT);
      expect(dims.width).toBe(1918);
      expect(dims.height).toBe(1080);
    });

    it('leaves 1919x1079 (1 pixel below boundary) completely unscaled', () => {
      const dims = calculateTargetDimensions(1919, 1079);
      expect(dims.width).toBe(1919);
      expect(dims.height).toBe(1079);
    });
  });

  // =========================================================================
  // Section 4: Malformed Inputs, Negative Dimensions, and Invalid MIME Types
  // =========================================================================
  describe('4. Malformed Inputs, Negative Dimensions, and Invalid MIME Types', () => {

    it('calculateDownscaledDimensions rejects zero and negative dimensions with descriptive errors', () => {
      expect(() => calculateDownscaledDimensions(0, 100)).toThrow(/Invalid image dimensions/);
      expect(() => calculateDownscaledDimensions(100, 0)).toThrow(/Invalid image dimensions/);
      expect(() => calculateDownscaledDimensions(-1, 100)).toThrow(/Invalid image dimensions/);
      expect(() => calculateDownscaledDimensions(100, -1)).toThrow(/Invalid image dimensions/);
      expect(() => calculateDownscaledDimensions(-10, -20)).toThrow(/Invalid image dimensions/);
    });

    it('evaluates calculateTargetDimensions with zero or negative dimensions (vulnerability probe)', () => {
      // calculateTargetDimensions does NOT currently throw on zero or negative values.
      // Probing its actual behavior:
      const zeroResult = calculateTargetDimensions(0, 0);
      expect(zeroResult).toEqual({ width: 0, height: 0 });

      const negResult = calculateTargetDimensions(-10, -20);
      expect(negResult).toEqual({ width: -10, height: -20 });

      const mixedNeg = calculateTargetDimensions(-100, 2000);
      // ratio = Math.min(1920 / -100, 1080 / 2000) = Math.min(-19.2, 0.54) = -19.2
      // width = Math.round(-100 * -19.2) = 1920
      // height = Math.round(2000 * -19.2) = -38400 (corrupted negative height)
      expect(mixedNeg.height).toBeLessThan(0);
    });

    it('getByteSizeFromDataUrl rejects malformed strings cleanly', () => {
      expect(() => getByteSizeFromDataUrl('')).toThrow('Invalid data URL format');
      expect(() => getByteSizeFromDataUrl('https://example.com/test.jpg')).toThrow('Invalid data URL format');
      expect(() => getByteSizeFromDataUrl('data:image/jpeg;base64')).toThrow('Malformed data URL: missing payload');
    });

    it('getByteSizeFromDataUrl accurately computes byte size for varied base64 padding', () => {
      // 0 padding characters (length % 3 === 0)
      const dataUrl3 = 'data:image/jpeg;base64,AAAA'; // 4 chars -> 3 bytes
      expect(getByteSizeFromDataUrl(dataUrl3)).toBe(3);

      // 1 padding character (length % 3 === 2)
      const dataUrl2 = 'data:image/jpeg;base64,AAA='; // 4 chars -> 2 bytes
      expect(getByteSizeFromDataUrl(dataUrl2)).toBe(2);

      // 2 padding characters (length % 3 === 1)
      const dataUrl1 = 'data:image/jpeg;base64,AA=='; // 4 chars -> 1 byte
      expect(getByteSizeFromDataUrl(dataUrl1)).toBe(1);

      // 0 bytes
      const dataUrl0 = 'data:image/jpeg;base64,';
      expect(getByteSizeFromDataUrl(dataUrl0)).toBe(0);
    });

    it('generateByteAccurateDataUrl roundtrip accuracy from 0 to 600,000 bytes', () => {
      const testByteSizes = [0, 1, 2, 3, 4, 100, 1024, 500 * 1024, 512000, 600_000];
      for (const expectedBytes of testByteSizes) {
        const url = generateByteAccurateDataUrl(expectedBytes);
        const calculatedBytes = getByteSizeFromDataUrl(url);
        expect(calculatedBytes).toBe(expectedBytes);
      }
    });

    it('validateImageFile rejects unsupported MIME types', () => {
      const invalidTypes = [
        'image/svg+xml',
        'application/pdf',
        'text/plain',
        'video/mp4',
        'application/octet-stream',
        'image/gif',
        'image/bmp',
        'image/tiff',
        '',
      ];

      for (const type of invalidTypes) {
        const res = validateImageFile({ type, size: 1024 });
        expect(res.valid).toBe(false);
        expect(res.error).toBeDefined();
        expect(res.error).toMatch(/Nepodporovaný formát souboru/);
      }
    });

    it('validateImageFile accepts valid JPEG, PNG, WebP, HEIC, HEIF in case-insensitive manner', () => {
      const validTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif',
        'IMAGE/JPEG',
        'Image/Png',
        'IMAGE/WEBP',
      ];

      for (const type of validTypes) {
        const res = validateImageFile({ type, size: 1024 * 1024 });
        expect(res.valid).toBe(true);
        expect(res.error).toBeUndefined();
      }
    });

    it('validateImageFile rejects files > 50 MB and accepts files <= 50 MB', () => {
      const limit50MB = 50 * 1024 * 1024; // 52,428,800 bytes

      // Boundary: Exactly 50 MB
      const atBoundary = validateImageFile({ type: 'image/jpeg', size: limit50MB });
      expect(atBoundary.valid).toBe(true);

      // Boundary: 50 MB + 1 byte
      const overBoundary = validateImageFile({ type: 'image/jpeg', size: limit50MB + 1 });
      expect(overBoundary.valid).toBe(false);
      expect(overBoundary.error).toBe('Soubor je příliš velký (maximum 50 MB).');

      // Far above boundary (100 MB)
      const wayOver = validateImageFile({ type: 'image/jpeg', size: 100 * 1024 * 1024 });
      expect(wayOver.valid).toBe(false);
    });
  });

  // =========================================================================
  // Section 5: Watermark Stamping & Protocol Preparation
  // =========================================================================
  describe('5. Watermark Stamping & Protocol Preparation', () => {

    it('stamps watermark without error on standard, tiny, and extreme canvases', () => {
      const canvases = [
        { w: 1920, h: 1080 },
        { w: 10, h: 10 },
        { w: 5000, h: 500 },
        { w: 500, h: 5000 },
      ];

      for (const { w, h } of canvases) {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;

        expect(() => {
          stampPhotoWatermark(canvas, {
            projectCode: 'PRJ-101',
            projectName: 'Hala Černý Most',
            welderName: 'Karel Novák',
            activityCaption: 'Koutový svar sloup S12',
            timestamp: '2026-09-13T10:00:00Z',
          });
        }).not.toThrow();
      }
    });

    it('stamps watermark gracefully with empty or omitted fields', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;

      expect(() => {
        stampPhotoWatermark(canvas, {
          projectCode: '',
          projectName: '',
        });
      }).not.toThrow();
    });

    it('preparePhotosForProtocol formats photos with localized dates and fallback captions', () => {
      expect(preparePhotosForProtocol()).toEqual([]);
      expect(preparePhotosForProtocol([])).toEqual([]);

      const mockPhotos: EntryPhoto[] = [
        {
          id: 'p1',
          entryId: 'e1',
          createdAt: '2026-09-13T10:30:00Z',
          caption: 'Detail svaru',
          dataUrl: 'data:image/jpeg;base64,mock',
          thumbnailUrl: 'data:image/jpeg;base64,thumb',
          sizeBytes: 150000,
          width: 1920,
          height: 1080,
        },
        {
          id: 'p2',
          entryId: 'e1',
          createdAt: '2026-09-13T11:45:00Z',
          caption: '', // empty caption should fallback to 'Bez popisu'
          dataUrl: 'data:image/jpeg;base64,mock2',
          thumbnailUrl: 'data:image/jpeg;base64,thumb2',
          sizeBytes: 180000,
          width: 1920,
          height: 1080,
        },
      ];

      const protocolItems = preparePhotosForProtocol(mockPhotos);
      expect(protocolItems).toHaveLength(2);
      expect(protocolItems[0].caption).toBe('Detail svaru');
      expect(protocolItems[0].thumbnailUrl).toBe('data:image/jpeg;base64,thumb');
      expect(protocolItems[0].dateStr).toMatch(/\d{2}\.\s*\d{2}\.\s*\d{4}/);
      expect(protocolItems[0].timeStr).toMatch(/\d{2}:\d{2}/);

      expect(protocolItems[1].caption).toBe('Bez popisu');
    });
  });

  // =========================================================================
  // Section 6: Dual-Tier Photo Store & IndexedDB Operations
  // =========================================================================
  describe('6. Dual-Tier Photo Store & IndexedDB Operations', () => {
    it('persists, queries, updates, and deletes EntryPhoto in Dexie db.photos store', async () => {
      const { addPhoto, getPhotosByEntryId, updatePhotoCaption, deletePhoto, deletePhotosByEntryId } = await import('../src/db');

      const entryId = 'shift-challenger-999';
      const photo1: EntryPhoto = {
        id: 'photo-ch-1',
        entryId,
        createdAt: '2026-09-13T10:00:00Z',
        caption: 'Kořenový svar',
        dataUrl: generateByteAccurateDataUrl(250_000),
        thumbnailUrl: generateByteAccurateDataUrl(15_000),
        sizeBytes: 250_000,
        width: 1920,
        height: 1080,
      };

      const photo2: EntryPhoto = {
        id: 'photo-ch-2',
        entryId,
        createdAt: '2026-09-13T11:00:00Z',
        caption: 'Krycí vrstva svaru',
        dataUrl: generateByteAccurateDataUrl(320_000),
        thumbnailUrl: generateByteAccurateDataUrl(18_000),
        sizeBytes: 320_000,
        width: 1440,
        height: 1080,
      };

      // 1. Add photos
      await addPhoto(photo1);
      await addPhoto(photo2);

      // 2. Query by entryId
      const stored = await getPhotosByEntryId(entryId);
      expect(stored).toHaveLength(2);
      expect(stored.map(p => p.id).sort()).toEqual(['photo-ch-1', 'photo-ch-2']);

      // 3. Update caption
      await updatePhotoCaption('photo-ch-1', 'Opravený kořenový svar po VT2 kontrole');
      const updatedList = await getPhotosByEntryId(entryId);
      const updatedP1 = updatedList.find(p => p.id === 'photo-ch-1');
      expect(updatedP1?.caption).toBe('Opravený kořenový svar po VT2 kontrole');

      // 4. Delete single photo
      await deletePhoto('photo-ch-2');
      const afterSingleDelete = await getPhotosByEntryId(entryId);
      expect(afterSingleDelete).toHaveLength(1);
      expect(afterSingleDelete[0].id).toBe('photo-ch-1');

      // 5. Cascade delete by entryId
      await deletePhotosByEntryId(entryId);
      const afterCascade = await getPhotosByEntryId(entryId);
      expect(afterCascade).toHaveLength(0);
    });
  });

  // =========================================================================
  // Section 7: Diacritics, Special Characters & XSS Resilience in Watermarking
  // =========================================================================
  describe('7. Diacritics, Special Characters & XSS Resilience in Watermarking', () => {
    it('handles heavy Czech diacritics, quotes, and special symbols safely in watermark', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;

      expect(() => {
        stampPhotoWatermark(canvas, {
          projectCode: 'ZAK-2026/09-ČEZ',
          projectName: 'Oprava potrubního řádu DN 250 – žárový nástřik & svar 141 (TIG)',
          welderName: 'Ing. Tomáš Šťastný, Ph.D. (Svářeč ČSN EN ISO 9606-1)',
          activityCaption: 'Detail převýšení kořene h=1.5mm dle EN ISO 5817 stupeň B "přísný" <test>',
          timestamp: '2026-09-13T10:30:00.000Z',
        });
      }).not.toThrow();
    });

    it('handles potential XSS injection payloads in caption and project strings without crashing', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;

      const xssStrings = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert(1)>',
        '"><svg onload=alert(1)>',
        'javascript:void(0)',
      ];

      for (const payload of xssStrings) {
        expect(() => {
          stampPhotoWatermark(canvas, {
            projectCode: payload,
            projectName: payload,
            welderName: payload,
            activityCaption: payload,
          });
        }).not.toThrow();
      }
    });
  });

  // =========================================================================
  // Section 8: Square and Extreme Aspect Ratio Boundaries
  // =========================================================================
  describe('8. Square and Extreme Aspect Ratio Boundaries', () => {
    it('handles square images (3000x3000, 1080x1080, 1081x1081)', () => {
      // 3000x3000 square
      const target3k = calculateTargetDimensions(3000, 3000);
      expect(target3k.width).toBeLessThanOrEqual(MAX_WIDTH);
      expect(target3k.height).toBeLessThanOrEqual(MAX_HEIGHT);
      expect(target3k.width).toBe(1080);
      expect(target3k.height).toBe(1080);
      expect(target3k.width / target3k.height).toBe(1.0);

      // 1080x1080 square (fits exactly in 1920x1080)
      const target1080 = calculateTargetDimensions(1080, 1080);
      expect(target1080.width).toBe(1080);
      expect(target1080.height).toBe(1080);

      // 1081x1081 square (1px over height boundary)
      const target1081 = calculateTargetDimensions(1081, 1081);
      expect(target1081.width).toBeLessThanOrEqual(MAX_WIDTH);
      expect(target1081.height).toBeLessThanOrEqual(MAX_HEIGHT);
      expect(target1081.height).toBe(1080);
      expect(target1081.width).toBe(1080);
    });

    it('compares calculateTargetDimensions (1920x1080 box) vs calculateDownscaledDimensions (1920 maxDim)', () => {
      // 4:3 smartphone photo (4032x3024)
      const target = calculateTargetDimensions(4032, 3024);
      const downscaled = calculateDownscaledDimensions(4032, 3024, 1920);

      // calculateTargetDimensions fits within 1920x1080:
      expect(target.width).toBe(1440);
      expect(target.height).toBe(1080);
      expect(target.height).toBeLessThanOrEqual(1080);

      // calculateDownscaledDimensions only constrains max(w, h) <= 1920:
      expect(downscaled.width).toBe(1920);
      expect(downscaled.height).toBe(1440);
      expect(downscaled.height).toBeGreaterThan(1080); // Exceeds 1080
    });
  });
});
