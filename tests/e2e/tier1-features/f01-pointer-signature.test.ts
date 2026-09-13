import { describe, it, expect, beforeEach } from 'vitest';
import { attachCanvasSpy, CanvasSpyInstance } from '../../helpers/canvasSpy';
import { PointerSignatureCapture } from '../../../src/components/signature/SignaturePad';
import type { SignaturePoint, SignatureStroke } from '../../../src/types';

describe('Feature 1: Pointer Event Signature Capture (f01-pointer-signature)', () => {
  let canvas: HTMLCanvasElement;
  let spy: CanvasSpyInstance;
  let capture: PointerSignatureCapture;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 200;
    canvas.getBoundingClientRect = () => ({
      left: 100,
      top: 50,
      right: 500,
      bottom: 250,
      width: 400,
      height: 200,
      x: 100,
      y: 50,
      toJSON: () => {},
    });

    // Add pointer capture mock stubs if not natively available in happy-dom
    canvas.setPointerCapture = canvas.setPointerCapture || (() => {});
    canvas.releasePointerCapture = canvas.releasePointerCapture || (() => {});

    spy = attachCanvasSpy(canvas);
    capture = new PointerSignatureCapture(canvas);
  });

  it('initializes canvas with touch-action: none to prevent mobile viewport scrolling', () => {
    expect(canvas.style.touchAction).toBe('none');
    expect(capture.touchActionApplied).toBe(true);
  });

  it('captures pointerdown, assigns pointer capture and initiates drawing stroke', () => {
    const pointerDownEvent = new PointerEvent('pointerdown', {
      pointerId: 1,
      clientX: 120, // 120 - 100 = 20 on canvas
      clientY: 80,  // 80 - 50 = 30 on canvas
      pressure: 0.65,
      isPrimary: true,
    });

    canvas.dispatchEvent(pointerDownEvent);

    expect(capture.getIsDrawing()).toBe(true);
    expect(capture.getActivePointerId()).toBe(1);

    const beginCalls = spy.getCalls('beginPath');
    const moveCalls = spy.getCalls('moveTo');
    expect(beginCalls.length).toBeGreaterThanOrEqual(1);
    expect(moveCalls.length).toBe(1);
    expect(moveCalls[0].args).toEqual([20, 30]);
  });

  it('records sequential pointermove coordinates and invokes canvas drawing operations', () => {
    // Start stroke
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      pointerId: 1,
      clientX: 150, // x = 50
      clientY: 100, // y = 50
      isPrimary: true,
    }));

    // Move 1
    canvas.dispatchEvent(new PointerEvent('pointermove', {
      pointerId: 1,
      clientX: 170, // x = 70
      clientY: 110, // y = 60
      pressure: 0.7,
    }));

    // Move 2
    canvas.dispatchEvent(new PointerEvent('pointermove', {
      pointerId: 1,
      clientX: 190, // x = 90
      clientY: 125, // y = 75
      pressure: 0.8,
    }));

    const lineCalls = spy.getCalls('lineTo');
    const strokeCalls = spy.getCalls('stroke');
    expect(lineCalls.length).toBe(2);
    expect(lineCalls[0].args).toEqual([70, 60]);
    expect(lineCalls[1].args).toEqual([90, 75]);
    expect(strokeCalls.length).toBe(2);
  });

  it('handles pressure sensitivity within [0, 1] range with fallback for devices without pressure', () => {
    // Event with stylus pressure
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      pointerId: 2,
      clientX: 110,
      clientY: 60,
      pressure: 0.85,
      isPrimary: true,
    }));

    // Event without pressure (pressure = 0 or undefined -> fallback 0.5)
    canvas.dispatchEvent(new PointerEvent('pointermove', {
      pointerId: 2,
      clientX: 130,
      clientY: 80,
      pressure: 0,
    }));

    canvas.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2 }));

    const strokes = capture.getStrokes();
    expect(strokes).toHaveLength(1);
    expect(strokes[0].points).toHaveLength(2);
    expect(strokes[0].points[0].pressure).toBe(0.85);
    expect(strokes[0].points[1].pressure).toBe(0.5);
  });

  it('terminates drawing stroke on pointerup and releases active pointer', () => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      pointerId: 5,
      clientX: 200,
      clientY: 100,
      isPrimary: true,
    }));
    expect(capture.getIsDrawing()).toBe(true);

    canvas.dispatchEvent(new PointerEvent('pointerup', {
      pointerId: 5,
      clientX: 250,
      clientY: 120,
    }));

    expect(capture.getIsDrawing()).toBe(false);
    expect(capture.getActivePointerId()).toBeNull();
    expect(capture.getStrokes()).toHaveLength(1);
  });

  it('handles pointercancel cleanly by terminating active stroke without committing', () => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      pointerId: 9,
      clientX: 150,
      clientY: 90,
      isPrimary: true,
    }));
    expect(capture.getIsDrawing()).toBe(true);

    canvas.dispatchEvent(new PointerEvent('pointercancel', {
      pointerId: 9,
    }));

    expect(capture.getIsDrawing()).toBe(false);
    expect(capture.getActivePointerId()).toBeNull();
    // Cancelled stroke is discarded
    expect(capture.getStrokes()).toHaveLength(0);
  });

  it('rejects secondary touch points (palm rejection) while primary pointer is active', () => {
    // Primary finger
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      pointerId: 10,
      clientX: 120,
      clientY: 80,
      isPrimary: true,
    }));

    // Second finger / palm
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      pointerId: 11,
      clientX: 300,
      clientY: 200,
      isPrimary: false,
    }));

    // Move from secondary pointer should be ignored
    canvas.dispatchEvent(new PointerEvent('pointermove', {
      pointerId: 11,
      clientX: 310,
      clientY: 210,
    }));

    const lineCalls = spy.getCalls('lineTo');
    expect(lineCalls.length).toBe(0);

    canvas.dispatchEvent(new PointerEvent('pointerup', { pointerId: 10 }));
    expect(capture.getStrokes()).toHaveLength(1);
  });
});
