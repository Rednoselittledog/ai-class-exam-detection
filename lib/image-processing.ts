/**
 * Image Processing Utilities
 * Ported from OMRChecker's CropPage.py
 */

// Constants
const MAX_COSINE_THRESHOLD = 0.3;
const MIN_PAGE_AREA_THRESHOLD = 0.3;
const APPROX_POLY_EPSILON_FACTOR = 0.02;

interface Point {
  x: number;
  y: number;
}

interface Contour {
  points: Point[];
  area: number;
}

/**
 * Calculate angle between three points (cosine)
 */
function calculateAngle(p1: Point, p2: Point, p0: Point): number {
  const dx1 = p1.x - p0.x;
  const dy1 = p1.y - p0.y;
  const dx2 = p2.x - p0.x;
  const dy2 = p2.y - p0.y;

  return (
    (dx1 * dx2 + dy1 * dy2) /
    Math.sqrt((dx1 * dx1 + dy1 * dy1) * (dx2 * dx2 + dy2 * dy2) + 1e-10)
  );
}

/**
 * Check if quadrilateral is a valid rectangle
 */
function isValidRectangle(approx: Point[]): boolean {
  if (approx.length !== 4) return false;

  let maxCosine = 0;
  for (let i = 2; i < 5; i++) {
    const cosine = Math.abs(
      calculateAngle(approx[i % 4], approx[i - 2], approx[i - 1])
    );
    maxCosine = Math.max(cosine, maxCosine);
  }

  return maxCosine < MAX_COSINE_THRESHOLD;
}

/**
 * Order points in clockwise order: top-left, top-right, bottom-right, bottom-left
 */
function orderPoints(pts: Point[]): Point[] {
  // Sort by y-coordinate
  const sorted = [...pts].sort((a, b) => a.y - b.y);

  // Get top two and bottom two points
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sorted.slice(2, 4).sort((a, b) => a.x - b.x);

  return [top[0], top[1], bottom[1], bottom[0]];
}

/**
 * Calculate distance between two points
 */
function distance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Exported function to detect and crop page from image
 * This would be called from the backend API
 */
export interface CropPageResult {
  success: boolean;
  corners?: Point[];
  error?: string;
}

/**
 * Backend helper: Process image to find page corners
 * Note: This is a TypeScript placeholder. Actual implementation
 * would need to use a backend service with OpenCV (Python/Node native bindings)
 */
export function detectPageCorners(
  imageData: string | Buffer
): CropPageResult {
  // This function would call a backend service that uses OpenCV
  // For now, return a placeholder
  return {
    success: false,
    error: "This function requires backend OpenCV implementation",
  };
}

/**
 * Calculate the dimensions for the warped (cropped) image
 */
export function calculateWarpedDimensions(corners: Point[]): {
  width: number;
  height: number;
} {
  const ordered = orderPoints(corners);

  // Calculate width
  const widthTop = distance(ordered[0], ordered[1]);
  const widthBottom = distance(ordered[2], ordered[3]);
  const maxWidth = Math.max(widthTop, widthBottom);

  // Calculate height
  const heightLeft = distance(ordered[0], ordered[3]);
  const heightRight = distance(ordered[1], ordered[2]);
  const maxHeight = Math.max(heightLeft, heightRight);

  return {
    width: Math.round(maxWidth),
    height: Math.round(maxHeight),
  };
}

/**
 * Export types and utilities
 */
export type { Point, Contour };
export { orderPoints, isValidRectangle };
