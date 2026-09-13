import { describe, it, expect } from 'vitest';
import {
  SINGLE_POINT_STROKE_FIXTURE,
  CONTRACTOR_STROKES_FIXTURE,
} from '../../fixtures/signatures.fixture';
import {
  validateSignatureStrokes,
  sanitizeStrokeCoordinates,
  MIN_SIGNATURE_POINTS,
  type SignatureValidationResult,
} from '../../../src/components/signature/SignaturePad';
import type { SignatureStroke } from '../../../src/types';

export { validateSignatureStrokes, sanitizeStrokeCoordinates, MIN_SIGNATURE_POINTS };
export type { SignatureValidationResult };

describe('Tier 2 Boundary: Signature Empty & Stroke Boundaries (signature-empty-boundaries.test.ts)', () => {
  // 1. Empty Signature Canvas Guard
  it('rejects empty stroke array and zero-stroke input with isValid=false', () => {
    const emptyResult = validateSignatureStrokes([]);
    expect(emptyResult.isValid).toBe(false);
    expect(emptyResult.totalPoints).toBe(0);
    expect(emptyResult.reason).toContain('completely empty');

    const emptyStrokesResult = validateSignatureStrokes([{ points: [] }]);
    expect(emptyStrokesResult.isValid).toBe(false);
    expect(emptyStrokesResult.totalPoints).toBe(0);
  });

  // 2. Single Dot / Tap Boundary (< 3 points)
  it('rejects single-point dot / tap as accidental touch (< 3 points)', () => {
    const tapResult = validateSignatureStrokes(SINGLE_POINT_STROKE_FIXTURE);
    expect(tapResult.isValid).toBe(false);
    expect(tapResult.totalPoints).toBe(1);
    expect(tapResult.reason).toContain('too short');

    // 2-point micro stroke boundary
    const twoPointStroke: SignatureStroke[] = [
      {
        points: [
          { x: 10, y: 10, time: 100 },
          { x: 11, y: 10, time: 110 },
        ],
      },
    ];
    const twoPtResult = validateSignatureStrokes(twoPointStroke);
    expect(twoPtResult.isValid).toBe(false);
    expect(twoPtResult.totalPoints).toBe(2);
  });

  // 3. Static Multi-Point Tap (Zero Area)
  it('rejects multi-point burst at exact same pixel with zero bounding box area', () => {
    const staticTap: SignatureStroke[] = [
      {
        points: [
          { x: 50, y: 50, time: 100 },
          { x: 50, y: 50, time: 101 },
          { x: 50, y: 50, time: 102 },
          { x: 50, y: 50, time: 103 },
        ],
      },
    ];
    const res = validateSignatureStrokes(staticTap);
    expect(res.isValid).toBe(false);
    expect(res.reason).toContain('zero movement area');
  });

  // 4. Valid Handwriting Stroke Threshold (>= 3 points with movement)
  it('accepts valid cursive stroke with >= 3 points and realistic movement', () => {
    const res = validateSignatureStrokes(CONTRACTOR_STROKES_FIXTURE);
    expect(res.isValid).toBe(true);
    expect(res.totalPoints).toBe(10);
    expect(res.totalStrokes).toBe(2);
    expect(res.boundingBox).toBeDefined();
    expect(res.boundingBox!.width).toBeGreaterThan(50);
    expect(res.boundingBox!.height).toBeGreaterThan(20);
  });

  // 5. Out-of-Bounds Coordinate Clamping
  it('clamps out-of-bounds coordinates (negative or exceeding canvas dimensions)', () => {
    const outOfBoundsStroke: SignatureStroke = {
      points: [
        { x: -50, y: -20, time: 100 },
        { x: 200, y: 100, time: 150 },
        { x: 600, y: 350, time: 200 }, // Canvas is 400x200
      ],
    };

    const sanitized = sanitizeStrokeCoordinates(outOfBoundsStroke, 400, 200);
    expect(sanitized.points[0].x).toBe(0);
    expect(sanitized.points[0].y).toBe(0);
    expect(sanitized.points[1].x).toBe(200);
    expect(sanitized.points[1].y).toBe(100);
    expect(sanitized.points[2].x).toBe(400); // clamped to canvas width
    expect(sanitized.points[2].y).toBe(200); // clamped to canvas height
  });

  // 6. Rapid Touch Bursts Deduplication
  it('deduplicates duplicate coordinates resulting from rapid hardware touch bursts', () => {
    const burstStroke: SignatureStroke = {
      points: [
        { x: 100, y: 100, time: 1000 },
        { x: 100, y: 100, time: 1000 }, // identical duplicate
        { x: 105, y: 102, time: 1005 },
        { x: 105, y: 102, time: 1006 }, // identical duplicate
        { x: 110, y: 108, time: 1010 },
      ],
    };

    const sanitized = sanitizeStrokeCoordinates(burstStroke, 400, 200);
    expect(sanitized.points).toHaveLength(3);
    expect(sanitized.points.map((p) => p.x)).toEqual([100, 105, 110]);
  });

  // 7. Reset / Canvas Clear State
  it('verifies that canvas clear resets signature back to pristine invalid state', () => {
    let currentStrokes: SignatureStroke[] = [...CONTRACTOR_STROKES_FIXTURE];
    expect(validateSignatureStrokes(currentStrokes).isValid).toBe(true);

    // Simulate Clear / Reset button
    currentStrokes = [];
    const resetResult = validateSignatureStrokes(currentStrokes);
    expect(resetResult.isValid).toBe(false);
    expect(resetResult.totalPoints).toBe(0);
  });
});
