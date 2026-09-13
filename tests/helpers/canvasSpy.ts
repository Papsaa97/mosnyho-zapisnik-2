import { vi } from 'vitest';

export interface CanvasOperationRecord {
  method: string;
  args: any[];
  timestamp: number;
}

export interface CanvasSpyInstance {
  context: any;
  records: CanvasOperationRecord[];
  getCalls: (methodName?: string) => CanvasOperationRecord[];
  hasDrawnPath: () => boolean;
  hasRenderedText: (substring?: string) => boolean;
  hasDrawnImage: () => boolean;
  hasClearedCanvas: () => boolean;
  getStrokeCoordinates: () => Array<{ type: string; x: number; y: number }>;
  reset: () => void;
  restore: () => void;
}

/**
 * Attaches recording spies to an HTMLCanvasElement or its 2D context
 * to verify drawing, signature smoothing, and watermark stamping operations.
 */
export function attachCanvasSpy(canvas: HTMLCanvasElement): CanvasSpyInstance {
  const ctx = canvas.getContext('2d') as any;
  if (!ctx) {
    throw new Error('Cannot attach canvas spy: getContext("2d") returned null');
  }

  const records: CanvasOperationRecord[] = [];
  const originalFns = new Map<string, Function>();

  const methodsToSpy = [
    'beginPath',
    'moveTo',
    'lineTo',
    'quadraticCurveTo',
    'bezierCurveTo',
    'arc',
    'arcTo',
    'closePath',
    'stroke',
    'fill',
    'fillRect',
    'strokeRect',
    'clearRect',
    'fillText',
    'strokeText',
    'drawImage',
    'putImageData',
    'scale',
    'rotate',
    'translate',
    'save',
    'restore',
  ];

  for (const method of methodsToSpy) {
    const orig = ctx[method];
    if (typeof orig === 'function') {
      originalFns.set(method, orig);
      ctx[method] = vi.fn(function (...args: any[]) {
        records.push({
          method,
          args,
          timestamp: Date.now(),
        });
        return orig.apply(ctx, args);
      });
    }
  }

  const spyInstance: CanvasSpyInstance = {
    context: ctx,
    records,

    getCalls(methodName?: string) {
      if (!methodName) return [...records];
      return records.filter((r) => r.method === methodName);
    },

    hasDrawnPath() {
      const hasBegin = records.some((r) => r.method === 'beginPath');
      const hasStrokeOrFill = records.some((r) => r.method === 'stroke' || r.method === 'fill');
      return hasBegin && hasStrokeOrFill;
    },

    hasRenderedText(substring?: string) {
      const textCalls = records.filter((r) => r.method === 'fillText' || r.method === 'strokeText');
      if (!substring) return textCalls.length > 0;
      return textCalls.some((r) => String(r.args[0] ?? '').includes(substring));
    },

    hasDrawnImage() {
      return records.some((r) => r.method === 'drawImage');
    },

    hasClearedCanvas() {
      return records.some((r) => r.method === 'clearRect');
    },

    getStrokeCoordinates() {
      const coords: Array<{ type: string; x: number; y: number }> = [];
      for (const r of records) {
        if (r.method === 'moveTo' || r.method === 'lineTo') {
          coords.push({ type: r.method, x: r.args[0], y: r.args[1] });
        } else if (r.method === 'quadraticCurveTo') {
          coords.push({ type: 'quadratic_cp', x: r.args[0], y: r.args[1] });
          coords.push({ type: 'quadratic_end', x: r.args[2], y: r.args[3] });
        } else if (r.method === 'bezierCurveTo') {
          coords.push({ type: 'bezier_cp1', x: r.args[0], y: r.args[1] });
          coords.push({ type: 'bezier_cp2', x: r.args[2], y: r.args[3] });
          coords.push({ type: 'bezier_end', x: r.args[4], y: r.args[5] });
        }
      }
      return coords;
    },

    reset() {
      records.length = 0;
    },

    restore() {
      for (const [method, orig] of originalFns.entries()) {
        ctx[method] = orig;
      }
      records.length = 0;
    },
  };

  return spyInstance;
}
