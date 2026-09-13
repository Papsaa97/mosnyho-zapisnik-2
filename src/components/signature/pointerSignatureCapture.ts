import { SignatureStroke } from '../../types';

/**
 * Signature Pad Pointer Events Controller
 * Encapsulates W3C Pointer Event signature capture logic per ORIGINAL_REQUEST §R1 & PROJECT.md #1:
 * - pointerdown, pointermove, pointerup, pointercancel
 * - pointer capture (setPointerCapture / releasePointerCapture)
 * - touch-action: none styling
 * - pressure sensitivity [0.0, 1.0] with default fallback
 * - primary pointer tracking / palm rejection
 */
export class PointerSignatureCapture {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isDrawing = false;
  private activePointerId: number | null = null;
  private currentStroke: SignatureStroke | null = null;
  private strokes: SignatureStroke[] = [];
  public touchActionApplied = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context not available');
    }
    this.ctx = context;
    this.setupCanvas();
    this.bindEvents();
  }

  private setupCanvas() {
    this.canvas.style.touchAction = 'none';
    this.touchActionApplied = this.canvas.style.touchAction === 'none';
  }

  private bindEvents() {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown.bind(this));
    this.canvas.addEventListener('pointermove', this.handlePointerMove.bind(this));
    this.canvas.addEventListener('pointerup', this.handlePointerUp.bind(this));
    this.canvas.addEventListener('pointercancel', this.handlePointerCancel.bind(this));
  }

  public handlePointerDown(e: PointerEvent): void {
    // Palm rejection: only accept primary pointer or first active pointer
    if (this.activePointerId !== null && this.activePointerId !== e.pointerId) {
      return;
    }
    if (e.isPrimary === false && this.activePointerId === null) {
      return;
    }

    this.activePointerId = e.pointerId;
    this.isDrawing = true;

    if (typeof this.canvas.setPointerCapture === 'function') {
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        // Fallback if pointer capture fails in test environment
      }
    }

    const coords = this.getCanvasCoordinates(e);
    const pressure = typeof e.pressure === 'number' && e.pressure > 0 ? e.pressure : 0.5;

    this.currentStroke = {
      points: [{ x: coords.x, y: coords.y, time: e.timeStamp || Date.now(), pressure }],
    };

    this.ctx.beginPath();
    this.ctx.moveTo(coords.x, coords.y);
  }

  public handlePointerMove(e: PointerEvent): void {
    if (!this.isDrawing || this.activePointerId !== e.pointerId || !this.currentStroke) {
      return;
    }

    const coords = this.getCanvasCoordinates(e);
    const pressure = typeof e.pressure === 'number' && e.pressure > 0 ? e.pressure : 0.5;

    this.currentStroke.points.push({
      x: coords.x,
      y: coords.y,
      time: e.timeStamp || Date.now(),
      pressure,
    });

    this.ctx.lineTo(coords.x, coords.y);
    this.ctx.stroke();
  }

  public handlePointerUp(e: PointerEvent): void {
    if (this.activePointerId !== e.pointerId) {
      return;
    }

    if (this.isDrawing && this.currentStroke) {
      if (this.currentStroke.points.length > 0) {
        this.strokes.push(this.currentStroke);
      }
      this.currentStroke = null;
    }

    if (typeof this.canvas.releasePointerCapture === 'function') {
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore in mock environment
      }
    }

    this.isDrawing = false;
    this.activePointerId = null;
  }

  public handlePointerCancel(e: PointerEvent): void {
    if (this.activePointerId !== e.pointerId) {
      return;
    }

    this.currentStroke = null;
    this.isDrawing = false;
    this.activePointerId = null;

    if (typeof this.canvas.releasePointerCapture === 'function') {
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
    }
  }

  public getCanvasCoordinates(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: Math.round(e.clientX - rect.left),
      y: Math.round(clientY(e, rect)),
    };
  }

  public getStrokes(): SignatureStroke[] {
    return this.strokes;
  }

  public getIsDrawing(): boolean {
    return this.isDrawing;
  }

  public getActivePointerId(): number | null {
    return this.activePointerId;
  }
}

function clientY(e: PointerEvent, rect: DOMRect): number {
  return e.clientY - rect.top;
}
