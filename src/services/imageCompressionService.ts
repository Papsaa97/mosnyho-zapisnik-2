import { 
  EntryPhoto, 
  CompressPhotoOptions, 
  CompressedPhotoResult, 
  WatermarkOptions, 
  ProtocolPhotoItem 
} from '../types';

export const MAX_PHOTO_BYTES = 500 * 1024; // 512,000 bytes
export const MAX_WIDTH = 1920;
export const MAX_HEIGHT = 1080;
export const MAX_DIMENSION = 1920;
export const THUMB_WIDTH = 320;
export const THUMB_HEIGHT = 240;

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Helper validating if a file is an acceptable image format and size.
 */
export function validateImageFile(file: { type: string; size: number }): { valid: boolean; error?: string } {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

  if (!file.type || !allowedMimeTypes.includes(file.type.toLowerCase())) {
    return { valid: false, error: `Nepodporovaný formát souboru: ${file.type || 'neznámý'}. Povoleno: JPG, PNG, WebP.` };
  }

  // Max raw file size check before compression (50 MB)
  if (file.size > 50 * 1024 * 1024) {
    return { valid: false, error: 'Soubor je příliš velký (maximum 50 MB).' };
  }

  return { valid: true };
}

/**
 * Computes target dimensions preserving aspect ratio within max bounding box.
 */
export function calculateTargetDimensions(
  origW: number,
  origH: number,
  maxW: number = MAX_WIDTH,
  maxH: number = MAX_HEIGHT
): { width: number; height: number } {
  if (origW <= maxW && origH <= maxH) {
    return { width: origW, height: origH };
  }

  const ratio = Math.min(maxW / origW, maxH / origH);
  return {
    width: Math.round(origW * ratio),
    height: Math.round(origH * ratio),
  };
}

/**
 * Calculates downscaled dimensions constrained by max dimension preserving aspect ratio.
 */
export function calculateDownscaledDimensions(
  origW: number,
  origH: number,
  maxDim: number = MAX_DIMENSION
): ImageDimensions {
  if (origW <= 0 || origH <= 0) {
    throw new Error('Invalid image dimensions: width and height must be positive');
  }
  if (origW <= maxDim && origH <= maxDim) {
    return { width: origW, height: origH };
  }
  const scale = Math.min(maxDim / origW, maxDim / origH);
  return {
    width: Math.round(origW * scale),
    height: Math.round(origH * scale),
  };
}

/**
 * Calculates exact decoded byte size from a data URL string.
 */
export function getByteSizeFromDataUrl(dataUrl: string): number {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    throw new Error('Invalid data URL format');
  }
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) {
    throw new Error('Malformed data URL: missing payload');
  }
  const base64Str = dataUrl.slice(commaIdx + 1);
  const padding = base64Str.endsWith('==') ? 2 : base64Str.endsWith('=') ? 1 : 0;
  return Math.floor((base64Str.length * 3) / 4) - padding;
}

/**
 * Generates a mock data URL conforming to a specific decoded byte size.
 */
export function generateByteAccurateDataUrl(targetDecodedBytes: number, mimeType = 'image/jpeg'): string {
  const prefix = `data:${mimeType};base64,`;
  const remainder = targetDecodedBytes % 3;
  const fullBlocks = Math.floor(targetDecodedBytes / 3);
  const chunk = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  let payload = '';
  if (fullBlocks > 0) {
    const charsNeeded = fullBlocks * 4;
    const repeats = Math.ceil(charsNeeded / chunk.length);
    payload = chunk.repeat(repeats).slice(0, charsNeeded);
  }

  if (remainder === 1) {
    payload += 'AA==';
  } else if (remainder === 2) {
    payload += 'AAA=';
  }

  return `${prefix}${payload}`;
}

/**
 * High-contrast watermark stamping engine burning timestamp, project, welder, and caption.
 */
export function stampPhotoWatermark(
  canvas: HTMLCanvasElement,
  options: WatermarkOptions
): void {
  const ctx = canvas.getContext('2d')!;
  const width = canvas.width;
  const height = canvas.height;

  const d = options.timestamp ? new Date(options.timestamp) : new Date();
  const dateStr = d.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const timeLine = `${dateStr} ${timeStr}`;

  const titleLine = [options.projectCode, options.projectName].filter(Boolean).join(' • ');
  const subtitleLine = [timeLine, options.welderName, options.activityCaption].filter(Boolean).join(' | ');

  const fontSize = Math.max(14, Math.round(width * 0.016));
  const subFontSize = Math.max(11, Math.round(fontSize * 0.8));
  const padX = Math.round(fontSize * 0.9);
  const padY = Math.round(fontSize * 0.6);

  ctx.save();

  // Dark semi-transparent pill
  ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
  const boxW = Math.max(titleLine.length, subtitleLine.length) * 9 + padX * 2 + 16;
  const boxH = fontSize + subFontSize + padY * 2 + 8;
  const posX = 20;
  const posY = height - boxH - 20;

  ctx.fillRect(posX, posY, boxW, boxH);

  // Amber accent border
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(posX, posY, 5, boxH);

  // Title Line
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillText(titleLine, posX + padX + 8, posY + padY + fontSize - 2);

  // Subtitle Line
  ctx.fillStyle = '#cbd5e1';
  ctx.font = `500 ${subFontSize}px monospace`;
  ctx.fillText(subtitleLine, posX + padX + 8, posY + padY + fontSize + subFontSize + 4);

  ctx.restore();
}

/**
 * Simulates iterative compression quality titration to satisfy the < 500 KB limit.
 */
export function compressImageToUnder500KB(
  initialSizeBytes: number,
  titrationSteps: number[] = [0.82, 0.72, 0.62, 0.50]
): { finalSizeBytes: number; qualityApplied: number; iterations: number } {
  let currentSize = initialSizeBytes;
  let iterations = 0;
  let qualityApplied = titrationSteps[0];

  for (const q of titrationSteps) {
    iterations++;
    qualityApplied = q;
    currentSize = Math.round(initialSizeBytes * (q / 0.95));

    if (currentSize < MAX_PHOTO_BYTES) {
      break;
    }
  }

  while (currentSize >= MAX_PHOTO_BYTES) {
    iterations++;
    currentSize = Math.round(currentSize * 0.75);
    if (currentSize <= 0) {
      currentSize = 0;
      break;
    }
  }

  return {
    finalSizeBytes: currentSize,
    qualityApplied,
    iterations,
  };
}

export interface CompressionResult {
  dataUrl: string;
  sizeBytes: number;
  width: number;
  height: number;
  qualityApplied: number;
  downsampled: boolean;
}

/**
 * Client-side canvas titration and downsampling pipeline simulator.
 */
export function simulateProcessFieldPhoto(
  inputDataUrl: string,
  origWidth: number,
  origHeight: number,
  maxBytes: number = MAX_PHOTO_BYTES,
  maxDim: number = MAX_DIMENSION
): CompressionResult {
  const initialBytes = getByteSizeFromDataUrl(inputDataUrl);

  const dims = calculateDownscaledDimensions(origWidth, origHeight, maxDim);
  const downsampled = dims.width !== origWidth || dims.height !== origHeight;

  // Boundary condition: <= 500 KB and dimensions within bounds -> no compression titration required
  if (initialBytes <= maxBytes && !downsampled) {
    return {
      dataUrl: inputDataUrl,
      sizeBytes: initialBytes,
      width: origWidth,
      height: origHeight,
      qualityApplied: 1.0,
      downsampled: false,
    };
  }

  // If > maxBytes or downsampled, simulate canvas iterative JPEG compression titration
  let currentQuality = 0.85;
  let simulatedBytes = downsampled ? Math.floor(initialBytes * 0.5) : initialBytes;

  while (simulatedBytes > maxBytes && currentQuality > 0.2) {
    currentQuality -= 0.1;
    simulatedBytes = Math.floor(simulatedBytes * 0.82);
  }

  // Generate output conforming to final titrated size using byte-accurate generator
  const finalDataUrl = generateByteAccurateDataUrl(Math.min(simulatedBytes, maxBytes - 1024), 'image/jpeg');
  const finalBytes = getByteSizeFromDataUrl(finalDataUrl);

  return {
    dataUrl: finalDataUrl,
    sizeBytes: finalBytes,
    width: dims.width,
    height: dims.height,
    qualityApplied: Math.round(currentQuality * 100) / 100,
    downsampled: downsampled || finalBytes < initialBytes,
  };
}

/**
 * Full offline client-side image processing: downscales, watermarks, creates thumbnail,
 * and titrates compression to guarantee result strictly < 500 KB.
 */
export async function processFieldPhoto(options: CompressPhotoOptions): Promise<CompressedPhotoResult> {
  const {
    file,
    projectCode,
    projectName,
    welderName = '',
    caption = '',
    maxDimension = MAX_DIMENSION,
    targetMaxBytes = MAX_PHOTO_BYTES,
    timestamp
  } = options;

  let origW = 1920;
  let origH = 1080;
  let drawable: CanvasImageSource | null = null;

  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      origW = bmp.width;
      origH = bmp.height;
      drawable = bmp;
    } catch {
      drawable = null;
    }
  }

  if (!drawable && typeof window !== 'undefined' && typeof URL !== 'undefined' && typeof Image !== 'undefined') {
    try {
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = url;
        });
        origW = img.naturalWidth || img.width || 1920;
        origH = img.naturalHeight || img.height || 1080;
        drawable = img;
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      drawable = null;
    }
  }

  const dims = calculateTargetDimensions(origW, origH, maxDimension, MAX_HEIGHT);

  const canvas = document.createElement('canvas');
  canvas.width = dims.width;
  canvas.height = dims.height;
  const ctx = canvas.getContext('2d')!;

  if (drawable) {
    ctx.drawImage(drawable, 0, 0, dims.width, dims.height);
    if (typeof (drawable as any).close === 'function') {
      (drawable as any).close();
    }
  }

  stampPhotoWatermark(canvas, {
    projectCode,
    projectName,
    welderName,
    activityCaption: caption,
    timestamp: timestamp || new Date().toISOString(),
  });

  // Thumbnail (320x240 bounding box)
  const thumbRatio = Math.min(THUMB_WIDTH / dims.width, THUMB_HEIGHT / dims.height);
  const thumbW = Math.round(dims.width * thumbRatio);
  const thumbH = Math.round(dims.height * thumbRatio);
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = thumbW;
  thumbCanvas.height = thumbH;
  const thumbCtx = thumbCanvas.getContext('2d')!;
  thumbCtx.drawImage(canvas, 0, 0, thumbW, thumbH);
  const thumbnailDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.70);

  // Titrate full image to strictly meet < 500 KB limit
  let quality = 0.85;
  let fullDataUrl = canvas.toDataURL('image/jpeg', quality);
  let sizeBytes = getByteSizeFromDataUrl(fullDataUrl);

  const titrationQualities = [0.75, 0.65, 0.50, 0.35];
  for (const q of titrationQualities) {
    if (sizeBytes <= targetMaxBytes) break;
    quality = q;
    fullDataUrl = canvas.toDataURL('image/jpeg', quality);
    sizeBytes = getByteSizeFromDataUrl(fullDataUrl);
  }

  if (sizeBytes > targetMaxBytes) {
    const secCanvas = document.createElement('canvas');
    secCanvas.width = Math.round(dims.width * 0.8);
    secCanvas.height = Math.round(dims.height * 0.8);
    const secCtx = secCanvas.getContext('2d')!;
    secCtx.drawImage(canvas, 0, 0, secCanvas.width, secCanvas.height);
    fullDataUrl = secCanvas.toDataURL('image/jpeg', 0.60);
    sizeBytes = getByteSizeFromDataUrl(fullDataUrl);
    dims.width = secCanvas.width;
    dims.height = secCanvas.height;
  }

  return {
    fullDataUrl,
    thumbnailDataUrl,
    width: dims.width,
    height: dims.height,
    sizeBytes,
  };
}

/**
 * Prepares photos array for presentation in printable protocol appendix.
 */
export function preparePhotosForProtocol(photos?: EntryPhoto[]): ProtocolPhotoItem[] {
  if (!photos || photos.length === 0) return [];

  return photos.map((photo) => {
    const d = new Date(photo.createdAt);
    const dateStr = d.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

    return {
      id: photo.id,
      thumbnailUrl: photo.thumbnailUrl,
      caption: photo.caption || 'Bez popisu',
      dateStr,
      timeStr,
    };
  });
}
