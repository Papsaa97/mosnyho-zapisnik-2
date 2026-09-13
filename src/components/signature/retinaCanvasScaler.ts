export interface CanvasDimensions {
  cssWidth: number;
  cssHeight: number;
  bufferWidth: number;
  bufferHeight: number;
  dpr: number;
}

/**
 * Retina DPR Canvas Scaler
 * Manages high-DPI canvas buffer scaling and coordinate mapping
 * per ORIGINAL_REQUEST §R1 & PROJECT.md #3.
 */
export class RetinaCanvasScaler {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private currentDpr: number = 1;
  private cssWidth: number = 0;
  private cssHeight: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context not available');
    }
    this.ctx = context;
  }

  /**
   * Configures canvas buffer size according to CSS size and DPR.
   */
  public resize(
    cssWidth: number,
    cssHeight: number,
    dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1
  ): CanvasDimensions {
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    this.currentDpr = Math.max(1, dpr);

    const bufferWidth = Math.round(cssWidth * this.currentDpr);
    const bufferHeight = Math.round(cssHeight * this.currentDpr);

    this.canvas.width = bufferWidth;
    this.canvas.height = bufferHeight;

    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;

    // Scale 2D drawing context so coordinates match CSS pixel grid
    if (typeof this.ctx.scale === 'function') {
      this.ctx.scale(this.currentDpr, this.currentDpr);
    }

    return {
      cssWidth,
      cssHeight,
      bufferWidth,
      bufferHeight,
      dpr: this.currentDpr,
    };
  }

  /**
   * Translates client pointer event to logical canvas coordinates.
   */
  public clientToLogical(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: Math.round(clientX - rect.left),
      y: Math.round(clientY - rect.top),
    };
  }

  /**
   * Translates logical coordinates to physical buffer pixels.
   */
  public logicalToBuffer(logicalX: number, logicalY: number): { x: number; y: number } {
    return {
      x: Math.round(logicalX * this.currentDpr),
      y: Math.round(logicalY * this.currentDpr),
    };
  }

  public getDpr(): number {
    return this.currentDpr;
  }

  public getCssDimensions(): { width: number; height: number } {
    return { width: this.cssWidth, height: this.cssHeight };
  }
}
