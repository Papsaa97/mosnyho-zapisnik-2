import { SignatureStroke } from '../../types';

/**
 * Signature History and Canvas Reset Manager
 * Implements undo/redo stacks, canvas redraw, and empty canvas detection
 * per ORIGINAL_REQUEST §R1 & PROJECT.md #4.
 */
export class SignatureHistoryManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private strokes: SignatureStroke[] = [];
  private redoStack: SignatureStroke[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context not available');
    }
    this.ctx = context;
  }

  public addStroke(stroke: SignatureStroke): void {
    if (!stroke.points || stroke.points.length === 0) return;
    this.strokes.push(stroke);
    // Standard rule: new drawing action invalidates redo stack
    this.redoStack = [];
    this.redraw();
  }

  public undo(): boolean {
    if (this.strokes.length === 0) {
      return false;
    }
    const undone = this.strokes.pop()!;
    this.redoStack.push(undone);
    this.redraw();
    return true;
  }

  public redo(): boolean {
    if (this.redoStack.length === 0) {
      return false;
    }
    const redone = this.redoStack.pop()!;
    this.strokes.push(redone);
    this.redraw();
    return true;
  }

  public clear(): void {
    this.strokes = [];
    this.redoStack = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  public redraw(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const stroke of this.strokes) {
      const points = stroke.points;
      if (points.length === 0) continue;
      this.ctx.beginPath();
      this.ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.ctx.lineTo(points[i].x, points[i].y);
      }
      this.ctx.stroke();
    }
  }

  public isEmpty(): boolean {
    return this.strokes.length === 0;
  }

  public canUndo(): boolean {
    return this.strokes.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public getStrokes(): SignatureStroke[] {
    return [...this.strokes];
  }

  public getRedoCount(): number {
    return this.redoStack.length;
  }
}
