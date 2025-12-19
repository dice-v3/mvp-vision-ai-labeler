import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock HTMLCanvasElement for canvas-based tests
class MockCanvasRenderingContext2D {
  canvas = document.createElement('canvas');
  fillStyle = '';
  strokeStyle = '';
  lineWidth = 1;
  font = '';
  textAlign = 'start';
  textBaseline = 'alphabetic';
  globalAlpha = 1;
  globalCompositeOperation = 'source-over';

  // Drawing methods
  fillRect = vi.fn();
  strokeRect = vi.fn();
  clearRect = vi.fn();
  fill = vi.fn();
  stroke = vi.fn();
  beginPath = vi.fn();
  closePath = vi.fn();
  moveTo = vi.fn();
  lineTo = vi.fn();
  arc = vi.fn();
  arcTo = vi.fn();
  quadraticCurveTo = vi.fn();
  bezierCurveTo = vi.fn();
  rect = vi.fn();

  // Text methods
  fillText = vi.fn();
  strokeText = vi.fn();
  measureText = vi.fn(() => ({ width: 0 }));

  // Transform methods
  save = vi.fn();
  restore = vi.fn();
  scale = vi.fn();
  rotate = vi.fn();
  translate = vi.fn();
  transform = vi.fn();
  setTransform = vi.fn();
  resetTransform = vi.fn();

  // Image methods
  drawImage = vi.fn();
  createImageData = vi.fn();
  getImageData = vi.fn();
  putImageData = vi.fn();

  // Path methods
  clip = vi.fn();
  isPointInPath = vi.fn(() => false);
  isPointInStroke = vi.fn(() => false);

  // Gradient and pattern methods
  createLinearGradient = vi.fn();
  createRadialGradient = vi.fn();
  createPattern = vi.fn();
}

// Mock canvas context
HTMLCanvasElement.prototype.getContext = vi.fn((contextType: string) => {
  if (contextType === '2d') {
    return new MockCanvasRenderingContext2D() as any;
  }
  return null;
});

// Mock getBoundingClientRect
HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
  width: 800,
  height: 600,
  top: 0,
  left: 0,
  bottom: 600,
  right: 800,
  x: 0,
  y: 0,
  toJSON: () => {},
}));

// Mock HTMLImageElement
class MockImage extends Image {
  constructor() {
    super();
    setTimeout(() => {
      this.onload?.(new Event('load'));
    }, 0);
  }
}

global.Image = MockImage as any;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
