/**
 * useMagnifier Hook Tests
 *
 * Tests for magnifier state and visibility logic
 * Phase 18: Canvas Architecture Refactoring
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMagnifier, type UseMagnifierParams } from '../useMagnifier';

describe('useMagnifier', () => {
  const defaultParams: UseMagnifierParams = {
    preferences: {
      autoMagnifier: false,
      magnificationLevel: 2,
    },
    currentTool: null,
  };

  describe('Initial State', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useMagnifier(defaultParams));

      expect(result.current.manualMagnifierActive).toBe(false);
      expect(result.current.magnifierForceOff).toBe(false);
      expect(result.current.magnification).toBe(2);
      expect(result.current.shouldShowMagnifier).toBe(false);
      expect(result.current.isDrawingTool).toBe(false);
    });

    it('should initialize with custom magnification level', () => {
      const { result } = renderHook(() =>
        useMagnifier({
          ...defaultParams,
          preferences: {
            autoMagnifier: false,
            magnificationLevel: 4,
          },
        })
      );

      expect(result.current.magnification).toBe(4);
    });
  });

  describe('Manual Magnifier Activation', () => {
    it('should activate manual magnifier', () => {
      const { result } = renderHook(() => useMagnifier(defaultParams));

      act(() => {
        result.current.setManualMagnifierActive(true);
      });

      expect(result.current.manualMagnifierActive).toBe(true);
      expect(result.current.shouldShowMagnifier).toBe(true);
    });

    it('should deactivate manual magnifier', () => {
      const { result } = renderHook(() => useMagnifier(defaultParams));

      act(() => {
        result.current.setManualMagnifierActive(true);
      });
      expect(result.current.shouldShowMagnifier).toBe(true);

      act(() => {
        result.current.setManualMagnifierActive(false);
      });
      expect(result.current.shouldShowMagnifier).toBe(false);
    });

    it('should toggle manual magnifier', () => {
      const { result } = renderHook(() => useMagnifier(defaultParams));

      act(() => {
        result.current.setManualMagnifierActive((prev) => !prev);
      });
      expect(result.current.manualMagnifierActive).toBe(true);

      act(() => {
        result.current.setManualMagnifierActive((prev) => !prev);
      });
      expect(result.current.manualMagnifierActive).toBe(false);
    });
  });

  describe('Force Off State', () => {
    it('should force off magnifier', () => {
      const { result } = renderHook(() => useMagnifier(defaultParams));

      act(() => {
        result.current.setManualMagnifierActive(true);
      });
      expect(result.current.shouldShowMagnifier).toBe(true);

      act(() => {
        result.current.setMagnifierForceOff(true);
      });
      expect(result.current.shouldShowMagnifier).toBe(false);
    });

    it('should prevent auto magnifier when force off', () => {
      const { result } = renderHook(() =>
        useMagnifier({
          preferences: {
            autoMagnifier: true,
            magnificationLevel: 2,
          },
          currentTool: 'polygon',
        })
      );

      // Auto magnifier should work
      expect(result.current.shouldShowMagnifier).toBe(true);

      // Force off
      act(() => {
        result.current.setMagnifierForceOff(true);
      });
      expect(result.current.shouldShowMagnifier).toBe(false);
    });

    it('should allow re-enabling after force off', () => {
      const { result } = renderHook(() => useMagnifier(defaultParams));

      act(() => {
        result.current.setManualMagnifierActive(true);
        result.current.setMagnifierForceOff(true);
      });
      expect(result.current.shouldShowMagnifier).toBe(false);

      act(() => {
        result.current.setMagnifierForceOff(false);
      });
      expect(result.current.shouldShowMagnifier).toBe(true);
    });
  });

  describe('Magnification Level', () => {
    it('should update magnification level', () => {
      const { result } = renderHook(() => useMagnifier(defaultParams));

      act(() => {
        result.current.setMagnification(4);
      });

      expect(result.current.magnification).toBe(4);
    });

    it('should handle various magnification levels', () => {
      const { result } = renderHook(() => useMagnifier(defaultParams));

      const levels = [1, 2, 3, 4, 5, 6, 7, 8];

      levels.forEach((level) => {
        act(() => {
          result.current.setMagnification(level);
        });
        expect(result.current.magnification).toBe(level);
      });
    });

    it('should update when preferences change', () => {
      const { result, rerender } = renderHook(
        (props: UseMagnifierParams) => useMagnifier(props),
        { initialProps: defaultParams }
      );

      expect(result.current.magnification).toBe(2);

      // Change preferences
      rerender({
        ...defaultParams,
        preferences: {
          autoMagnifier: false,
          magnificationLevel: 5,
        },
      });

      expect(result.current.magnification).toBe(5);
    });
  });

  describe('Drawing Tool Detection', () => {
    it('should detect bbox as drawing tool', () => {
      const { result } = renderHook(() =>
        useMagnifier({
          ...defaultParams,
          currentTool: 'bbox',
        })
      );

      expect(result.current.isDrawingTool).toBe(true);
    });

    it('should detect polygon as drawing tool', () => {
      const { result } = renderHook(() =>
        useMagnifier({
          ...defaultParams,
          currentTool: 'polygon',
        })
      );

      expect(result.current.isDrawingTool).toBe(true);
    });

    it('should detect all drawing tools', () => {
      const drawingTools = ['detection', 'bbox', 'polygon', 'polyline', 'circle', 'circle3p'];

      drawingTools.forEach((tool) => {
        const { result } = renderHook(() =>
          useMagnifier({
            ...defaultParams,
            currentTool: tool,
          })
        );
        expect(result.current.isDrawingTool).toBe(true);
      });
    });

    it('should not detect select as drawing tool', () => {
      const { result } = renderHook(() =>
        useMagnifier({
          ...defaultParams,
          currentTool: 'select',
        })
      );

      expect(result.current.isDrawingTool).toBe(false);
    });

    it('should not detect classification as drawing tool', () => {
      const { result } = renderHook(() =>
        useMagnifier({
          ...defaultParams,
          currentTool: 'classification',
        })
      );

      expect(result.current.isDrawingTool).toBe(false);
    });

    it('should handle null tool', () => {
      const { result } = renderHook(() => useMagnifier(defaultParams));

      expect(result.current.isDrawingTool).toBe(false);
    });
  });

  describe('Auto Magnifier Mode', () => {
    it('should show magnifier for drawing tools when auto mode enabled', () => {
      const { result } = renderHook(() =>
        useMagnifier({
          preferences: {
            autoMagnifier: true,
            magnificationLevel: 2,
          },
          currentTool: 'polygon',
        })
      );

      expect(result.current.shouldShowMagnifier).toBe(true);
    });

    it('should not show magnifier for non-drawing tools in auto mode', () => {
      const { result } = renderHook(() =>
        useMagnifier({
          preferences: {
            autoMagnifier: true,
            magnificationLevel: 2,
          },
          currentTool: 'select',
        })
      );

      expect(result.current.shouldShowMagnifier).toBe(false);
    });

    it('should not show magnifier when auto mode disabled', () => {
      const { result } = renderHook(() =>
        useMagnifier({
          preferences: {
            autoMagnifier: false,
            magnificationLevel: 2,
          },
          currentTool: 'polygon',
        })
      );

      expect(result.current.shouldShowMagnifier).toBe(false);
    });

    it('should update when auto mode preference changes', () => {
      const { result, rerender } = renderHook(
        (props: UseMagnifierParams) => useMagnifier(props),
        {
          initialProps: {
            preferences: {
              autoMagnifier: false,
              magnificationLevel: 2,
            },
            currentTool: 'polygon',
          },
        }
      );

      expect(result.current.shouldShowMagnifier).toBe(false);

      // Enable auto mode
      rerender({
        preferences: {
          autoMagnifier: true,
          magnificationLevel: 2,
        },
        currentTool: 'polygon',
      });

      expect(result.current.shouldShowMagnifier).toBe(true);
    });
  });

  describe('Tool Change Behavior', () => {
    it('should reset manual activation on tool change', () => {
      const { result, rerender } = renderHook(
        (props: UseMagnifierParams) => useMagnifier(props),
        {
          initialProps: {
            ...defaultParams,
            currentTool: 'polygon',
          },
        }
      );

      act(() => {
        result.current.setManualMagnifierActive(true);
      });
      expect(result.current.manualMagnifierActive).toBe(true);

      // Change tool
      rerender({
        ...defaultParams,
        currentTool: 'bbox',
      });

      expect(result.current.manualMagnifierActive).toBe(false);
    });

    it('should reset force off on tool change', () => {
      const { result, rerender } = renderHook(
        (props: UseMagnifierParams) => useMagnifier(props),
        {
          initialProps: {
            ...defaultParams,
            currentTool: 'polygon',
          },
        }
      );

      act(() => {
        result.current.setMagnifierForceOff(true);
      });
      expect(result.current.magnifierForceOff).toBe(true);

      // Change tool
      rerender({
        ...defaultParams,
        currentTool: 'bbox',
      });

      expect(result.current.magnifierForceOff).toBe(false);
    });

    it('should not reset on same tool', () => {
      const { result, rerender } = renderHook(
        (props: UseMagnifierParams) => useMagnifier(props),
        {
          initialProps: {
            ...defaultParams,
            currentTool: 'polygon',
          },
        }
      );

      act(() => {
        result.current.setManualMagnifierActive(true);
      });

      // Re-render with same tool
      rerender({
        ...defaultParams,
        currentTool: 'polygon',
      });

      expect(result.current.manualMagnifierActive).toBe(true);
    });
  });

  describe('shouldShowMagnifier Logic', () => {
    it('should show when manually activated', () => {
      const { result } = renderHook(() => useMagnifier(defaultParams));

      act(() => {
        result.current.setManualMagnifierActive(true);
      });

      expect(result.current.shouldShowMagnifier).toBe(true);
    });

    it('should show when auto mode + drawing tool', () => {
      const { result } = renderHook(() =>
        useMagnifier({
          preferences: {
            autoMagnifier: true,
            magnificationLevel: 2,
          },
          currentTool: 'polygon',
        })
      );

      expect(result.current.shouldShowMagnifier).toBe(true);
    });

    it('should not show when force off is true', () => {
      const { result } = renderHook(() =>
        useMagnifier({
          preferences: {
            autoMagnifier: true,
            magnificationLevel: 2,
          },
          currentTool: 'polygon',
        })
      );

      act(() => {
        result.current.setMagnifierForceOff(true);
      });

      expect(result.current.shouldShowMagnifier).toBe(false);
    });

    it('should prioritize manual activation over auto mode', () => {
      const { result } = renderHook(() =>
        useMagnifier({
          preferences: {
            autoMagnifier: false,
            magnificationLevel: 2,
          },
          currentTool: 'select', // Not a drawing tool
        })
      );

      act(() => {
        result.current.setManualMagnifierActive(true);
      });

      expect(result.current.shouldShowMagnifier).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined tool', () => {
      const { result } = renderHook(() =>
        useMagnifier({
          ...defaultParams,
          currentTool: undefined as any,
        })
      );

      expect(result.current.isDrawingTool).toBe(false);
      expect(result.current.shouldShowMagnifier).toBe(false);
    });

    it('should handle extreme magnification levels', () => {
      const { result } = renderHook(() => useMagnifier(defaultParams));

      act(() => {
        result.current.setMagnification(100);
      });
      expect(result.current.magnification).toBe(100);

      act(() => {
        result.current.setMagnification(0.1);
      });
      expect(result.current.magnification).toBe(0.1);
    });
  });
});
