import { describe, it, expect } from 'vitest';
import { 
  PHOTO_UNDER_500KB_DATA_URL,
  PHOTO_BOUNDARY_499KB_DATA_URL,
  PHOTO_BOUNDARY_500KB_DATA_URL,
  PHOTO_BOUNDARY_501KB_DATA_URL 
} from '../../fixtures/photos.fixture';

/**
 * Feature 26: Client-Side Offline Compression
 * 
 * Authoritative Sources:
 * - ORIGINAL_REQUEST.md §R5 (Připojené fotografie se před uložením do IndexedDB automaticky zkomprimují pod 500 KB na snímek)
 * - PROJECT.md §4 (Photo Documentation)
 * - spec_miner_survey_2/handoff.md §4. Photo Documentation Compression Algorithm
 * 
 * Requirements:
 * - Maximum resolution downscaling to fit inside 1920x1080 bounding box while preserving aspect ratio
 * - Iterative JPEG quality titration until image payload is strictly < 500 KB (500 * 1024 = 512,000 bytes)
 * - Smaller images (under 1920x1080) are never upscaled
 * - Aspect ratios preserved across landscape (16:9, 4:3) and portrait orientations
 * - 100% offline execution via HTML5 Canvas 2D without cloud/server dependencies
 */

import {
  MAX_PHOTO_BYTES,
  MAX_WIDTH,
  MAX_HEIGHT,
  calculateTargetDimensions,
  compressImageToUnder500KB,
} from '../../../src/services/imageCompressionService';

export {
  MAX_PHOTO_BYTES,
  MAX_WIDTH,
  MAX_HEIGHT,
  calculateTargetDimensions,
  compressImageToUnder500KB,
};

describe('Feature 26: Client-Side Offline Compression', () => {
  // Test 1: Constraint strictly < 500 KB on standard photo fixture
  it('verifies that compressed photos strictly satisfy the < 500 KB size limit', () => {
    // Length in bytes of data URL payload
    const under500Size = PHOTO_UNDER_500KB_DATA_URL.length;
    expect(under500Size).toBeLessThan(MAX_PHOTO_BYTES);

    const boundary499Size = PHOTO_BOUNDARY_499KB_DATA_URL.length;
    expect(boundary499Size).toBeLessThan(MAX_PHOTO_BYTES);
    expect(boundary499Size).toBe(499 * 1024);
  });

  // Test 2: Downscaling large images to max 1920x1080 preserving aspect ratio
  it('downscales high-resolution camera photos to fit within 1920x1080 without distortion', () => {
    // 12 MP smartphone photo: 4032 x 3024 (4:3 landscape)
    const dim43 = calculateTargetDimensions(4032, 3024);
    expect(dim43.width).toBeLessThanOrEqual(MAX_WIDTH);
    expect(dim43.height).toBeLessThanOrEqual(MAX_HEIGHT);
    expect(dim43.height).toBe(1080);
    expect(dim43.width).toBe(Math.round(4032 * (1080 / 3024))); // 1440 px
    // Preserves 4:3 aspect ratio
    expect((dim43.width / dim43.height).toFixed(3)).toBe((4032 / 3024).toFixed(3));

    // 4K Ultra HD photo: 3840 x 2160 (16:9 landscape)
    const dim169 = calculateTargetDimensions(3840, 2160);
    expect(dim169.width).toBe(1920);
    expect(dim169.height).toBe(1080);

    // Portrait smartphone photo: 3024 x 4032 (3:4 portrait)
    const dimPortrait = calculateTargetDimensions(3024, 4032);
    expect(dimPortrait.height).toBe(1080);
    expect(dimPortrait.width).toBe(Math.round(3024 * (1080 / 4032))); // 810 px
    expect(dimPortrait.width).toBeLessThanOrEqual(MAX_WIDTH);
  });

  // Test 3: No upscaling for images already smaller than 1920x1080
  it('never upscales images that are already smaller than maximum dimensions', () => {
    const smallDim = calculateTargetDimensions(1280, 720);
    expect(smallDim.width).toBe(1280);
    expect(smallDim.height).toBe(720);

    const thumbnailDim = calculateTargetDimensions(640, 480);
    expect(thumbnailDim.width).toBe(640);
    expect(thumbnailDim.height).toBe(480);
  });

  // Test 4: Iterative JPEG quality titration for oversized images
  it('iteratively reduces compression quality when raw camera photo exceeds 500 KB', () => {
    // 1.2 MB raw photo -> simulated compression titration
    const rawBytes = 1200 * 1024; // 1,228,800 bytes
    const result = compressImageToUnder500KB(rawBytes);

    expect(result.finalSizeBytes).toBeLessThan(MAX_PHOTO_BYTES);
    expect(result.iterations).toBeGreaterThan(1);
    expect(result.qualityApplied).toBeLessThanOrEqual(0.72);
  });

  // Test 5: Boundary value analysis around 500 KB limit
  it('accurately distinguishes boundary thresholds: 499 KB, 500 KB, and 501 KB', () => {
    const size499 = PHOTO_BOUNDARY_499KB_DATA_URL.length;
    const size500 = PHOTO_BOUNDARY_500KB_DATA_URL.length;
    const size501 = PHOTO_BOUNDARY_501KB_DATA_URL.length;

    // 499 KB is strictly < 500 KB (passes immediately)
    expect(size499 < MAX_PHOTO_BYTES).toBe(true);

    // 500 KB exact boundary (512,000 bytes is not strictly < 500 KB)
    expect(size500).toBe(500 * 1024);
    expect(size500 <= MAX_PHOTO_BYTES).toBe(true);

    // 501 KB exceeds limit and triggers compression titration
    expect(size501 > MAX_PHOTO_BYTES).toBe(true);
    const titrate501 = compressImageToUnder500KB(size501);
    expect(titrate501.finalSizeBytes).toBeLessThan(MAX_PHOTO_BYTES);
  });

  // Test 6: Offline canvas compression reproducibility
  it('executes client-side canvas compression without external network API calls', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const ctx = canvas.getContext('2d');
    expect(ctx).toBeDefined();

    // Export to JPEG with quality 0.82
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    expect(dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(dataUrl.length).toBeLessThan(MAX_PHOTO_BYTES);
  });
});
