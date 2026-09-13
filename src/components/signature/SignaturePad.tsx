import React, {
  useRef,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback
} from 'react';
import { SignaturePoint, SignatureStroke } from '../../types';

import type { BoundingBox } from './signatureTrimmer';
export type { BoundingBox };

export interface SignatureValidationResult {
  isValid: boolean;
  reason?: string;
  totalPoints: number;
  totalStrokes: number;
  boundingBox?: BoundingBox;
}

export const MIN_SIGNATURE_POINTS = 3;

/**
 * Validates strokes against empty, accidental micro-taps, or zero-movement area.
 */
export function validateSignatureStrokes(
  strokes: SignatureStroke[],
  _canvasWidth = 400,
  _canvasHeight = 200
): SignatureValidationResult {
  if (!strokes || strokes.length === 0) {
    return {
      isValid: false,
      reason: 'Signature is completely empty (no strokes)',
      totalPoints: 0,
      totalStrokes: 0,
    };
  }

  let totalPoints = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const stroke of strokes) {
    if (!stroke.points || stroke.points.length === 0) continue;
    for (const pt of stroke.points) {
      totalPoints++;
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    }
  }

  if (totalPoints === 0) {
    return {
      isValid: false,
      reason: 'Signature contains only empty strokes',
      totalPoints: 0,
      totalStrokes: strokes.length,
    };
  }

  // Guard against accidental single-point tap or double-tap (< MIN_SIGNATURE_POINTS)
  if (totalPoints < MIN_SIGNATURE_POINTS) {
    return {
      isValid: false,
      reason: `Signature too short (${totalPoints} points < ${MIN_SIGNATURE_POINTS} required minimum)`,
      totalPoints,
      totalStrokes: strokes.length,
    };
  }

  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);

  // Guard against zero-area stroke (e.g. 5 points at the exact same pixel)
  if (width < 2 && height < 2) {
    return {
      isValid: false,
      reason: 'Signature has zero movement area (static tap)',
      totalPoints,
      totalStrokes: strokes.length,
      boundingBox: { minX, minY, maxX, maxY, width, height },
    };
  }

  return {
    isValid: true,
    totalPoints,
    totalStrokes: strokes.length,
    boundingBox: { minX, minY, maxX, maxY, width, height },
  };
}

/**
 * Sanitizes and bounds stroke coordinates within canvas dimensions.
 */
export function sanitizeStrokeCoordinates(
  stroke: SignatureStroke,
  canvasWidth = 400,
  canvasHeight = 200
): SignatureStroke {
  const sanitizedPoints: SignaturePoint[] = [];

  for (const pt of stroke.points) {
    // Clamp out-of-bounds coordinates
    const clampedX = Math.max(0, Math.min(canvasWidth, pt.x));
    const clampedY = Math.max(0, Math.min(canvasHeight, pt.y));

    // Deduplicate rapid touch bursts (points with identical coordinates)
    const prev = sanitizedPoints[sanitizedPoints.length - 1];
    if (prev && prev.x === clampedX && prev.y === clampedY) {
      continue;
    }

    sanitizedPoints.push({
      x: clampedX,
      y: clampedY,
      time: pt.time ?? Date.now(),
      pressure: Math.max(0, Math.min(1, pt.pressure ?? 0.5)),
    });
  }

  return {
    ...stroke,
    points: sanitizedPoints,
  };
}

export { BezierSmoother, type CurveSegment } from './bezierSmoother';
export { RetinaCanvasScaler, type CanvasDimensions } from './retinaCanvasScaler';
export { SignatureHistoryManager } from './signatureHistoryManager';
export { SignatureTrimmer, type CropResult } from './signatureTrimmer';
export { PointerSignatureCapture } from './pointerSignatureCapture';

export interface SignaturePadProps {
  onSave?: (dataUrl: string) => void;
  onStrokeChange?: (hasStrokes: boolean) => void;
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  className?: string;
}

export interface SignaturePadHandle {
  undo: () => boolean;
  redo: () => boolean;
  clear: () => void;
  getTrimmedDataUrl: (padding?: number, alphaThreshold?: number) => string | null;
  isEmpty: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getStrokes: () => SignatureStroke[];
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(({
  onSave,
  onStrokeChange,
  width = 500,
  height = 200,
  strokeColor = '#0f172a',
  strokeWidth = 2.5,
  className = '',
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes] = useState<SignatureStroke[]>([]);
  const [, setRedoStack] = useState<SignatureStroke[]>([]);
  const strokesRef = useRef<SignatureStroke[]>([]);
  const redoStackRef = useRef<SignatureStroke[]>([]);
  const isDrawingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const currentStrokeRef = useRef<SignatureStroke | null>(null);
  const dprRef = useRef<number>(1);

  // Redraw all strokes on canvas
  const redrawCanvas = useCallback((
    strokeList: SignatureStroke[],
    inProgressStroke?: SignatureStroke | null
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset transform to clear entire physical backing buffer
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const allToDraw = inProgressStroke ? [...strokeList, inProgressStroke] : strokeList;

    for (const stroke of allToDraw) {
      const points = stroke.points;
      if (!points || points.length === 0) continue;

      const color = stroke.color || strokeColor;
      const widthToUse = stroke.lineWidth || strokeWidth;

      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = widthToUse;

      if (points.length === 1) {
        // Single tap dot: draw filled circle
        const p = points[0];
        const pressure = p.pressure ?? 0.5;
        const radius = Math.max(1, (pressure * widthToUse) / 2);
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      if (points.length === 2) {
        // Straight line
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.stroke();
        continue;
      }

      // 3+ points: Midpoint quadratic Bézier curve smoothing
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length - 1; i++) {
        const midX = (points[i].x + points[i + 1].x) / 2;
        const midY = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
      }

      const lastPoint = points[points.length - 1];
      ctx.lineTo(lastPoint.x, lastPoint.y);
      ctx.stroke();
    }
  }, [strokeColor, strokeWidth]);

  // Setup High-DPI canvas buffer and coordinate scaling
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.max(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1, 1);
    dprRef.current = dpr;

    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width > 0 ? rect.width : width;
    const cssH = rect.height > 0 ? rect.height : height;

    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.style.touchAction = 'none';

    ctx.scale(dpr, dpr);
    redrawCanvas(strokesRef.current, currentStrokeRef.current);
  }, [width, height, redrawCanvas]);

  useEffect(() => {
    setupCanvas();
    const handleResize = () => {
      setupCanvas();
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [setupCanvas]);

  // Get normalized coordinates from pointer event
  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Primary pointer check / palm rejection
    if (activePointerIdRef.current !== null && activePointerIdRef.current !== e.pointerId) {
      return;
    }
    if (e.isPrimary === false && activePointerIdRef.current === null) {
      return;
    }

    activePointerIdRef.current = e.pointerId;
    isDrawingRef.current = true;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Defensive fallback for environments where pointer capture might fail
    }

    const coords = getCoordinates(e);
    const pressure = typeof e.pressure === 'number' && e.pressure > 0 ? e.pressure : 0.5;

    const newStroke: SignatureStroke = {
      points: [{ x: coords.x, y: coords.y, time: e.timeStamp || Date.now(), pressure }],
      color: strokeColor,
      lineWidth: strokeWidth,
    };

    currentStrokeRef.current = newStroke;
    redrawCanvas(strokesRef.current, newStroke);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || activePointerIdRef.current !== e.pointerId || !currentStrokeRef.current) {
      return;
    }

    const coords = getCoordinates(e);
    const pressure = typeof e.pressure === 'number' && e.pressure > 0 ? e.pressure : 0.5;

    currentStrokeRef.current.points.push({
      x: coords.x,
      y: coords.y,
      time: e.timeStamp || Date.now(),
      pressure,
    });

    redrawCanvas(strokesRef.current, currentStrokeRef.current);
  };

  const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== e.pointerId) {
      return;
    }

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Defensive fallback
    }

    if (isDrawingRef.current && currentStrokeRef.current) {
      if (currentStrokeRef.current.points.length > 0) {
        const nextStrokes = [...strokesRef.current, currentStrokeRef.current];
        strokesRef.current = nextStrokes;
        redoStackRef.current = [];
        setStrokes(nextStrokes);
        setRedoStack([]); // Invalidate redo stack upon new stroke
        onStrokeChange?.(true);
      }
      currentStrokeRef.current = null;
    }

    isDrawingRef.current = false;
    activePointerIdRef.current = null;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    endStroke(e);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== e.pointerId) {
      return;
    }

    currentStrokeRef.current = null;
    isDrawingRef.current = false;
    activePointerIdRef.current = null;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Defensive
    }

    redrawCanvas(strokesRef.current);
  };

  // Trimming implementation
  const getTrimmedDataUrl = useCallback((
    padding = 8,
    alphaThreshold = 0
  ): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    // Validate strokes semantically
    const validation = validateSignatureStrokes(strokes, canvas.width, canvas.height);
    if (!validation.isValid) {
      return null;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { width: w, height: h, data } = imgData;

    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const alpha = data[(y * w + x) * 4 + 3];
        if (alpha > alphaThreshold) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX === -1 || maxY === -1) {
      return null;
    }

    const dpr = dprRef.current || 1;
    const padPx = Math.round(padding * dpr);

    const cropX = Math.max(0, minX - padPx);
    const cropY = Math.max(0, minY - padPx);
    const cropWidth = Math.min(canvas.width - cropX, (maxX - minX + 1) + padPx * 2);
    const cropHeight = Math.min(canvas.height - cropY, (maxY - minY + 1) + padPx * 2);

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropWidth;
    cropCanvas.height = cropHeight;
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) return null;

    cropCtx.drawImage(
      canvas,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    return cropCanvas.toDataURL('image/png');
  }, [strokes]);

  useImperativeHandle(ref, () => ({
    undo: () => {
      if (strokesRef.current.length === 0) return false;
      const last = strokesRef.current[strokesRef.current.length - 1];
      const remaining = strokesRef.current.slice(0, -1);
      strokesRef.current = remaining;
      redoStackRef.current = [...redoStackRef.current, last];
      setStrokes(remaining);
      setRedoStack(redoStackRef.current);
      redrawCanvas(remaining);
      onStrokeChange?.(remaining.length > 0);
      return true;
    },
    redo: () => {
      if (redoStackRef.current.length === 0) return false;
      const lastRedo = redoStackRef.current[redoStackRef.current.length - 1];
      const remainingRedo = redoStackRef.current.slice(0, -1);
      const updated = [...strokesRef.current, lastRedo];
      strokesRef.current = updated;
      redoStackRef.current = remainingRedo;
      setStrokes(updated);
      setRedoStack(remainingRedo);
      redrawCanvas(updated);
      onStrokeChange?.(true);
      return true;
    },
    clear: () => {
      strokesRef.current = [];
      redoStackRef.current = [];
      setStrokes([]);
      setRedoStack([]);
      currentStrokeRef.current = null;
      redrawCanvas([]);
      onStrokeChange?.(false);
    },
    getTrimmedDataUrl,
    isEmpty: () => {
      return !validateSignatureStrokes(strokesRef.current, width, height).isValid;
    },
    canUndo: () => strokesRef.current.length > 0,
    canRedo: () => redoStackRef.current.length > 0,
    getStrokes: () => strokesRef.current,
  }), [redrawCanvas, onStrokeChange, getTrimmedDataUrl, width, height]);

  return (
    <div className={`relative inline-block select-none ${className}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        style={{ touchAction: 'none' }}
        className="block bg-transparent cursor-crosshair rounded-lg"
      />
    </div>
  );
});

SignaturePad.displayName = 'SignaturePad';
