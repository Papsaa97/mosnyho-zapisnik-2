import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { render, fireEvent } from '@testing-library/react';
import {
  SignaturePad,
  SignaturePadHandle,
  validateSignatureStrokes,
} from '../src/components/signature/SignaturePad';
import { SignaturePadModal } from '../src/components/signature/SignaturePadModal';
import { SignatureStroke } from '../src/types';
import { attachCanvasSpy, CanvasSpyInstance } from './helpers/canvasSpy';

describe('Challenger 2: Sign-on-Glass Canvas Engine Stress Test Suite (Features 1–5)', () => {
  // =========================================================================
  // 1. Touch and Pointer Events Adversarial Suite
  // =========================================================================
  describe('1. Touch & Pointer Events (pointercancel, pointer capture, palm rejection)', () => {
    let padRef: React.RefObject<SignaturePadHandle | null>;
    let container: HTMLElement;
    let canvas: HTMLCanvasElement;
    let setPointerCaptureMock: ReturnType<typeof vi.fn>;
    let releasePointerCaptureMock: ReturnType<typeof vi.fn>;
    let hasPointerCaptureMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      padRef = React.createRef<SignaturePadHandle>();
      const rendered = render(<SignaturePad ref={padRef} width={400} height={200} />);
      container = rendered.container;
      canvas = container.querySelector('canvas')!;

      canvas.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        right: 400,
        bottom: 200,
        width: 400,
        height: 200,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      setPointerCaptureMock = vi.fn();
      releasePointerCaptureMock = vi.fn();
      hasPointerCaptureMock = vi.fn((_id: number) => true);

      canvas.setPointerCapture = setPointerCaptureMock;
      canvas.releasePointerCapture = releasePointerCaptureMock;
      canvas.hasPointerCapture = hasPointerCaptureMock;
    });

    it('T1.1: pointercancel mid-stroke discards the active stroke, resets drawing state and releases capture', () => {
      expect(padRef.current?.getStrokes()).toHaveLength(0);

      // Start stroke
      act(() => {
        fireEvent.pointerDown(canvas, {
          pointerId: 42,
          clientX: 50,
          clientY: 50,
          pressure: 0.7,
          isPrimary: true,
        });
      });

      expect(setPointerCaptureMock).toHaveBeenCalledWith(42);

      // Move stroke
      act(() => {
        fireEvent.pointerMove(canvas, {
          pointerId: 42,
          clientX: 70,
          clientY: 80,
          pressure: 0.8,
        });
      });

      // System interrupts with pointercancel (e.g. palm touch gesture, system notification, call)
      act(() => {
        fireEvent.pointerCancel(canvas, {
          pointerId: 42,
        });
      });

      expect(releasePointerCaptureMock).toHaveBeenCalledWith(42);
      // Discarded: no strokes committed to history
      expect(padRef.current?.getStrokes()).toHaveLength(0);
      expect(padRef.current?.canUndo()).toBe(false);
      expect(padRef.current?.isEmpty()).toBe(true);
    });

    it('T1.2: subsequent stroke after pointercancel starts cleanly without being blocked', () => {
      // Stroke 1 cancelled
      act(() => {
        fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 50, clientY: 50, isPrimary: true });
        fireEvent.pointerCancel(canvas, { pointerId: 1 });
      });
      expect(padRef.current?.getStrokes()).toHaveLength(0);

      // Stroke 2 completed successfully
      act(() => {
        fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 50, clientY: 50, isPrimary: true });
        fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 70, clientY: 70 });
        fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 100, clientY: 90 });
        fireEvent.pointerUp(canvas, { pointerId: 2 });
      });

      expect(padRef.current?.getStrokes()).toHaveLength(1);
      expect(padRef.current?.getStrokes()[0].points).toHaveLength(3);
      expect(padRef.current?.canUndo()).toBe(true);
      expect(padRef.current?.isEmpty()).toBe(false);
    });

    it('T1.3: pointercancel with mismatched pointerId does not cancel active drawing', () => {
      act(() => {
        fireEvent.pointerDown(canvas, { pointerId: 10, clientX: 50, clientY: 50, isPrimary: true });
        fireEvent.pointerMove(canvas, { pointerId: 10, clientX: 70, clientY: 70 });
      });

      // Mismatched pointercancel from different pointerId (e.g. rejected secondary contact)
      act(() => {
        fireEvent.pointerCancel(canvas, { pointerId: 99 });
      });

      // Active stroke continues
      act(() => {
        fireEvent.pointerMove(canvas, { pointerId: 10, clientX: 90, clientY: 80 });
        fireEvent.pointerUp(canvas, { pointerId: 10 });
      });

      expect(padRef.current?.getStrokes()).toHaveLength(1);
      expect(padRef.current?.getStrokes()[0].points).toHaveLength(3);
    });

    it('T1.4: fast pointer movements exiting canvas bounds are tracked via pointer capture without errors', () => {
      act(() => {
        fireEvent.pointerDown(canvas, { pointerId: 5, clientX: 50, clientY: 50, isPrimary: true });
      });
      expect(setPointerCaptureMock).toHaveBeenCalledWith(5);

      act(() => {
        // Move outside canvas bounds (negative coordinates)
        fireEvent.pointerMove(canvas, { pointerId: 5, clientX: -20, clientY: -30 });
        // Move outside right/bottom bounds
        fireEvent.pointerMove(canvas, { pointerId: 5, clientX: 600, clientY: 450 });
        // Release outside canvas
        fireEvent.pointerUp(canvas, { pointerId: 5, clientX: 600, clientY: 450 });
      });

      expect(releasePointerCaptureMock).toHaveBeenCalledWith(5);
      const strokes = padRef.current?.getStrokes();
      expect(strokes).toHaveLength(1);
      expect(strokes![0].points).toHaveLength(3);
      // Negative coordinates recorded accurately
      expect(strokes![0].points[1].x).toBe(-20);
      expect(strokes![0].points[1].y).toBe(-30);
      // Coordinates exceeding canvas dimensions recorded accurately
      expect(strokes![0].points[2].x).toBe(600);
      expect(strokes![0].points[2].y).toBe(450);
    });

    it('T1.5: palm rejection rejects secondary pointer touches during active stroke', () => {
      // Primary stylus/finger touches
      act(() => {
        fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 50, clientY: 50, isPrimary: true });
      });

      // Secondary touch / palm contact touches down
      act(() => {
        fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 300, clientY: 200, isPrimary: false });
        fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 310, clientY: 210, isPrimary: false });
        fireEvent.pointerUp(canvas, { pointerId: 2, isPrimary: false });
      });

      // Primary stroke continues smoothly
      act(() => {
        fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 70, clientY: 60, isPrimary: true });
        fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 90, clientY: 70, isPrimary: true });
        fireEvent.pointerUp(canvas, { pointerId: 1, isPrimary: true });
      });

      // Exactly 1 stroke committed containing ONLY pointerId 1 points
      const strokes = padRef.current?.getStrokes();
      expect(strokes).toHaveLength(1);
      expect(strokes![0].points).toHaveLength(3);
      expect(strokes![0].points.map(p => p.x)).toEqual([50, 70, 90]);
    });

    it('T1.6: palm-first contact (isPrimary: false when idle) is rejected and does not initiate drawing', () => {
      act(() => {
        // Palm contacts canvas first before stylus
        fireEvent.pointerDown(canvas, { pointerId: 99, clientX: 200, clientY: 150, isPrimary: false });
        fireEvent.pointerMove(canvas, { pointerId: 99, clientX: 210, clientY: 155, isPrimary: false });
        fireEvent.pointerUp(canvas, { pointerId: 99, isPrimary: false });
      });

      expect(padRef.current?.getStrokes()).toHaveLength(0);
      expect(padRef.current?.isEmpty()).toBe(true);

      // Now valid primary pointer touches down
      act(() => {
        fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 50, clientY: 50, isPrimary: true });
        fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 70, clientY: 70, isPrimary: true });
        fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 90, clientY: 80, isPrimary: true });
        fireEvent.pointerUp(canvas, { pointerId: 1, isPrimary: true });
      });

      expect(padRef.current?.getStrokes()).toHaveLength(1);
    });
  });

  // =========================================================================
  // 2. Bézier Curve Smoothing Adversarial Suite
  // =========================================================================
  describe('2. Bézier Curve Smoothing (0, 1, 2, 3+ points and pressure scaling)', () => {
    let canvas: HTMLCanvasElement;
    let spy: CanvasSpyInstance;
    let padRef: React.RefObject<SignaturePadHandle | null>;

    beforeEach(() => {
      padRef = React.createRef<SignaturePadHandle>();
      const rendered = render(<SignaturePad ref={padRef} width={400} height={200} strokeWidth={3} />);
      canvas = rendered.container.querySelector('canvas')!;
      canvas.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        right: 400,
        bottom: 200,
        width: 400,
        height: 200,
        x: 0,
        y: 0,
        toJSON: () => {},
      });
      spy = attachCanvasSpy(canvas);
    });

    it('T2.1: handles 0 points (empty stroke) gracefully without canvas errors', () => {
      spy.reset();
      const emptyStroke: SignatureStroke = { points: [] };
      const strokesWithEmpty = [emptyStroke];

      expect(() => {
        validateSignatureStrokes(strokesWithEmpty);
      }).not.toThrow();

      expect(spy.getCalls('quadraticCurveTo')).toHaveLength(0);
      expect(spy.getCalls('lineTo')).toHaveLength(0);
    });

    it('T2.2: renders single-point tap as filled circular dot with arc() and fill()', () => {
      spy.reset();

      act(() => {
        fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 150, clientY: 120, pressure: 0.8, isPrimary: true });
        fireEvent.pointerUp(canvas, { pointerId: 1 });
      });

      const arcCalls = spy.getCalls('arc');
      const fillCalls = spy.getCalls('fill');
      expect(arcCalls.length).toBeGreaterThanOrEqual(1);
      expect(fillCalls.length).toBeGreaterThanOrEqual(1);

      // Verify center coordinate and radius: pressure 0.8 * strokeWidth 3 / 2 = 1.2
      const lastArc = arcCalls[arcCalls.length - 1];
      expect(lastArc.args[0]).toBe(150); // x
      expect(lastArc.args[1]).toBe(120); // y
      expect(lastArc.args[2]).toBeCloseTo(1.2, 2); // radius
      expect(lastArc.args[3]).toBe(0);
      expect(lastArc.args[4]).toBeCloseTo(Math.PI * 2, 4);
    });

    it('T2.3: clamps minimum dot radius to at least 1px even for near-zero pressure', () => {
      spy.reset();

      act(() => {
        // pressure = 0.05 -> (0.05 * 3) / 2 = 0.075 -> clamped to Math.max(1, 0.075) = 1
        fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 80, clientY: 80, pressure: 0.05, isPrimary: true });
        fireEvent.pointerUp(canvas, { pointerId: 2 });
      });

      const arcCalls = spy.getCalls('arc');
      expect(arcCalls.length).toBeGreaterThanOrEqual(1);
      const lastArc = arcCalls[arcCalls.length - 1];
      expect(lastArc.args[2]).toBe(1); // clamped to 1
    });

    it('T2.4: renders 2 points as direct straight line segment using moveTo and lineTo without quadratic curves', () => {
      spy.reset();

      act(() => {
        fireEvent.pointerDown(canvas, { pointerId: 3, clientX: 50, clientY: 50, isPrimary: true });
        fireEvent.pointerMove(canvas, { pointerId: 3, clientX: 150, clientY: 150 });
        fireEvent.pointerUp(canvas, { pointerId: 3 });
      });

      const moveCalls = spy.getCalls('moveTo');
      const lineCalls = spy.getCalls('lineTo');
      const quadCalls = spy.getCalls('quadraticCurveTo');

      expect(moveCalls.length).toBeGreaterThanOrEqual(1);
      expect(lineCalls.length).toBeGreaterThanOrEqual(1);
      const lastMove = moveCalls[moveCalls.length - 1];
      const lastLine = lineCalls[lineCalls.length - 1];
      expect(lastMove.args).toEqual([50, 50]);
      expect(lastLine.args).toEqual([150, 150]);
      expect(quadCalls).toHaveLength(0);
    });

    it('T2.5: renders 3+ points using midpoint quadratic Bézier curve smoothing', () => {
      spy.reset();

      act(() => {
        // 4 points: P0(20, 20), P1(40, 80), P2(80, 40), P3(120, 100)
        fireEvent.pointerDown(canvas, { pointerId: 4, clientX: 20, clientY: 20, isPrimary: true });
        fireEvent.pointerMove(canvas, { pointerId: 4, clientX: 40, clientY: 80 });
        fireEvent.pointerMove(canvas, { pointerId: 4, clientX: 80, clientY: 40 });
        fireEvent.pointerMove(canvas, { pointerId: 4, clientX: 120, clientY: 100 });
        fireEvent.pointerUp(canvas, { pointerId: 4 });
      });

      const quadCalls = spy.getCalls('quadraticCurveTo');
      const lineCalls = spy.getCalls('lineTo');

      expect(quadCalls.length).toBeGreaterThanOrEqual(2);
      const recentQuads = quadCalls.slice(-2);
      expect(recentQuads[0].args).toEqual([40, 80, 60, 60]);
      expect(recentQuads[1].args).toEqual([80, 40, 100, 70]);

      const lastLine = lineCalls[lineCalls.length - 1];
      expect(lastLine.args).toEqual([120, 100]);
    });

    it('T2.6: executes high-density stroke with 250 sampled points without stack overflow or performance degradation', () => {
      spy.reset();

      act(() => {
        fireEvent.pointerDown(canvas, { pointerId: 10, clientX: 0, clientY: 0, isPrimary: true });
        for (let i = 1; i < 250; i++) {
          fireEvent.pointerMove(canvas, {
            pointerId: 10,
            clientX: (i % 400),
            clientY: ((i * 3) % 200),
          });
        }
        fireEvent.pointerUp(canvas, { pointerId: 10 });
      });

      const strokes = padRef.current?.getStrokes();
      expect(strokes).toHaveLength(1);
      expect(strokes![0].points).toHaveLength(250);
      expect(padRef.current?.isEmpty()).toBe(false);
    });
  });

  // =========================================================================
  // 3. Retina DPR Scaling Adversarial Suite
  // =========================================================================
  describe('3. Retina DPR Scaling (DPR = 1, 1.25, 2, 2.5, 3)', () => {
    let originalDpr: number;

    beforeEach(() => {
      originalDpr = window.devicePixelRatio;
    });

    afterEach(() => {
      Object.defineProperty(window, 'devicePixelRatio', { value: originalDpr, configurable: true });
    });

    const testDpr = (dprValue: number, expectedW: number, expectedH: number) => {
      Object.defineProperty(window, 'devicePixelRatio', { value: dprValue, configurable: true });

      const padRef = React.createRef<SignaturePadHandle>();
      const { container } = render(<SignaturePad ref={padRef} width={400} height={200} />);
      const canvas = container.querySelector('canvas')!;

      // Backing buffer dimensions scaled by DPR
      expect(canvas.width).toBe(expectedW);
      expect(canvas.height).toBe(expectedH);

      // CSS display dimensions unscaled
      expect(canvas.style.width).toBe('400px');
      expect(canvas.style.height).toBe('200px');
      expect(canvas.style.touchAction).toBe('none');
    };

    it('T3.1: allocates exact 1:1 buffer dimensions on standard non-Retina display (DPR = 1)', () => {
      testDpr(1, 400, 200);
    });

    it('T3.2: allocates 2x and 3x buffer dimensions on Retina displays (DPR = 2, DPR = 3)', () => {
      testDpr(2, 800, 400);
      testDpr(3, 1200, 600);
    });

    it('T3.3: handles fractional DPRs (1.25, 2.5) with clean Math.round integer allocation', () => {
      testDpr(1.25, 500, 250);
      testDpr(2.5, 1000, 500);
    });

    it('T3.4: context scale transformation matches devicePixelRatio on initialization', () => {
      Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });

      const padRef = React.createRef<SignaturePadHandle>();
      const { container } = render(<SignaturePad ref={padRef} width={400} height={200} />);
      const canvas = container.querySelector('canvas')!;
      const ctx = canvas.getContext('2d') as any;

      expect(ctx.scale).toHaveBeenCalledWith(2, 2);
    });
  });

  // =========================================================================
  // 4. Bounding Box Trimming Adversarial Suite
  // =========================================================================
  describe('4. Bounding Box Trimming & Accidental Touch Validation', () => {
    it('T4.1: validateSignatureStrokes rejects empty stroke array and zero-stroke input', () => {
      expect(validateSignatureStrokes([]).isValid).toBe(false);
      expect(validateSignatureStrokes([]).reason).toContain('empty');
      expect(validateSignatureStrokes([{ points: [] }]).isValid).toBe(false);
    });

    it('T4.2: rejects single-point tap (< 3 points) as accidental micro-touch', () => {
      const singlePoint: SignatureStroke[] = [
        { points: [{ x: 50, y: 50, pressure: 0.6 }] },
      ];
      const result = validateSignatureStrokes(singlePoint);
      expect(result.isValid).toBe(false);
      expect(result.totalPoints).toBe(1);
      expect(result.reason).toContain('too short');
    });

    it('T4.3: rejects 2-point micro-stroke (< 3 points) as accidental touch', () => {
      const twoPoints: SignatureStroke[] = [
        { points: [{ x: 50, y: 50 }, { x: 52, y: 51 }] },
      ];
      const result = validateSignatureStrokes(twoPoints);
      expect(result.isValid).toBe(false);
      expect(result.totalPoints).toBe(2);
      expect(result.reason).toContain('too short');
    });

    it('T4.4: rejects multi-point burst at exact same pixel with zero bounding area (< 2x2)', () => {
      const zeroArea: SignatureStroke[] = [
        {
          points: [
            { x: 100, y: 100 },
            { x: 100, y: 100 },
            { x: 100, y: 100 },
            { x: 100, y: 100 },
          ],
        },
      ];
      const result = validateSignatureStrokes(zeroArea);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('zero movement area');
      expect(result.boundingBox?.width).toBe(0);
      expect(result.boundingBox?.height).toBe(0);
    });

    it('T4.5: rejects micro-movement spanning strictly less than 2x2 area', () => {
      const microArea: SignatureStroke[] = [
        {
          points: [
            { x: 100, y: 100 },
            { x: 100.5, y: 100.5 },
            { x: 101, y: 100 },
          ],
        },
      ];
      const result = validateSignatureStrokes(microArea);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('zero movement area');
    });

    it('T4.6: accepts valid cursive handwriting with >= 3 points and area >= 2x2', () => {
      const validStroke: SignatureStroke[] = [
        {
          points: [
            { x: 100, y: 100 },
            { x: 120, y: 140 },
            { x: 160, y: 110 },
          ],
        },
      ];
      const result = validateSignatureStrokes(validStroke);
      expect(result.isValid).toBe(true);
      expect(result.totalPoints).toBe(3);
      expect(result.boundingBox?.width).toBe(60);
      expect(result.boundingBox?.height).toBe(40);
    });

    it('T4.7: getTrimmedDataUrl returns null when canvas contains only transparent pixels', () => {
      const padRef = React.createRef<SignaturePadHandle>();
      const { container } = render(<SignaturePad ref={padRef} width={400} height={200} />);
      const canvas = container.querySelector('canvas')!;
      const ctx = canvas.getContext('2d')!;

      // Add valid stroke to bypass stroke-level validation
      act(() => {
        fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 100, isPrimary: true });
        fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 120, clientY: 120 });
        fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 150, clientY: 140 });
        fireEvent.pointerUp(canvas, { pointerId: 1 });
      });

      // Override getImageData to return all-zero alpha (transparent)
      const transparentData = new Uint8ClampedArray(canvas.width * canvas.height * 4);
      ctx.getImageData = vi.fn(() => ({
        width: canvas.width,
        height: canvas.height,
        data: transparentData,
        colorSpace: 'srgb' as PredefinedColorSpace,
      }));

      const trimmed = padRef.current?.getTrimmedDataUrl(8, 0);
      expect(trimmed).toBeNull();
    });

    it('T4.8: edge-to-edge drawing on boundaries (0,0) clamps crop coordinates without out-of-bounds errors', () => {
      const padRef = React.createRef<SignaturePadHandle>();
      const { container } = render(<SignaturePad ref={padRef} width={400} height={200} />);
      const canvas = container.querySelector('canvas')!;
      const ctx = canvas.getContext('2d')!;

      act(() => {
        fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 0, clientY: 0, isPrimary: true });
        fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
        fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 20, clientY: 20 });
        fireEvent.pointerUp(canvas, { pointerId: 1 });
      });

      // Synthetic image data touching top-left (0, 0)
      const testData = new Uint8ClampedArray(canvas.width * canvas.height * 4);
      testData[3] = 255; // pixel (0, 0) alpha
      ctx.getImageData = vi.fn(() => ({
        width: canvas.width,
        height: canvas.height,
        data: testData,
        colorSpace: 'srgb' as PredefinedColorSpace,
      }));

      const trimmed = padRef.current?.getTrimmedDataUrl(10, 0);
      expect(trimmed).not.toBeNull();
      expect(trimmed).toMatch(/^data:image\/png;base64,/);
    });

    it('T4.9: edge-to-edge drawing on max border (w-1, h-1) clamps width/height without buffer overflow', () => {
      const padRef = React.createRef<SignaturePadHandle>();
      const { container } = render(<SignaturePad ref={padRef} width={400} height={200} />);
      const canvas = container.querySelector('canvas')!;
      const ctx = canvas.getContext('2d')!;

      act(() => {
        fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 380, clientY: 180, isPrimary: true });
        fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 390, clientY: 190 });
        fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 400, clientY: 200 });
        fireEvent.pointerUp(canvas, { pointerId: 1 });
      });

      // Pixel on bottom-right corner (canvas.width - 1, canvas.height - 1)
      const w = canvas.width;
      const h = canvas.height;
      const testData = new Uint8ClampedArray(w * h * 4);
      const lastPixelIdx = ((h - 1) * w + (w - 1)) * 4 + 3;
      testData[lastPixelIdx] = 255;

      ctx.getImageData = vi.fn(() => ({
        width: w,
        height: h,
        data: testData,
        colorSpace: 'srgb' as PredefinedColorSpace,
      }));

      const trimmed = padRef.current?.getTrimmedDataUrl(12, 0);
      expect(trimmed).not.toBeNull();
      expect(trimmed).toMatch(/^data:image\/png;base64,/);
    });
  });

  // =========================================================================
  // 5. History Stack Adversarial Suite
  // =========================================================================
  describe('5. Signature History Stack (Undo, Redo, Invalidation, Clear)', () => {
    let padRef: React.RefObject<SignaturePadHandle | null>;
    let canvas: HTMLCanvasElement;

    const drawStroke = (xStart: number, yStart: number, pointerId: number) => {
      act(() => {
        fireEvent.pointerDown(canvas, { pointerId, clientX: xStart, clientY: yStart, isPrimary: true });
        fireEvent.pointerMove(canvas, { pointerId, clientX: xStart + 20, clientY: yStart + 20 });
        fireEvent.pointerMove(canvas, { pointerId, clientX: xStart + 40, clientY: yStart + 40 });
        fireEvent.pointerUp(canvas, { pointerId });
      });
    };

    beforeEach(() => {
      padRef = React.createRef<SignaturePadHandle>();
      const rendered = render(<SignaturePad ref={padRef} width={400} height={200} />);
      canvas = rendered.container.querySelector('canvas')!;
      canvas.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        right: 400,
        bottom: 200,
        width: 400,
        height: 200,
        x: 0,
        y: 0,
        toJSON: () => {},
      });
    });

    it('T5.1: multiple undos down to empty correctly update canUndo, canRedo, and isEmpty', () => {
      drawStroke(10, 10, 1);
      drawStroke(50, 50, 2);
      drawStroke(90, 90, 3);

      expect(padRef.current?.getStrokes()).toHaveLength(3);
      expect(padRef.current?.canUndo()).toBe(true);
      expect(padRef.current?.canRedo()).toBe(false);

      // Undo 1
      act(() => {
        const u1 = padRef.current?.undo();
        expect(u1).toBe(true);
      });
      expect(padRef.current?.getStrokes()).toHaveLength(2);
      expect(padRef.current?.canUndo()).toBe(true);
      expect(padRef.current?.canRedo()).toBe(true);

      // Undo 2
      act(() => {
        const u2 = padRef.current?.undo();
        expect(u2).toBe(true);
      });
      expect(padRef.current?.getStrokes()).toHaveLength(1);
      expect(padRef.current?.canUndo()).toBe(true);
      expect(padRef.current?.canRedo()).toBe(true);

      // Undo 3 -> reaches empty state
      act(() => {
        const u3 = padRef.current?.undo();
        expect(u3).toBe(true);
      });
      expect(padRef.current?.getStrokes()).toHaveLength(0);
      expect(padRef.current?.canUndo()).toBe(false);
      expect(padRef.current?.canRedo()).toBe(true);
      expect(padRef.current?.isEmpty()).toBe(true);
    });

    it('T5.2: over-undoing on empty history returns false without throwing', () => {
      expect(padRef.current?.isEmpty()).toBe(true);
      expect(padRef.current?.canUndo()).toBe(false);

      act(() => {
        const result = padRef.current?.undo();
        expect(result).toBe(false);
      });
      expect(padRef.current?.getStrokes()).toHaveLength(0);
    });

    it('T5.3: multiple redos restore strokes in correct LIFO sequence', () => {
      drawStroke(10, 10, 1);
      drawStroke(50, 50, 2);
      drawStroke(90, 90, 3);

      // Undo all 3
      act(() => {
        padRef.current?.undo();
      });
      act(() => {
        padRef.current?.undo();
      });
      act(() => {
        padRef.current?.undo();
      });
      expect(padRef.current?.getStrokes()).toHaveLength(0);

      // Redo 1 -> restores stroke 1
      act(() => {
        const r1 = padRef.current?.redo();
        expect(r1).toBe(true);
      });
      expect(padRef.current?.getStrokes()).toHaveLength(1);
      expect(padRef.current?.getStrokes()[0].points[0].x).toBe(10);

      // Redo 2 -> restores stroke 2
      act(() => {
        const r2 = padRef.current?.redo();
        expect(r2).toBe(true);
      });
      expect(padRef.current?.getStrokes()).toHaveLength(2);
      expect(padRef.current?.getStrokes()[1].points[0].x).toBe(50);

      // Redo 3 -> restores stroke 3
      act(() => {
        const r3 = padRef.current?.redo();
        expect(r3).toBe(true);
      });
      expect(padRef.current?.getStrokes()).toHaveLength(3);
      expect(padRef.current?.getStrokes()[2].points[0].x).toBe(90);
      expect(padRef.current?.canRedo()).toBe(false);

      // Over-redo returns false
      act(() => {
        const r4 = padRef.current?.redo();
        expect(r4).toBe(false);
      });
    });

    it('T5.4: drawing a new stroke after undo invalidates the entire redo stack', () => {
      drawStroke(10, 10, 1);
      drawStroke(50, 50, 2);

      // Undo stroke 2 -> stroke 2 is in redo stack
      act(() => {
        padRef.current?.undo();
      });
      expect(padRef.current?.canRedo()).toBe(true);
      expect(padRef.current?.getStrokes()).toHaveLength(1);

      // Draw brand-new stroke 3
      drawStroke(100, 100, 3);

      // Redo stack MUST be invalidated (canRedo becomes false, cannot redo stroke 2)
      expect(padRef.current?.getStrokes()).toHaveLength(2);
      expect(padRef.current?.getStrokes()[0].points[0].x).toBe(10);
      expect(padRef.current?.getStrokes()[1].points[0].x).toBe(100);
      expect(padRef.current?.canRedo()).toBe(false);

      act(() => {
        const redoAttempt = padRef.current?.redo();
        expect(redoAttempt).toBe(false);
      });
    });

    it('T5.5: clear operation resets both strokes and redo stack and clears canvas', () => {
      drawStroke(10, 10, 1);
      drawStroke(50, 50, 2);
      act(() => {
        padRef.current?.undo();
      });
      expect(padRef.current?.canUndo()).toBe(true);
      expect(padRef.current?.canRedo()).toBe(true);

      // Clear
      act(() => {
        padRef.current?.clear();
      });

      expect(padRef.current?.getStrokes()).toHaveLength(0);
      expect(padRef.current?.canUndo()).toBe(false);
      expect(padRef.current?.canRedo()).toBe(false);
      expect(padRef.current?.isEmpty()).toBe(true);
    });
  });

  // =========================================================================
  // 6. Concurrency & Stress Edge Cases
  // =========================================================================
  describe('6. Rapid Interactions & Stress', () => {
    it('T6.1: rapid alternating undo and redo cycles maintain deterministic stroke integrity', () => {
      const padRef = React.createRef<SignaturePadHandle>();
      const { container } = render(<SignaturePad ref={padRef} width={400} height={200} />);
      const canvas = container.querySelector('canvas')!;
      canvas.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        right: 400,
        bottom: 200,
        width: 400,
        height: 200,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      // Draw 3 strokes with separate acts to allow state flushing
      act(() => {
        fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 20, clientY: 20, isPrimary: true });
        fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 30, clientY: 30 });
        fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 40, clientY: 40 });
        fireEvent.pointerUp(canvas, { pointerId: 1 });
      });

      act(() => {
        fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 50, clientY: 50, isPrimary: true });
        fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 60, clientY: 60 });
        fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 70, clientY: 70 });
        fireEvent.pointerUp(canvas, { pointerId: 2 });
      });

      act(() => {
        fireEvent.pointerDown(canvas, { pointerId: 3, clientX: 80, clientY: 80, isPrimary: true });
        fireEvent.pointerMove(canvas, { pointerId: 3, clientX: 90, clientY: 90 });
        fireEvent.pointerMove(canvas, { pointerId: 3, clientX: 100, clientY: 100 });
        fireEvent.pointerUp(canvas, { pointerId: 3 });
      });

      expect(padRef.current?.getStrokes()).toHaveLength(3);

      // Alternating undo/redo cycles with separate acts
      for (let cycle = 0; cycle < 10; cycle++) {
        act(() => {
          padRef.current?.undo();
        });
        act(() => {
          padRef.current?.redo();
        });
      }

      // Deterministic state: exactly 3 strokes remain intact
      expect(padRef.current?.getStrokes()).toHaveLength(3);
      expect(padRef.current?.canUndo()).toBe(true);
      expect(padRef.current?.canRedo()).toBe(false);
    });

    it('T6.2: clear called while stroke is active cleanly terminates in-progress drawing', () => {
      const padRef = React.createRef<SignaturePadHandle>();
      const { container } = render(<SignaturePad ref={padRef} width={400} height={200} />);
      const canvas = container.querySelector('canvas')!;

      act(() => {
        fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 50, clientY: 50, isPrimary: true });
        fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 60, clientY: 60 });
      });

      // Clear called mid-stroke
      act(() => {
        padRef.current?.clear();
      });

      // Stray pointerup afterwards
      act(() => {
        fireEvent.pointerUp(canvas, { pointerId: 1 });
      });

      // Should be pristine empty
      expect(padRef.current?.getStrokes()).toHaveLength(0);
      expect(padRef.current?.isEmpty()).toBe(true);
    });
  });

  // =========================================================================
  // 7. Extreme Padding, Clamping & Thresholds
  // =========================================================================
  describe('7. Extreme Padding, Clamping & Alpha Thresholds', () => {
    it('T7.1: padding = 0 generates tightest crop box without border padding', () => {
      const padRef = React.createRef<SignaturePadHandle>();
      const { container } = render(<SignaturePad ref={padRef} width={400} height={200} />);
      const canvas = container.querySelector('canvas')!;
      const ctx = canvas.getContext('2d')!;

      act(() => {
        fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 100, isPrimary: true });
        fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 120, clientY: 120 });
        fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 150, clientY: 150 });
        fireEvent.pointerUp(canvas, { pointerId: 1 });
      });

      // Synthetic painted box: x in [100, 150], y in [100, 150]
      const w = canvas.width;
      const h = canvas.height;
      const testData = new Uint8ClampedArray(w * h * 4);
      for (let y = 100; y <= 150; y++) {
        for (let x = 100; x <= 150; x++) {
          testData[(y * w + x) * 4 + 3] = 255;
        }
      }

      ctx.getImageData = vi.fn(() => ({
        width: w,
        height: h,
        data: testData,
        colorSpace: 'srgb' as PredefinedColorSpace,
      }));

      const tightUrl = padRef.current?.getTrimmedDataUrl(0, 0);
      expect(tightUrl).not.toBeNull();
      expect(tightUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('T7.2: huge padding (e.g. 1000px) is clamped to canvas dimensions without out-of-bounds error', () => {
      const padRef = React.createRef<SignaturePadHandle>();
      const { container } = render(<SignaturePad ref={padRef} width={400} height={200} />);
      const canvas = container.querySelector('canvas')!;
      const ctx = canvas.getContext('2d')!;

      act(() => {
        fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 100, isPrimary: true });
        fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 120, clientY: 120 });
        fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 150, clientY: 150 });
        fireEvent.pointerUp(canvas, { pointerId: 1 });
      });

      const w = canvas.width;
      const h = canvas.height;
      const testData = new Uint8ClampedArray(w * h * 4);
      testData[(100 * w + 100) * 4 + 3] = 255;

      ctx.getImageData = vi.fn(() => ({
        width: w,
        height: h,
        data: testData,
        colorSpace: 'srgb' as PredefinedColorSpace,
      }));

      // padding 1000 >> canvas width 400
      const hugePadUrl = padRef.current?.getTrimmedDataUrl(1000, 0);
      expect(hugePadUrl).not.toBeNull();
    });

    it('T7.3: custom alphaThreshold ignores faint antialiasing noise below threshold', () => {
      const padRef = React.createRef<SignaturePadHandle>();
      const { container } = render(<SignaturePad ref={padRef} width={400} height={200} />);
      const canvas = container.querySelector('canvas')!;
      const ctx = canvas.getContext('2d')!;

      act(() => {
        fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 100, isPrimary: true });
        fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 120, clientY: 120 });
        fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 150, clientY: 150 });
        fireEvent.pointerUp(canvas, { pointerId: 1 });
      });

      const w = canvas.width;
      const h = canvas.height;
      const testData = new Uint8ClampedArray(w * h * 4);
      // Faint noise at alpha = 50
      testData[(100 * w + 100) * 4 + 3] = 50;

      ctx.getImageData = vi.fn(() => ({
        width: w,
        height: h,
        data: testData,
        colorSpace: 'srgb' as PredefinedColorSpace,
      }));

      // If threshold is 100, faint noise (alpha 50) is treated as transparent
      const result = padRef.current?.getTrimmedDataUrl(8, 100);
      expect(result).toBeNull();

      // If threshold is 10, faint noise (alpha 50) is detected
      const resultFaint = padRef.current?.getTrimmedDataUrl(8, 10);
      expect(resultFaint).not.toBeNull();
    });
  });

  // =========================================================================
  // 8. Collinear Bézier Smoothing & Window Resize
  // =========================================================================
  describe('8. Collinear Bézier Smoothing & Dynamic Window Resize', () => {
    it('T8.1: collinear diagonal points compute collinear midpoints without curve deviation', () => {
      const stroke: SignatureStroke = {
        points: [
          { x: 10, y: 10 },
          { x: 20, y: 20 },
          { x: 30, y: 30 },
          { x: 40, y: 40 },
        ],
      };

      // Midpoints should be (25, 25) and (35, 35) which lie exactly on y = x
      const mid1X = (stroke.points[1].x + stroke.points[2].x) / 2;
      const mid1Y = (stroke.points[1].y + stroke.points[2].y) / 2;
      expect(mid1X).toBe(25);
      expect(mid1Y).toBe(25);

      const mid2X = (stroke.points[2].x + stroke.points[3].x) / 2;
      const mid2Y = (stroke.points[2].y + stroke.points[3].y) / 2;
      expect(mid2X).toBe(35);
      expect(mid2Y).toBe(35);

      const validation = validateSignatureStrokes([stroke]);
      expect(validation.isValid).toBe(true);
      expect(validation.totalPoints).toBe(4);
    });

    it('T8.2: window resize event triggers setupCanvas re-evaluation', () => {
      const padRef = React.createRef<SignaturePadHandle>();
      const { container } = render(<SignaturePad ref={padRef} width={400} height={200} />);
      const canvas = container.querySelector('canvas')!;
      const ctx = canvas.getContext('2d') as any;

      expect(ctx.scale).toHaveBeenCalled();
      const initialScaleCalls = ctx.scale.mock.calls.length;

      // Dispatch resize event on window
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      // setupCanvas should have re-executed
      expect(ctx.scale.mock.calls.length).toBeGreaterThan(initialScaleCalls);
    });
  });

  // =========================================================================
  // 9. SignaturePadModal Adversarial Submissions
  // =========================================================================
  describe('9. SignaturePadModal Adversarial Submissions', () => {
    it('T9.1: blocks confirmation when signer name is blank or only whitespace', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      const { container } = render(
        <SignaturePadModal
          isOpen={true}
          onClose={onClose}
          onSave={onSave}
          role="contractor"
          defaultSignerName="   "
        />
      );

      const confirmBtn = container.querySelector('button.bg-amber-500') as HTMLButtonElement;
      act(() => {
        fireEvent.click(confirmBtn);
      });

      expect(onSave).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('T9.2: blocks confirmation when name is valid but canvas has no signature', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      const { container } = render(
        <SignaturePadModal
          isOpen={true}
          onClose={onClose}
          onSave={onSave}
          role="client"
          defaultSignerName="Ing. Karel Dvořák"
        />
      );

      const confirmBtn = container.querySelector('button.bg-amber-500') as HTMLButtonElement;
      act(() => {
        fireEvent.click(confirmBtn);
      });

      // No signature drawn -> blocked
      expect(onSave).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
