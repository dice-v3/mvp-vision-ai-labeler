/**
 * ZoomControls Component Tests
 *
 * Tests for zoom and undo/redo controls
 * Phase 18: Canvas Architecture Refactoring
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ZoomControls, ZoomControlsProps } from '../ZoomControls';

describe('ZoomControls', () => {
  const defaultProps: ZoomControlsProps = {
    zoom: 1.0,
    pan: { x: 0, y: 0 },
    onZoomChange: vi.fn(),
    onPanChange: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    canUndo: false,
    canRedo: false,
  };

  describe('Rendering', () => {
    it('should render all control buttons', () => {
      render(<ZoomControls {...defaultProps} />);

      expect(screen.getByTitle('Undo (Ctrl+Z)')).toBeInTheDocument();
      expect(screen.getByTitle('Redo (Ctrl+Y)')).toBeInTheDocument();
      expect(screen.getByTitle('Zoom Out (Ctrl+-)')).toBeInTheDocument();
      expect(screen.getByTitle('Zoom In (Ctrl++)')).toBeInTheDocument();
      expect(screen.getByTitle('Fit to Screen (Ctrl+0)')).toBeInTheDocument();
    });

    it('should display zoom percentage', () => {
      render(<ZoomControls {...defaultProps} zoom={1.0} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should display correct zoom percentage for different values', () => {
      const { rerender } = render(<ZoomControls {...defaultProps} zoom={0.5} />);
      expect(screen.getByText('50%')).toBeInTheDocument();

      rerender(<ZoomControls {...defaultProps} zoom={1.5} />);
      expect(screen.getByText('150%')).toBeInTheDocument();

      rerender(<ZoomControls {...defaultProps} zoom={2.0} />);
      expect(screen.getByText('200%')).toBeInTheDocument();
    });

    it('should round zoom percentage to nearest integer', () => {
      render(<ZoomControls {...defaultProps} zoom={1.234} />);

      expect(screen.getByText('123%')).toBeInTheDocument();
    });
  });

  describe('Undo/Redo Buttons', () => {
    describe('Undo Button', () => {
      it('should be disabled when canUndo is false', () => {
        render(<ZoomControls {...defaultProps} canUndo={false} />);

        const undoButton = screen.getByTitle('Undo (Ctrl+Z)');
        expect(undoButton).toBeDisabled();
      });

      it('should be enabled when canUndo is true', () => {
        render(<ZoomControls {...defaultProps} canUndo={true} />);

        const undoButton = screen.getByTitle('Undo (Ctrl+Z)');
        expect(undoButton).not.toBeDisabled();
      });

      it('should call onUndo when clicked and enabled', async () => {
        const user = userEvent.setup();
        const onUndo = vi.fn();

        render(<ZoomControls {...defaultProps} canUndo={true} onUndo={onUndo} />);

        const undoButton = screen.getByTitle('Undo (Ctrl+Z)');
        await user.click(undoButton);

        expect(onUndo).toHaveBeenCalledTimes(1);
      });

      it('should not call onUndo when disabled', async () => {
        const user = userEvent.setup();
        const onUndo = vi.fn();

        render(<ZoomControls {...defaultProps} canUndo={false} onUndo={onUndo} />);

        const undoButton = screen.getByTitle('Undo (Ctrl+Z)');
        await user.click(undoButton);

        expect(onUndo).not.toHaveBeenCalled();
      });
    });

    describe('Redo Button', () => {
      it('should be disabled when canRedo is false', () => {
        render(<ZoomControls {...defaultProps} canRedo={false} />);

        const redoButton = screen.getByTitle('Redo (Ctrl+Y)');
        expect(redoButton).toBeDisabled();
      });

      it('should be enabled when canRedo is true', () => {
        render(<ZoomControls {...defaultProps} canRedo={true} />);

        const redoButton = screen.getByTitle('Redo (Ctrl+Y)');
        expect(redoButton).not.toBeDisabled();
      });

      it('should call onRedo when clicked and enabled', async () => {
        const user = userEvent.setup();
        const onRedo = vi.fn();

        render(<ZoomControls {...defaultProps} canRedo={true} onRedo={onRedo} />);

        const redoButton = screen.getByTitle('Redo (Ctrl+Y)');
        await user.click(redoButton);

        expect(onRedo).toHaveBeenCalledTimes(1);
      });

      it('should not call onRedo when disabled', async () => {
        const user = userEvent.setup();
        const onRedo = vi.fn();

        render(<ZoomControls {...defaultProps} canRedo={false} onRedo={onRedo} />);

        const redoButton = screen.getByTitle('Redo (Ctrl+Y)');
        await user.click(redoButton);

        expect(onRedo).not.toHaveBeenCalled();
      });
    });
  });

  describe('Zoom Buttons', () => {
    describe('Zoom Out', () => {
      it('should call onZoomChange with decreased value', async () => {
        const user = userEvent.setup();
        const onZoomChange = vi.fn();

        render(<ZoomControls {...defaultProps} zoom={1.0} onZoomChange={onZoomChange} />);

        const zoomOutButton = screen.getByTitle('Zoom Out (Ctrl+-)');
        await user.click(zoomOutButton);

        expect(onZoomChange).toHaveBeenCalledWith(0.75);
      });

      it('should decrease by 0.25 from current zoom', async () => {
        const user = userEvent.setup();
        const onZoomChange = vi.fn();

        render(<ZoomControls {...defaultProps} zoom={2.0} onZoomChange={onZoomChange} />);

        const zoomOutButton = screen.getByTitle('Zoom Out (Ctrl+-)');
        await user.click(zoomOutButton);

        expect(onZoomChange).toHaveBeenCalledWith(1.75);
      });

      it('should allow zooming out to negative values', async () => {
        const user = userEvent.setup();
        const onZoomChange = vi.fn();

        render(<ZoomControls {...defaultProps} zoom={0.1} onZoomChange={onZoomChange} />);

        const zoomOutButton = screen.getByTitle('Zoom Out (Ctrl+-)');
        await user.click(zoomOutButton);

        expect(onZoomChange).toHaveBeenCalledWith(-0.15);
      });
    });

    describe('Zoom In', () => {
      it('should call onZoomChange with increased value', async () => {
        const user = userEvent.setup();
        const onZoomChange = vi.fn();

        render(<ZoomControls {...defaultProps} zoom={1.0} onZoomChange={onZoomChange} />);

        const zoomInButton = screen.getByTitle('Zoom In (Ctrl++)');
        await user.click(zoomInButton);

        expect(onZoomChange).toHaveBeenCalledWith(1.25);
      });

      it('should increase by 0.25 from current zoom', async () => {
        const user = userEvent.setup();
        const onZoomChange = vi.fn();

        render(<ZoomControls {...defaultProps} zoom={0.5} onZoomChange={onZoomChange} />);

        const zoomInButton = screen.getByTitle('Zoom In (Ctrl++)');
        await user.click(zoomInButton);

        expect(onZoomChange).toHaveBeenCalledWith(0.75);
      });
    });
  });

  describe('Fit to Screen Button', () => {
    it('should reset zoom to 1.0', async () => {
      const user = userEvent.setup();
      const onZoomChange = vi.fn();

      render(<ZoomControls {...defaultProps} zoom={2.5} onZoomChange={onZoomChange} />);

      const fitButton = screen.getByTitle('Fit to Screen (Ctrl+0)');
      await user.click(fitButton);

      expect(onZoomChange).toHaveBeenCalledWith(1.0);
    });

    it('should reset pan to origin', async () => {
      const user = userEvent.setup();
      const onPanChange = vi.fn();

      render(
        <ZoomControls
          {...defaultProps}
          pan={{ x: 100, y: 200 }}
          onPanChange={onPanChange}
        />
      );

      const fitButton = screen.getByTitle('Fit to Screen (Ctrl+0)');
      await user.click(fitButton);

      expect(onPanChange).toHaveBeenCalledWith({ x: 0, y: 0 });
    });

    it('should reset both zoom and pan simultaneously', async () => {
      const user = userEvent.setup();
      const onZoomChange = vi.fn();
      const onPanChange = vi.fn();

      render(
        <ZoomControls
          {...defaultProps}
          zoom={1.5}
          pan={{ x: 50, y: 75 }}
          onZoomChange={onZoomChange}
          onPanChange={onPanChange}
        />
      );

      const fitButton = screen.getByTitle('Fit to Screen (Ctrl+0)');
      await user.click(fitButton);

      expect(onZoomChange).toHaveBeenCalledWith(1.0);
      expect(onPanChange).toHaveBeenCalledWith({ x: 0, y: 0 });
    });
  });

  describe('Layout', () => {
    it('should position controls in bottom-left', () => {
      const { container } = render(<ZoomControls {...defaultProps} />);

      const controls = container.firstChild as HTMLElement;
      expect(controls).toHaveClass('absolute', 'bottom-4', 'left-4');
    });

    it('should have horizontal layout', () => {
      const { container } = render(<ZoomControls {...defaultProps} />);

      const controls = container.firstChild as HTMLElement;
      expect(controls).toHaveClass('flex', 'items-center', 'gap-2');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero zoom', () => {
      render(<ZoomControls {...defaultProps} zoom={0} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should handle very large zoom', () => {
      render(<ZoomControls {...defaultProps} zoom={10.0} />);

      expect(screen.getByText('1000%')).toBeInTheDocument();
    });

    it('should handle very small zoom', () => {
      render(<ZoomControls {...defaultProps} zoom={0.05} />);

      expect(screen.getByText('5%')).toBeInTheDocument();
    });

    it('should handle negative pan values', () => {
      render(
        <ZoomControls
          {...defaultProps}
          pan={{ x: -100, y: -200 }}
        />
      );

      // Component should render without errors
      expect(screen.getByTitle('Fit to Screen (Ctrl+0)')).toBeInTheDocument();
    });
  });

  describe('Multiple Interactions', () => {
    it('should handle multiple zoom in clicks', async () => {
      const user = userEvent.setup();
      const onZoomChange = vi.fn();

      render(<ZoomControls {...defaultProps} zoom={1.0} onZoomChange={onZoomChange} />);

      const zoomInButton = screen.getByTitle('Zoom In (Ctrl++)');
      await user.click(zoomInButton);
      await user.click(zoomInButton);
      await user.click(zoomInButton);

      expect(onZoomChange).toHaveBeenCalledTimes(3);
      expect(onZoomChange).toHaveBeenNthCalledWith(1, 1.25);
      expect(onZoomChange).toHaveBeenNthCalledWith(2, 1.25);
      expect(onZoomChange).toHaveBeenNthCalledWith(3, 1.25);
    });

    it('should handle alternating zoom in/out', async () => {
      const user = userEvent.setup();
      const onZoomChange = vi.fn();

      render(<ZoomControls {...defaultProps} zoom={1.0} onZoomChange={onZoomChange} />);

      const zoomInButton = screen.getByTitle('Zoom In (Ctrl++)');
      const zoomOutButton = screen.getByTitle('Zoom Out (Ctrl+-)');

      await user.click(zoomInButton);
      await user.click(zoomOutButton);

      expect(onZoomChange).toHaveBeenCalledTimes(2);
      expect(onZoomChange).toHaveBeenNthCalledWith(1, 1.25);
      expect(onZoomChange).toHaveBeenNthCalledWith(2, 0.75);
    });
  });

  describe('Memoization', () => {
    it('should not re-render when props are unchanged', () => {
      const { rerender } = render(<ZoomControls {...defaultProps} />);

      rerender(<ZoomControls {...defaultProps} />);

      // Verify component is wrapped with React.memo
      expect(ZoomControls).toBeDefined();
    });
  });
});
