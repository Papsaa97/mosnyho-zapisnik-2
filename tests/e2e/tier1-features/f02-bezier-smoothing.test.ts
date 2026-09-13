import { describe, it, expect, beforeEach } from 'vitest';
import { attachCanvasSpy, CanvasSpyInstance } from '../../helpers/canvasSpy';
import {
  CONTRACTOR_STROKES_FIXTURE,
  CLIENT_STROKES_FIXTURE,
  SINGLE_POINT_STROKE_FIXTURE,
} from '../../fixtures/signatures.fixture';
import { BezierSmoother, type CurveSegment } from '../../../src/components/signature/SignaturePad';
import type { SignaturePoint, SignatureStroke } from '../../../src/types';

export { BezierSmoother, type CurveSegment };

describe('Feature 2: Bézier Curve Smoothing (f02-bezier-smoothing)', () => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let spy: CanvasSpyInstance;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 200;
    ctx = canvas.getContext('2d')!;
    spy = attachCanvasSpy(canvas);
  });

  it('handles single-point tap by rendering a discrete dot via arc or fill', () => {
    const singlePointStroke = SINGLE_POINT_STROKE_FIXTURE[0];
    BezierSmoother.renderStroke(ctx, singlePointStroke);

    const arcCalls = spy.getCalls('arc');
    const fillCalls = spy.getCalls('fill');
    expect(arcCalls.length).toBe(1);
    expect(fillCalls.length).toBe(1);
    expect(arcCalls[0].args[0]).toBe(50);
    expect(arcCalls[0].args[1]).toBe(50);
  });

  it('handles two-point stroke by rendering a direct straight line segment', () => {
    const twoPointStroke: SignatureStroke = {
      points: [
        { x: 10, y: 10 },
        { x: 40, y: 50 },
      ],
    };

    BezierSmoother.renderStroke(ctx, twoPointStroke);

    const moveCalls = spy.getCalls('moveTo');
    const lineCalls = spy.getCalls('lineTo');
    const strokeCalls = spy.getCalls('stroke');
    expect(moveCalls.length).toBe(1);
    expect(moveCalls[0].args).toEqual([10, 10]);
    expect(lineCalls.length).toBe(1);
    expect(lineCalls[0].args).toEqual([40, 50]);
    expect(strokeCalls.length).toBe(1);
  });

  it('computes exact midpoints as endpoints for quadratic curve segments in 3+ point strokes', () => {
    const stroke: SignatureStroke = {
      points: [
        { x: 0, y: 0 },
        { x: 20, y: 40 },
        { x: 60, y: 20 },
        { x: 100, y: 80 },
      ],
    };

    // Expected midpoints:
    // mid(P1, P2) = ((20+60)/2, (40+20)/2) = (40, 30)
    // mid(P2, P3) = ((60+100)/2, (20+80)/2) = (80, 50)
    const segments = BezierSmoother.decomposeStroke(stroke);
    expect(segments).toHaveLength(3);

    expect(segments[0].type).toBe('quadratic');
    expect(segments[0].control).toEqual({ x: 20, y: 40 });
    expect(segments[0].end).toEqual({ x: 40, y: 30 });

    expect(segments[1].control).toEqual({ x: 60, y: 20 });
    expect(segments[1].end).toEqual({ x: 80, y: 50 });

    expect(segments[2].control).toEqual({ x: 60, y: 20 });
    expect(segments[2].end).toEqual({ x: 100, y: 80 });

    // Render onto canvas and verify quadraticCurveTo calls
    BezierSmoother.renderStroke(ctx, stroke);
    const quadCalls = spy.getCalls('quadraticCurveTo');
    expect(quadCalls.length).toBe(2);
    expect(quadCalls[0].args).toEqual([20, 40, 40, 30]);
    expect(quadCalls[1].args).toEqual([60, 20, 80, 50]);
  });

  it('ensures C1 continuity and smooth curvature without abrupt angular discontinuities', () => {
    // 3 quadratic segments: verify that tangent entering midpoint equals tangent leaving midpoint
    const stroke: SignatureStroke = {
      points: [
        { x: 10, y: 10 },
        { x: 30, y: 70 },
        { x: 70, y: 30 },
        { x: 110, y: 90 },
      ],
    };

    const segments = BezierSmoother.decomposeStroke(stroke);
    const seg1 = segments[0];
    const seg2 = segments[1];

    // Derivative of quadratic Bezier B(t) at end (t=1) is 2 * (P2 - P1)
    // Here P1 is control point, P2 is mid
    const tangentEndSeg1 = {
      x: 2 * (seg1.end.x - seg1.control!.x),
      y: 2 * (seg1.end.y - seg1.control!.y),
    };

    // Derivative of next segment at start (t=0) is 2 * (P1 - P0)
    const tangentStartSeg2 = {
      x: 2 * (seg2.control!.x - seg2.start.x),
      y: 2 * (seg2.control!.y - seg2.start.y),
    };

    // In midpoint interpolation, both segments share the same collinear slope at the midpoint
    const slope1 = tangentEndSeg1.y / tangentEndSeg1.x;
    const slope2 = tangentStartSeg2.y / tangentStartSeg2.x;
    expect(slope1).toBeCloseTo(slope2, 4);
  });

  it('preserves vector stroke fidelity for realistic handwriting signatures (CONTRACTOR_STROKES_FIXTURE)', () => {
    CONTRACTOR_STROKES_FIXTURE.forEach((stroke) => {
      BezierSmoother.renderStroke(ctx, stroke);
    });

    const moveCalls = spy.getCalls('moveTo');
    const quadCalls = spy.getCalls('quadraticCurveTo');
    const strokeCalls = spy.getCalls('stroke');

    expect(moveCalls.length).toBe(CONTRACTOR_STROKES_FIXTURE.length);
    expect(quadCalls.length).toBeGreaterThan(0);
    expect(strokeCalls.length).toBe(CONTRACTOR_STROKES_FIXTURE.length);

    // Initial point of stroke 1 should match fixture
    expect(moveCalls[0].args).toEqual([
      CONTRACTOR_STROKES_FIXTURE[0].points[0].x,
      CONTRACTOR_STROKES_FIXTURE[0].points[0].y,
    ]);
  });

  it('handles collinear points gracefully maintaining straight-line equivalence', () => {
    // Points along the line y = 2x
    const collinearStroke: SignatureStroke = {
      points: [
        { x: 10, y: 20 },
        { x: 20, y: 40 },
        { x: 30, y: 60 },
        { x: 40, y: 80 },
      ],
    };

    const segments = BezierSmoother.decomposeStroke(collinearStroke);
    expect(segments.length).toBe(3);

    // Evaluate curve points at t=0.5 along first quadratic segment
    const seg = segments[0];
    const ptMid = BezierSmoother.evaluateQuadratic(seg.start, seg.control!, seg.end, 0.5);

    // Verify ptMid lies exactly on y = 2x
    expect(ptMid.y).toBeCloseTo(2 * ptMid.x, 3);
  });
});
