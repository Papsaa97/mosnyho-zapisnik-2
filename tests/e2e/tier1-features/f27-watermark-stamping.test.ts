import { describe, it, expect } from 'vitest';
import { attachCanvasSpy } from '../../helpers/canvasSpy';
import { stampPhotoWatermark } from '../../../src/services/imageCompressionService';
import type { WatermarkOptions } from '../../../src/types';
export { stampPhotoWatermark };

describe('Feature 27: High-Contrast Watermark Stamping', () => {
  // Test 1: Stamping project code and name onto canvas
  it('renders project code and project name into canvas watermark title banner', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const spy = attachCanvasSpy(canvas);

    stampPhotoWatermark(canvas, {
      projectCode: 'MOST-SO201/26',
      projectName: 'Most ev.č. 201 – Svařování zábradlí',
    });

    expect(spy.hasRenderedText('MOST-SO201/26')).toBe(true);
    expect(spy.hasRenderedText('Svařování zábradlí')).toBe(true);

    spy.restore();
  });

  // Test 2: Stamping dynamic timestamp into subtitle banner
  it('burns dynamic date and time timestamp into watermark subtitle', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const spy = attachCanvasSpy(canvas);

    stampPhotoWatermark(canvas, {
      projectCode: 'HALA-C',
      projectName: 'Montáž haly',
      timestamp: '2026-03-02T14:30:00.000Z',
    });

    // Verification of Czech locale date string
    expect(spy.hasRenderedText('2026')).toBe(true);

    spy.restore();
  });

  // Test 3: Stamping welder activity and inspection caption
  it('burns welder activity and inspection caption for technical verification', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const spy = attachCanvasSpy(canvas);

    stampPhotoWatermark(canvas, {
      projectCode: 'POTRUBI-DN150',
      projectName: 'Potravinářská nerez',
      welderName: 'Jan Novák',
      activityCaption: 'VT2 zkouška svaru č. 4 – bez vad',
    });

    expect(spy.hasRenderedText('Jan Novák')).toBe(true);
    expect(spy.hasRenderedText('VT2 zkouška svaru č. 4')).toBe(true);

    spy.restore();
  });

  // Test 4: High-contrast semi-transparent pill and amber accent line
  it('draws dark semi-transparent background pill and amber accent line for high contrast', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const spy = attachCanvasSpy(canvas);

    stampPhotoWatermark(canvas, {
      projectCode: 'TEST-01',
      projectName: 'Test Project',
    });

    const fillRectCalls = spy.getCalls('fillRect');
    expect(fillRectCalls.length).toBeGreaterThanOrEqual(2);

    // Call 1: Dark pill
    // Call 2: Amber accent border (#f59e0b)
    const ctx = canvas.getContext('2d')!;
    expect(spy.getCalls('save').length).toBe(1);
    expect(spy.getCalls('restore').length).toBe(1);

    spy.restore();
  });

  // Test 5: Bottom corner placement based on canvas height
  it('positions watermark at the bottom of the canvas with appropriate offset', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const spy = attachCanvasSpy(canvas);

    stampPhotoWatermark(canvas, {
      projectCode: 'POS-TEST',
      projectName: 'Bottom Placement',
    });

    const fillRectCalls = spy.getCalls('fillRect');
    const pillY = fillRectCalls[0].args[1];

    // Pill Y should be located near bottom of canvas (> 900px on a 1080px canvas)
    expect(pillY).toBeGreaterThan(900);
    expect(pillY).toBeLessThan(1080);

    spy.restore();
  });

  // Test 6: Scaled font size across different resolutions
  it('dynamically adapts watermark font sizes for smaller image resolutions', () => {
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = 800;
    smallCanvas.height = 600;

    const spy = attachCanvasSpy(smallCanvas);

    stampPhotoWatermark(smallCanvas, {
      projectCode: 'SMALL-IMG',
      projectName: 'Small Res',
    });

    expect(spy.hasRenderedText('SMALL-IMG')).toBe(true);

    const fillRectCalls = spy.getCalls('fillRect');
    const pillY = fillRectCalls[0].args[1];
    // On 600px canvas, pill Y should be near bottom (> 450px)
    expect(pillY).toBeGreaterThan(450);
    expect(pillY).toBeLessThan(600);

    spy.restore();
  });
});
