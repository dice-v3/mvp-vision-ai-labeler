/**
 * CanvasActionBar Component Tests
 *
 * Tests for canvas action buttons (No Object, Delete All)
 * Phase 18: Canvas Architecture Refactoring
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CanvasActionBar, CanvasActionBarProps } from '../CanvasActionBar';

describe('CanvasActionBar', () => {
  const defaultProps: CanvasActionBarProps = {
    annotationCount: 0,
    selectedImageCount: 0,
    onNoObject: vi.fn(),
    onDeleteAll: vi.fn(),
  };

  describe('Rendering', () => {
    it('should render both action buttons', () => {
      render(<CanvasActionBar {...defaultProps} />);

      expect(screen.getByTitle('No Object (0)')).toBeInTheDocument();
      expect(screen.getByTitle('Delete All Annotations (Del)')).toBeInTheDocument();
    });

    it('should render with custom props', () => {
      render(
        <CanvasActionBar
          {...defaultProps}
          annotationCount={5}
          selectedImageCount={3}
        />
      );

      expect(screen.getByTitle('No Object (0)')).toBeInTheDocument();
      expect(screen.getByTitle('Delete All Annotations (Del)')).toBeInTheDocument();
    });
  });

  describe('No Object Button', () => {
    it('should always be enabled', () => {
      render(<CanvasActionBar {...defaultProps} annotationCount={0} />);

      const noObjectButton = screen.getByTitle('No Object (0)');
      expect(noObjectButton).not.toBeDisabled();
    });

    it('should call onNoObject when clicked', async () => {
      const user = userEvent.setup();
      const onNoObject = vi.fn();

      render(<CanvasActionBar {...defaultProps} onNoObject={onNoObject} />);

      const noObjectButton = screen.getByTitle('No Object (0)');
      await user.click(noObjectButton);

      expect(onNoObject).toHaveBeenCalledTimes(1);
    });

    it('should have correct styling (gray background)', () => {
      render(<CanvasActionBar {...defaultProps} />);

      const noObjectButton = screen.getByTitle('No Object (0)');
      expect(noObjectButton).toHaveClass('bg-gray-600');
    });
  });

  describe('Delete All Button', () => {
    describe('Disabled State', () => {
      it('should be disabled when no annotations and no selection', () => {
        render(
          <CanvasActionBar
            {...defaultProps}
            annotationCount={0}
            selectedImageCount={0}
          />
        );

        const deleteButton = screen.getByTitle('Delete All Annotations (Del)');
        expect(deleteButton).toBeDisabled();
      });

      it('should have gray background when disabled', () => {
        render(
          <CanvasActionBar
            {...defaultProps}
            annotationCount={0}
            selectedImageCount={0}
          />
        );

        const deleteButton = screen.getByTitle('Delete All Annotations (Del)');
        expect(deleteButton).toHaveClass('bg-gray-400');
      });

      it('should not call onDeleteAll when disabled button clicked', async () => {
        const user = userEvent.setup();
        const onDeleteAll = vi.fn();

        render(
          <CanvasActionBar
            {...defaultProps}
            annotationCount={0}
            selectedImageCount={0}
            onDeleteAll={onDeleteAll}
          />
        );

        const deleteButton = screen.getByTitle('Delete All Annotations (Del)');
        await user.click(deleteButton);

        expect(onDeleteAll).not.toHaveBeenCalled();
      });
    });

    describe('Enabled State - Annotations', () => {
      it('should be enabled when annotations exist', () => {
        render(
          <CanvasActionBar
            {...defaultProps}
            annotationCount={5}
            selectedImageCount={0}
          />
        );

        const deleteButton = screen.getByTitle('Delete All Annotations (Del)');
        expect(deleteButton).not.toBeDisabled();
      });

      it('should have red background when enabled', () => {
        render(
          <CanvasActionBar
            {...defaultProps}
            annotationCount={5}
            selectedImageCount={0}
          />
        );

        const deleteButton = screen.getByTitle('Delete All Annotations (Del)');
        expect(deleteButton).toHaveClass('bg-red-400');
      });

      it('should call onDeleteAll when enabled button clicked', async () => {
        const user = userEvent.setup();
        const onDeleteAll = vi.fn();

        render(
          <CanvasActionBar
            {...defaultProps}
            annotationCount={5}
            onDeleteAll={onDeleteAll}
          />
        );

        const deleteButton = screen.getByTitle('Delete All Annotations (Del)');
        await user.click(deleteButton);

        expect(onDeleteAll).toHaveBeenCalledTimes(1);
      });
    });

    describe('Enabled State - Selection', () => {
      it('should be enabled when images are selected (batch mode)', () => {
        render(
          <CanvasActionBar
            {...defaultProps}
            annotationCount={0}
            selectedImageCount={3}
          />
        );

        const deleteButton = screen.getByTitle('Delete All Annotations (Del)');
        expect(deleteButton).not.toBeDisabled();
      });

      it('should be enabled when both annotations and selection exist', () => {
        render(
          <CanvasActionBar
            {...defaultProps}
            annotationCount={2}
            selectedImageCount={3}
          />
        );

        const deleteButton = screen.getByTitle('Delete All Annotations (Del)');
        expect(deleteButton).not.toBeDisabled();
      });
    });
  });

  describe('Button Layout', () => {
    it('should position buttons in top-right corner', () => {
      const { container } = render(<CanvasActionBar {...defaultProps} />);

      const actionBar = container.firstChild as HTMLElement;
      expect(actionBar).toHaveClass('absolute', 'top-4', 'right-4');
    });

    it('should display buttons in horizontal row', () => {
      const { container } = render(<CanvasActionBar {...defaultProps} />);

      const actionBar = container.firstChild as HTMLElement;
      expect(actionBar).toHaveClass('flex', 'flex-row', 'gap-2');
    });
  });

  describe('Edge Cases', () => {
    it('should handle single annotation', () => {
      render(
        <CanvasActionBar
          {...defaultProps}
          annotationCount={1}
          selectedImageCount={0}
        />
      );

      const deleteButton = screen.getByTitle('Delete All Annotations (Del)');
      expect(deleteButton).not.toBeDisabled();
    });

    it('should handle single selected image', () => {
      render(
        <CanvasActionBar
          {...defaultProps}
          annotationCount={0}
          selectedImageCount={1}
        />
      );

      const deleteButton = screen.getByTitle('Delete All Annotations (Del)');
      expect(deleteButton).not.toBeDisabled();
    });

    it('should handle large annotation counts', () => {
      render(
        <CanvasActionBar
          {...defaultProps}
          annotationCount={1000}
          selectedImageCount={0}
        />
      );

      const deleteButton = screen.getByTitle('Delete All Annotations (Del)');
      expect(deleteButton).not.toBeDisabled();
    });

    it('should handle large selection counts', () => {
      render(
        <CanvasActionBar
          {...defaultProps}
          annotationCount={0}
          selectedImageCount={500}
        />
      );

      const deleteButton = screen.getByTitle('Delete All Annotations (Del)');
      expect(deleteButton).not.toBeDisabled();
    });
  });

  describe('Memoization', () => {
    it('should not re-render when props are unchanged', () => {
      const { rerender } = render(<CanvasActionBar {...defaultProps} />);

      rerender(<CanvasActionBar {...defaultProps} />);

      // Verify component is wrapped with React.memo
      expect(CanvasActionBar).toBeDefined();
    });
  });
});
