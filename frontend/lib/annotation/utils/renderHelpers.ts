/**
 * Canvas Rendering Helper Functions
 *
 * Pure functions for drawing common UI elements on canvas.
 * These functions have no side effects and don't depend on React state.
 *
 * @module renderHelpers
 */

/**
 * Draw a grid on the canvas
 *
 * @param ctx - Canvas rendering context
 * @param width - Canvas width
 * @param height - Canvas height
 * @param imgX - Image X offset
 * @param imgY - Image Y offset
 * @param imgWidth - Scaled image width
 * @param imgHeight - Scaled image height
 * @param zoom - Current zoom level
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  imgX: number,
  imgY: number,
  imgWidth: number,
  imgHeight: number,
  zoom: number
): void {
  ctx.strokeStyle = 'rgba(75, 85, 99, 0.3)'; // gray-600
  ctx.lineWidth = 1;

  const gridSize = 20 * zoom;

  // Vertical lines
  for (let x = imgX; x < imgX + imgWidth; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, imgY);
    ctx.lineTo(x, imgY + imgHeight);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = imgY; y < imgY + imgHeight; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(imgX, y);
    ctx.lineTo(imgX + imgWidth, y);
    ctx.stroke();
  }
}

/**
 * Draw a crosshair cursor on the canvas
 *
 * @param ctx - Canvas rendering context
 * @param x - Cursor X position
 * @param y - Cursor Y position
 * @param width - Canvas width
 * @param height - Canvas height
 * @param color - Crosshair color (default: violet-600 with opacity)
 */
export function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string = 'rgba(147, 51, 234, 0.3)'
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;

  // Vertical line
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();

  // Horizontal line
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
}

/**
 * Draw a "No Object" badge on the canvas
 *
 * Used when an image is annotated as having no objects to detect.
 *
 * @param ctx - Canvas rendering context
 * @param offsetX - X offset for badge position
 * @param offsetY - Y offset for badge position
 * @param labelText - Badge text (default: "No Object")
 */
export function drawNoObjectBadge(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  labelText: string = 'No Object'
): void {
  const badgeX = offsetX + 10;
  const badgeY = offsetY + 10;
  const padding = 8;
  const fontSize = 14;

  // Measure text
  ctx.font = `${fontSize}px sans-serif`;
  const textWidth = ctx.measureText(labelText).width;

  // Draw badge background (gray color for no object)
  ctx.fillStyle = 'rgba(107, 114, 128, 0.8)'; // gray-500

  const badgeWidth = textWidth + padding * 2;
  const badgeHeight = fontSize + padding * 2;

  // Rounded rectangle
  const radius = 4;
  ctx.beginPath();
  ctx.moveTo(badgeX + radius, badgeY);
  ctx.lineTo(badgeX + badgeWidth - radius, badgeY);
  ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY, badgeX + badgeWidth, badgeY + radius);
  ctx.lineTo(badgeX + badgeWidth, badgeY + badgeHeight - radius);
  ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY + badgeHeight, badgeX + badgeWidth - radius, badgeY + badgeHeight);
  ctx.lineTo(badgeX + radius, badgeY + badgeHeight);
  ctx.quadraticCurveTo(badgeX, badgeY + badgeHeight, badgeX, badgeY + badgeHeight - radius);
  ctx.lineTo(badgeX, badgeY + radius);
  ctx.quadraticCurveTo(badgeX, badgeY, badgeX + radius, badgeY);
  ctx.closePath();
  ctx.fill();

  // Draw text
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(labelText, badgeX + padding, badgeY + badgeHeight / 2);
}

/**
 * Draw a vertex handle for polygon/polyline editing
 *
 * @param ctx - Canvas rendering context
 * @param x - Handle X position
 * @param y - Handle Y position
 * @param size - Handle size (radius)
 * @param selected - Whether the handle is selected
 * @param color - Handle color
 */
export function drawVertexHandle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number = 6,
  selected: boolean = false,
  color: string = '#9333ea'
): void {
  ctx.fillStyle = selected ? '#ffffff' : color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/**
 * Draw a bbox resize handle
 *
 * @param ctx - Canvas rendering context
 * @param x - Handle X position
 * @param y - Handle Y position
 * @param size - Handle size (width/height)
 * @param handleType - Handle position (nw, ne, sw, se, n, s, w, e)
 * @param color - Handle color
 */
export function drawBboxHandle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number = 8,
  handleType: string,
  color: string = '#9333ea'
): void {
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  // Corner handles are squares, edge handles are rectangles
  if (['nw', 'ne', 'sw', 'se'].includes(handleType)) {
    // Corner handles
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    ctx.strokeRect(x - size / 2, y - size / 2, size, size);
  } else {
    // Edge handles (n, s, w, e)
    const isVertical = ['n', 's'].includes(handleType);
    const width = isVertical ? size * 1.5 : size;
    const height = isVertical ? size : size * 1.5;

    ctx.fillRect(x - width / 2, y - height / 2, width, height);
    ctx.strokeRect(x - width / 2, y - height / 2, width, height);
  }
}

/**
 * Draw a circle handle for circle editing
 *
 * @param ctx - Canvas rendering context
 * @param x - Handle X position
 * @param y - Handle Y position
 * @param size - Handle size (radius)
 * @param handleType - Handle type (center, edge, point1, point2, point3)
 * @param color - Handle color
 */
export function drawCircleHandle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number = 6,
  handleType: string,
  color: string = '#9333ea'
): void {
  if (handleType === 'center') {
    // Center handle - crosshair
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    const len = size + 4;
    ctx.beginPath();
    ctx.moveTo(x - len, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y - len);
    ctx.lineTo(x, y + len);
    ctx.stroke();
  } else {
    // Edge/point handles - filled circle
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

/**
 * Set up default canvas context properties
 *
 * @param ctx - Canvas rendering context
 * @param zoom - Current zoom level (affects line widths)
 */
export function setupCanvasContext(
  ctx: CanvasRenderingContext2D,
  zoom: number = 1
): void {
  // Enable image smoothing for better quality
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Set default line properties
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Adjust line width based on zoom (inverse scaling)
  ctx.lineWidth = Math.max(1, 2 / zoom);
}

/**
 * Draw a text label button on an annotation (Phase 19)
 *
 * Renders a "T" button at the bottom-left corner of an annotation's bounding box.
 * Button appearance changes based on whether the annotation has a text label.
 *
 * @param ctx - Canvas rendering context
 * @param x - Bounding box X position (top-left)
 * @param y - Bounding box Y position (top-left)
 * @param width - Bounding box width
 * @param height - Bounding box height
 * @param hasTextLabel - Whether the annotation has a text label
 * @param zoom - Current zoom level
 * @returns Button bounding box { x, y, width, height } for click detection
 */
export function drawTextLabelButton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  hasTextLabel: boolean,
  zoom: number = 1
): { x: number; y: number; width: number; height: number } {
  const buttonSize = 24; // px
  const buttonX = x;
  const buttonY = y + height - buttonSize;

  // Button background
  if (hasTextLabel) {
    // Filled background when text label exists (highlighted)
    ctx.fillStyle = 'rgba(139, 92, 246, 0.9)'; // violet-500
  } else {
    // Semi-transparent background when no text label
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  }

  // Draw rounded rectangle background
  const radius = 4;
  ctx.beginPath();
  ctx.moveTo(buttonX + radius, buttonY);
  ctx.lineTo(buttonX + buttonSize - radius, buttonY);
  ctx.quadraticCurveTo(buttonX + buttonSize, buttonY, buttonX + buttonSize, buttonY + radius);
  ctx.lineTo(buttonX + buttonSize, buttonY + buttonSize - radius);
  ctx.quadraticCurveTo(buttonX + buttonSize, buttonY + buttonSize, buttonX + buttonSize - radius, buttonY + buttonSize);
  ctx.lineTo(buttonX + radius, buttonY + buttonSize);
  ctx.quadraticCurveTo(buttonX, buttonY + buttonSize, buttonX, buttonY + buttonSize - radius);
  ctx.lineTo(buttonX, buttonY + radius);
  ctx.quadraticCurveTo(buttonX, buttonY, buttonX + radius, buttonY);
  ctx.closePath();
  ctx.fill();

  // Draw "T" icon
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('T', buttonX + buttonSize / 2, buttonY + buttonSize / 2);

  // Return button bounds for click detection
  return {
    x: buttonX,
    y: buttonY,
    width: buttonSize,
    height: buttonSize,
  };
}
