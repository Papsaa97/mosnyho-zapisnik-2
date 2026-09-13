import { describe, it, expect, beforeEach } from 'vitest';
import { attachCanvasSpy, CanvasSpyInstance } from '../../helpers/canvasSpy';
import {
  SignatureTrimmer,
  type BoundingBox,
  type CropResult,
} from '../../../src/components/signature/SignaturePad';

export { SignatureTrimmer, type BoundingBox, type CropResult };

describe('Feature 5: Bounding Box Trimming (f05-bbox-trimming)', () => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let _spy: CanvasSpyInstance;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 200;
    ctx = canvas.getContext('2d')!;
    _spy = attachCanvasSpy(canvas);
  });

  it('identifies tight bounding box of non-transparent pixels in signature canvas', () => {
    // Create test image data with known painted rectangle: x from 50 to 150, y from 40 to 90
    const testData = new Uint8ClampedArray(400 * 200 * 4);
    for (let y = 40; y <= 90; y++) {
      for (let x = 50; x <= 150; x++) {
        const idx = (y * 400 + x) * 4;
        testData[idx] = 0;       // R
        testData[idx + 1] = 0;   // G
        testData[idx + 2] = 0;   // B
        testData[idx + 3] = 255; // Alpha
      }
    }

    const imgData = {
      width: 400,
      height: 200,
      data: testData,
      colorSpace: 'srgb' as PredefinedColorSpace,
    };

    const bbox = SignatureTrimmer.calculateBoundingBox(imgData as ImageData);
    expect(bbox).not.toBeNull();
    expect(bbox!.minX).toBe(50);
    expect(bbox!.minY).toBe(40);
    expect(bbox!.maxX).toBe(150);
    expect(bbox!.maxY).toBe(90);
    expect(bbox!.width).toBe(101); // 150 - 50 + 1
    expect(bbox!.height).toBe(51); // 90 - 40 + 1
  });

  it('applies configurable padding around trimmed signature without exceeding canvas bounds', () => {
    // Box from (100, 50) to (200, 100) -> width 101, height 51
    const testData = new Uint8ClampedArray(400 * 200 * 4);
    for (let y = 50; y <= 100; y++) {
      for (let x = 100; x <= 200; x++) {
        testData[(y * 400 + x) * 4 + 3] = 255;
      }
    }

    ctx.getImageData = () => ({
      width: 400,
      height: 200,
      data: testData,
      colorSpace: 'srgb' as PredefinedColorSpace,
    });

    const padding = 10;
    const result = SignatureTrimmer.trimCanvas(canvas, padding);

    expect(result).not.toBeNull();
    expect(result!.cropX).toBe(90); // 100 - 10
    expect(result!.cropY).toBe(40); // 50 - 10
    expect(result!.cropWidth).toBe(121); // 101 + 20
    expect(result!.cropHeight).toBe(71); // 51 + 20
  });

  it('returns null when canvas contains only transparent pixels (empty signature guard)', () => {
    // Pure transparent buffer
    const transparentData = new Uint8ClampedArray(400 * 200 * 4);
    ctx.getImageData = () => ({
      width: 400,
      height: 200,
      data: transparentData,
      colorSpace: 'srgb' as PredefinedColorSpace,
    });

    const result = SignatureTrimmer.trimCanvas(canvas, 4);
    expect(result).toBeNull();
  });

  it('handles signature touching canvas boundaries (0,0) and (width, height) without out-of-bounds error', () => {
    // Touch top-left corner at (0, 0)
    const testData = new Uint8ClampedArray(400 * 200 * 4);
    testData[3] = 255; // pixel (0, 0) alpha

    ctx.getImageData = () => ({
      width: 400,
      height: 200,
      data: testData,
      colorSpace: 'srgb' as PredefinedColorSpace,
    });

    const result = SignatureTrimmer.trimCanvas(canvas, 5);
    expect(result).not.toBeNull();
    // Clamped to 0
    expect(result!.cropX).toBe(0);
    expect(result!.cropY).toBe(0);
    expect(result!.cropWidth).toBeGreaterThanOrEqual(1);
    expect(result!.cropHeight).toBeGreaterThanOrEqual(1);
  });

  it('generates trimmed PNG data URL with dimensions strictly smaller than original canvas for centered signature', () => {
    // Small mark in center (190 to 210, 95 to 105)
    const testData = new Uint8ClampedArray(400 * 200 * 4);
    for (let y = 95; y <= 105; y++) {
      for (let x = 190; x <= 210; x++) {
        testData[(y * 400 + x) * 4 + 3] = 255;
      }
    }

    ctx.getImageData = () => ({
      width: 400,
      height: 200,
      data: testData,
      colorSpace: 'srgb' as PredefinedColorSpace,
    });

    const result = SignatureTrimmer.trimCanvas(canvas, 4);
    expect(result).not.toBeNull();
    expect(result!.cropWidth).toBeLessThan(canvas.width);
    expect(result!.cropHeight).toBeLessThan(canvas.height);
    expect(result!.dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('preserves aspect ratio and coordinate fidelity of the drawn signature during cropping', () => {
    // Square 50x50 block in canvas
    const testData = new Uint8ClampedArray(400 * 200 * 4);
    for (let y = 50; y < 100; y++) {
      for (let x = 50; x < 100; x++) {
        testData[(y * 400 + x) * 4 + 3] = 200;
      }
    }

    ctx.getImageData = () => ({
      width: 400,
      height: 200,
      data: testData,
      colorSpace: 'srgb' as PredefinedColorSpace,
    });

    const padding = 0;
    const result = SignatureTrimmer.trimCanvas(canvas, padding);
    expect(result).not.toBeNull();
    expect(result!.cropWidth).toBe(50);
    expect(result!.cropHeight).toBe(50);
    expect(result!.cropWidth / result!.cropHeight).toBe(1.0);
  });
});
