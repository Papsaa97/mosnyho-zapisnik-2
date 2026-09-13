export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface CropResult {
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  dataUrl: string;
}

/**
 * Signature Bounding Box Trimming Engine
 * Scans non-transparent pixel alpha channels, determines tight bounding box,
 * applies padding, and crops margins per ORIGINAL_REQUEST §R1 & PROJECT.md #5.
 */
export class SignatureTrimmer {
  /**
   * Scans ImageData for bounding box containing non-transparent pixels.
   */
  public static calculateBoundingBox(
    imageData: ImageData,
    alphaThreshold: number = 0
  ): BoundingBox | null {
    const { width, height, data } = imageData;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alphaIndex = (y * width + x) * 4 + 3;
        const alpha = data[alphaIndex];

        if (alpha > alphaThreshold) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX === -1 || maxY === -1) {
      return null; // Empty canvas
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  /**
   * Crops transparent margins from canvas and returns trimmed PNG data URL.
   */
  public static trimCanvas(
    canvas: HTMLCanvasElement,
    padding: number = 4,
    alphaThreshold: number = 0
  ): CropResult | null {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const bbox = this.calculateBoundingBox(imageData, alphaThreshold);

    if (!bbox) {
      return null;
    }

    const cropX = Math.max(0, bbox.minX - padding);
    const cropY = Math.max(0, bbox.minY - padding);
    const cropWidth = Math.min(canvas.width - cropX, bbox.width + padding * 2);
    const cropHeight = Math.min(canvas.height - cropY, bbox.height + padding * 2);

    const trimmedCanvas = document.createElement('canvas');
    trimmedCanvas.width = cropWidth;
    trimmedCanvas.height = cropHeight;

    const trimmedCtx = trimmedCanvas.getContext('2d');
    if (trimmedCtx) {
      trimmedCtx.drawImage(
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
    }

    return {
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      dataUrl: trimmedCanvas.toDataURL('image/png'),
    };
  }
}
