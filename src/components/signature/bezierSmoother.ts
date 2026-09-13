import { SignaturePoint, SignatureStroke } from '../../types';

export interface CurveSegment {
  type: 'dot' | 'line' | 'quadratic';
  start: { x: number; y: number };
  control?: { x: number; y: number };
  end: { x: number; y: number };
}

/**
 * Midpoint Quadratic Bézier Curve Smoothing Engine
 * Converts raw discrete pointer points into smooth handwriting curves
 * per ORIGINAL_REQUEST §R1 & PROJECT.md #2.
 */
export class BezierSmoother {
  /**
   * Computes the midpoint between two coordinates.
   */
  public static midpoint(p1: SignaturePoint, p2: SignaturePoint): { x: number; y: number } {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };
  }

  /**
   * Decomposes a stroke into deterministic mathematical segments.
   */
  public static decomposeStroke(stroke: SignatureStroke): CurveSegment[] {
    const points = stroke.points;
    if (!points || points.length === 0) return [];

    if (points.length === 1) {
      return [{
        type: 'dot',
        start: { x: points[0].x, y: points[0].y },
        end: { x: points[0].x, y: points[0].y },
      }];
    }

    if (points.length === 2) {
      return [{
        type: 'line',
        start: { x: points[0].x, y: points[0].y },
        end: { x: points[1].x, y: points[1].y },
      }];
    }

    const segments: CurveSegment[] = [];
    let currentStart = { x: points[0].x, y: points[0].y };

    for (let i = 1; i < points.length - 1; i++) {
      const mid = this.midpoint(points[i], points[i + 1]);
      segments.push({
        type: 'quadratic',
        start: currentStart,
        control: { x: points[i].x, y: points[i].y },
        end: mid,
      });
      currentStart = mid;
    }

    // Final segment connecting to last point
    const lastIdx = points.length - 1;
    segments.push({
      type: 'quadratic',
      start: currentStart,
      control: { x: points[lastIdx - 1].x, y: points[lastIdx - 1].y },
      end: { x: points[lastIdx].x, y: points[lastIdx].y },
    });

    return segments;
  }

  /**
   * Renders a smoothed stroke onto an HTML5 Canvas 2D context.
   */
  public static renderStroke(ctx: CanvasRenderingContext2D, stroke: SignatureStroke): void {
    const points = stroke.points;
    if (!points || points.length === 0) return;

    ctx.beginPath();

    if (points.length === 1) {
      const p = points[0];
      const radius = ((p.pressure || 0.5) * (stroke.lineWidth || 2.5)) / 2;
      ctx.arc(p.x, p.y, Math.max(1, radius), 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (points.length === 2) {
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.stroke();
      return;
    }

    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 1; i++) {
      const mid = this.midpoint(points[i], points[i + 1]);
      ctx.quadraticCurveTo(points[i].x, points[i].y, mid.x, mid.y);
    }

    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }

  /**
   * Evaluates quadratic Bézier point at parameter t in [0, 1].
   * B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
   */
  public static evaluateQuadratic(
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    t: number
  ): { x: number; y: number } {
    const oneMinusT = 1 - t;
    return {
      x: oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x,
      y: oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y,
    };
  }
}
