import { describe, it, expect, beforeEach } from 'vitest';
import { attachCanvasSpy, CanvasSpyInstance } from '../../helpers/canvasSpy';
import { RetinaCanvasScaler, type CanvasDimensions } from '../../../src/components/signature/SignaturePad';

export { RetinaCanvasScaler, type CanvasDimensions };

describe('Feature 3: Retina DPR Scaling (f03-dpr-scaling)', () => {
  let canvas: HTMLCanvasElement;
  let spy: CanvasSpyInstance;
  let scaler: RetinaCanvasScaler;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.getBoundingClientRect = () => ({
      left: 50,
      top: 50,
      right: 450,
      bottom: 250,
      width: 400,
      height: 200,
      x: 50,
      y: 50,
      toJSON: () => {},
    });
    spy = attachCanvasSpy(canvas);
    scaler = new RetinaCanvasScaler(canvas);
  });

  it('scales internal canvas buffer dimensions by devicePixelRatio = 2 while keeping CSS size constant', () => {
    const dims = scaler.resize(400, 200, 2);

    expect(dims.bufferWidth).toBe(800);
    expect(dims.bufferHeight).toBe(400);
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(400);

    expect(canvas.style.width).toBe('400px');
    expect(canvas.style.height).toBe('200px');
  });

  it('supports 3x ultra-high-DPI (Retina HD / modern mobile) buffer allocation', () => {
    const dims = scaler.resize(375, 180, 3);

    expect(dims.bufferWidth).toBe(1125);
    expect(dims.bufferHeight).toBe(540);
    expect(dims.dpr).toBe(3);
    expect(canvas.width).toBe(1125);
    expect(canvas.height).toBe(540);
  });

  it('applies 2D context scale transformation matching devicePixelRatio', () => {
    scaler.resize(400, 200, 2);

    const scaleCalls = spy.getCalls('scale');
    expect(scaleCalls.length).toBeGreaterThanOrEqual(1);
    const lastCall = scaleCalls[scaleCalls.length - 1];
    expect(lastCall.args).toEqual([2, 2]);
  });

  it('maintains exact logical coordinate mapping between pointer event CSS pixels and drawing context', () => {
    scaler.resize(400, 200, 2);

    // Click at screen position (175, 125) with canvas bounding client rect top-left at (50, 50)
    const logical = scaler.clientToLogical(175, 125);
    expect(logical.x).toBe(125); // 175 - 50 = 125
    expect(logical.y).toBe(75);  // 125 - 50 = 75

    // In physical buffer pixels, (125, 75) maps to (250, 150) under DPR=2
    const bufferPt = scaler.logicalToBuffer(logical.x, logical.y);
    expect(bufferPt.x).toBe(250);
    expect(bufferPt.y).toBe(150);
  });

  it('handles fractional devicePixelRatio values (e.g. 1.25, 2.625) without coordinate drift', () => {
    const dims = scaler.resize(360, 240, 2.625);

    expect(dims.bufferWidth).toBe(Math.round(360 * 2.625)); // 945
    expect(dims.bufferHeight).toBe(Math.round(240 * 2.625)); // 630
    expect(dims.bufferWidth).toBe(945);
    expect(dims.bufferHeight).toBe(630);

    const logical = scaler.clientToLogical(100, 100);
    expect(logical.x).toBe(50);
    expect(logical.y).toBe(50);

    const bufferPt = scaler.logicalToBuffer(logical.x, logical.y);
    expect(bufferPt.x).toBe(Math.round(50 * 2.625)); // 131
  });

  it('prevents blurriness by ensuring buffer pixel density matches or exceeds display density', () => {
    // Standard non-retina (DPR = 1)
    const standardDims = scaler.resize(400, 200, 1);
    expect(standardDims.bufferWidth).toBe(400);

    // Retina (DPR = 2) provides 4x the pixel area
    const retinaDims = scaler.resize(400, 200, 2);
    const standardPixelCount = standardDims.bufferWidth * standardDims.bufferHeight;
    const retinaPixelCount = retinaDims.bufferWidth * retinaDims.bufferHeight;
    expect(retinaPixelCount).toBe(standardPixelCount * 4);
  });
});
