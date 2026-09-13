import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// ==========================================
// 1. Pure-JS HTML5 Canvas 2D Mock
// ==========================================

export function createMockCanvasContext2D(canvas?: HTMLCanvasElement) {
  return {
    canvas: canvas || (typeof document !== 'undefined' ? document.createElement('canvas') : {}),
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    globalAlpha: 1.0,
    globalCompositeOperation: 'source-over',
    shadowBlur: 0,
    shadowColor: 'rgba(0, 0, 0, 0)',
    shadowOffsetX: 0,
    shadowOffsetY: 0,

    // Path methods
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    ellipse: vi.fn(),
    rect: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),

    // Rectangles & clearing
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),

    // Text
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn((text: string) => ({
      width: (text ? text.length : 0) * 8,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: (text ? text.length : 0) * 8,
      fontBoundingBoxAscent: 12,
      fontBoundingBoxDescent: 3,
    })),

    // Images & Pixel manipulation
    drawImage: vi.fn(),
    getImageData: vi.fn((sx: number = 0, sy: number = 0, sw: number = 100, sh: number = 100) => {
      const width = Math.max(1, Math.round(sw || 100));
      const height = Math.max(1, Math.round(sh || 100));
      const data = new Uint8ClampedArray(width * height * 4);
      // Simulate non-empty center pixel if desired for bounding box detection
      return {
        width,
        height,
        data,
        colorSpace: 'srgb' as PredefinedColorSpace,
      };
    }),
    putImageData: vi.fn(),
    createImageData: vi.fn((sw: number | ImageData = 100, sh: number = 100) => {
      const width = typeof sw === 'number' ? Math.max(1, sw) : sw.width;
      const height = typeof sw === 'number' ? Math.max(1, sh) : sw.height;
      return {
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4),
        colorSpace: 'srgb' as PredefinedColorSpace,
      };
    }),

    // Transformations & State
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    translate: vi.fn(),
    transform: vi.fn(),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
    clip: vi.fn(),

    // Gradients & Patterns
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createPattern: vi.fn(() => null),
  };
}

if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = vi.fn(function (
    this: HTMLCanvasElement,
    contextId: string
  ) {
    if (contextId === '2d') {
      if (!(this as any).__mockContext2D) {
        (this as any).__mockContext2D = createMockCanvasContext2D(this);
      }
      return (this as any).__mockContext2D;
    }
    return null;
  }) as any;

  HTMLCanvasElement.prototype.toDataURL = vi.fn(function (
    this: HTMLCanvasElement,
    type: string = 'image/png',
    quality: number = 0.8
  ) {
    const mime = type || 'image/png';
    const q = typeof quality === 'number' ? quality : 0.8;

    if (mime.includes('jpeg') || mime.includes('jpg')) {
      // Return simulated JPEG whose size correlates with compression quality
      const payloadSize = Math.max(256, Math.floor(350_000 * q));
      const simulatedPayload = 'A'.repeat(payloadSize);
      return `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/${simulatedPayload}`;
    }

    // Standard 1x1 transparent PNG data URL
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    return `data:${mime};base64,${pngBase64}`;
  });

  HTMLCanvasElement.prototype.toBlob = vi.fn(function (
    this: HTMLCanvasElement,
    callback: (blob: Blob | null) => void,
    type: string = 'image/png',
    quality: number = 0.8
  ) {
    const dataUrl = this.toDataURL(type, quality);
    const blob = new Blob([dataUrl], { type: type || 'image/png' });
    callback(blob);
  });
}

// ==========================================
// 2. URL Object Polyfills
// ==========================================

if (typeof URL.createObjectURL === 'undefined' || !vi.isMockFunction(URL.createObjectURL)) {
  let counter = 0;
  URL.createObjectURL = vi.fn((_obj: any) => `blob:mock-url-${++counter}`);
}

if (typeof URL.revokeObjectURL === 'undefined' || !vi.isMockFunction(URL.revokeObjectURL)) {
  URL.revokeObjectURL = vi.fn();
}

// ==========================================
// 3. window.matchMedia & ResizeObserver Polyfills
// ==========================================

if (typeof window !== 'undefined') {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })) as any;
}
