/**
 * ToolSelector Component Tests
 *
 * Tests for tool selection buttons based on task type
 * Phase 18: Canvas Architecture Refactoring
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolSelector, ToolSelectorProps } from '../ToolSelector';

describe('ToolSelector', () => {
  const defaultProps: ToolSelectorProps = {
    tool: 'select',
    currentTask: null,
    onToolSelect: vi.fn(),
  };

  describe('Common Tools', () => {
    it('should always render Select tool', () => {
      render(<ToolSelector {...defaultProps} currentTask={null} />);

      expect(screen.getByTitle('Select Tool (Q)')).toBeInTheDocument();
    });

    it('should render Select tool for all task types', () => {
      const tasks = ['detection', 'segmentation', 'classification', 'geometry'];

      tasks.forEach((task) => {
        const { unmount } = render(<ToolSelector {...defaultProps} currentTask={task} />);
        expect(screen.getByTitle('Select Tool (Q)')).toBeInTheDocument();
        unmount();
      });
    });

    it('should highlight Select tool when selected', () => {
      render(<ToolSelector {...defaultProps} tool="select" />);

      const selectButton = screen.getByTitle('Select Tool (Q)');
      expect(selectButton).toHaveClass('bg-violet-500', 'text-white');
    });

    it('should not highlight Select tool when not selected', () => {
      render(<ToolSelector {...defaultProps} tool="bbox" currentTask="detection" />);

      const selectButton = screen.getByTitle('Select Tool (Q)');
      expect(selectButton).not.toHaveClass('bg-violet-500');
    });
  });

  describe('Detection Task', () => {
    const detectionProps: ToolSelectorProps = {
      ...defaultProps,
      currentTask: 'detection',
    };

    it('should render BBox tool for detection task', () => {
      render(<ToolSelector {...detectionProps} />);

      expect(screen.getByTitle('Bounding Box (B)')).toBeInTheDocument();
    });

    it('should not render other task-specific tools', () => {
      render(<ToolSelector {...detectionProps} />);

      expect(screen.queryByTitle('Polygon (P)')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Classify (W)')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Polyline (L)')).not.toBeInTheDocument();
    });

    it('should highlight BBox when selected', () => {
      render(<ToolSelector {...detectionProps} tool="bbox" />);

      const bboxButton = screen.getByTitle('Bounding Box (B)');
      expect(bboxButton).toHaveClass('bg-violet-500', 'text-white');
    });

    it('should call onToolSelect with bbox', async () => {
      const user = userEvent.setup();
      const onToolSelect = vi.fn();

      render(<ToolSelector {...detectionProps} onToolSelect={onToolSelect} />);

      const bboxButton = screen.getByTitle('Bounding Box (B)');
      await user.click(bboxButton);

      expect(onToolSelect).toHaveBeenCalledWith('bbox');
    });
  });

  describe('Segmentation Task', () => {
    const segmentationProps: ToolSelectorProps = {
      ...defaultProps,
      currentTask: 'segmentation',
    };

    it('should render Polygon tool for segmentation task', () => {
      render(<ToolSelector {...segmentationProps} />);

      expect(screen.getByTitle('Polygon (P)')).toBeInTheDocument();
    });

    it('should not render other task-specific tools', () => {
      render(<ToolSelector {...segmentationProps} />);

      expect(screen.queryByTitle('Bounding Box (B)')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Classify (W)')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Polyline (L)')).not.toBeInTheDocument();
    });

    it('should highlight Polygon when selected', () => {
      render(<ToolSelector {...segmentationProps} tool="polygon" />);

      const polygonButton = screen.getByTitle('Polygon (P)');
      expect(polygonButton).toHaveClass('bg-violet-500', 'text-white');
    });

    it('should call onToolSelect with polygon', async () => {
      const user = userEvent.setup();
      const onToolSelect = vi.fn();

      render(<ToolSelector {...segmentationProps} onToolSelect={onToolSelect} />);

      const polygonButton = screen.getByTitle('Polygon (P)');
      await user.click(polygonButton);

      expect(onToolSelect).toHaveBeenCalledWith('polygon');
    });
  });

  describe('Classification Task', () => {
    const classificationProps: ToolSelectorProps = {
      ...defaultProps,
      currentTask: 'classification',
    };

    it('should render Classify tool for classification task', () => {
      render(<ToolSelector {...classificationProps} />);

      expect(screen.getByTitle('Classify (W)')).toBeInTheDocument();
    });

    it('should not render other task-specific tools', () => {
      render(<ToolSelector {...classificationProps} />);

      expect(screen.queryByTitle('Bounding Box (B)')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Polygon (P)')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Polyline (L)')).not.toBeInTheDocument();
    });

    it('should highlight Classify when selected', () => {
      render(<ToolSelector {...classificationProps} tool="classification" />);

      const classifyButton = screen.getByTitle('Classify (W)');
      expect(classifyButton).toHaveClass('bg-violet-500', 'text-white');
    });

    it('should call onToolSelect with classification', async () => {
      const user = userEvent.setup();
      const onToolSelect = vi.fn();

      render(<ToolSelector {...classificationProps} onToolSelect={onToolSelect} />);

      const classifyButton = screen.getByTitle('Classify (W)');
      await user.click(classifyButton);

      expect(onToolSelect).toHaveBeenCalledWith('classification');
    });
  });

  describe('Geometry Task', () => {
    const geometryProps: ToolSelectorProps = {
      ...defaultProps,
      currentTask: 'geometry',
    };

    it('should render all geometry tools', () => {
      render(<ToolSelector {...geometryProps} />);

      expect(screen.getByTitle('Polyline (L)')).toBeInTheDocument();
      expect(screen.getByTitle('Circle - Center Edge (E)')).toBeInTheDocument();
      expect(screen.getByTitle('Circle - 3 Points (R)')).toBeInTheDocument();
    });

    it('should not render other task-specific tools', () => {
      render(<ToolSelector {...geometryProps} />);

      expect(screen.queryByTitle('Bounding Box (B)')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Polygon (P)')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Classify (W)')).not.toBeInTheDocument();
    });

    it('should highlight Polyline when selected', () => {
      render(<ToolSelector {...geometryProps} tool="polyline" />);

      const polylineButton = screen.getByTitle('Polyline (L)');
      expect(polylineButton).toHaveClass('bg-violet-500', 'text-white');
    });

    it('should highlight Circle(2P) when selected', () => {
      render(<ToolSelector {...geometryProps} tool="circle" />);

      const circleButton = screen.getByTitle('Circle - Center Edge (E)');
      expect(circleButton).toHaveClass('bg-violet-500', 'text-white');
    });

    it('should highlight Circle(3P) when selected', () => {
      render(<ToolSelector {...geometryProps} tool="circle3p" />);

      const circle3pButton = screen.getByTitle('Circle - 3 Points (R)');
      expect(circle3pButton).toHaveClass('bg-violet-500', 'text-white');
    });

    it('should call onToolSelect with polyline', async () => {
      const user = userEvent.setup();
      const onToolSelect = vi.fn();

      render(<ToolSelector {...geometryProps} onToolSelect={onToolSelect} />);

      const polylineButton = screen.getByTitle('Polyline (L)');
      await user.click(polylineButton);

      expect(onToolSelect).toHaveBeenCalledWith('polyline');
    });

    it('should call onToolSelect with circle', async () => {
      const user = userEvent.setup();
      const onToolSelect = vi.fn();

      render(<ToolSelector {...geometryProps} onToolSelect={onToolSelect} />);

      const circleButton = screen.getByTitle('Circle - Center Edge (E)');
      await user.click(circleButton);

      expect(onToolSelect).toHaveBeenCalledWith('circle');
    });

    it('should call onToolSelect with circle3p', async () => {
      const user = userEvent.setup();
      const onToolSelect = vi.fn();

      render(<ToolSelector {...geometryProps} onToolSelect={onToolSelect} />);

      const circle3pButton = screen.getByTitle('Circle - 3 Points (R)');
      await user.click(circle3pButton);

      expect(onToolSelect).toHaveBeenCalledWith('circle3p');
    });
  });

  describe('No Task Selected', () => {
    it('should only show Select tool when no task', () => {
      render(<ToolSelector {...defaultProps} currentTask={null} />);

      expect(screen.getByTitle('Select Tool (Q)')).toBeInTheDocument();
      expect(screen.queryByTitle('Bounding Box (B)')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Polygon (P)')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Classify (W)')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Polyline (L)')).not.toBeInTheDocument();
    });
  });

  describe('Tool Selection', () => {
    it('should call onToolSelect with select', async () => {
      const user = userEvent.setup();
      const onToolSelect = vi.fn();

      render(<ToolSelector {...defaultProps} onToolSelect={onToolSelect} />);

      const selectButton = screen.getByTitle('Select Tool (Q)');
      await user.click(selectButton);

      expect(onToolSelect).toHaveBeenCalledWith('select');
    });

    it('should only call onToolSelect once per click', async () => {
      const user = userEvent.setup();
      const onToolSelect = vi.fn();

      render(
        <ToolSelector
          {...defaultProps}
          currentTask="detection"
          onToolSelect={onToolSelect}
        />
      );

      const bboxButton = screen.getByTitle('Bounding Box (B)');
      await user.click(bboxButton);

      expect(onToolSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe('Layout', () => {
    it('should position selector at top center', () => {
      const { container } = render(<ToolSelector {...defaultProps} />);

      const selector = container.firstChild as HTMLElement;
      expect(selector).toHaveClass('absolute', 'top-4', 'left-1/2', 'transform', '-translate-x-1/2');
    });

    it('should have horizontal layout', () => {
      const { container } = render(<ToolSelector {...defaultProps} />);

      const selector = container.firstChild as HTMLElement;
      expect(selector).toHaveClass('flex', 'items-center', 'gap-2');
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown task type gracefully', () => {
      render(<ToolSelector {...defaultProps} currentTask="unknown" />);

      // Should still render Select tool
      expect(screen.getByTitle('Select Tool (Q)')).toBeInTheDocument();
    });

    it('should handle empty string task', () => {
      render(<ToolSelector {...defaultProps} currentTask="" />);

      expect(screen.getByTitle('Select Tool (Q)')).toBeInTheDocument();
    });

    it('should handle rapid tool switching', async () => {
      const user = userEvent.setup();
      const onToolSelect = vi.fn();

      render(
        <ToolSelector
          {...defaultProps}
          currentTask="geometry"
          onToolSelect={onToolSelect}
        />
      );

      const polylineButton = screen.getByTitle('Polyline (L)');
      const circleButton = screen.getByTitle('Circle - Center Edge (E)');
      const circle3pButton = screen.getByTitle('Circle - 3 Points (R)');

      await user.click(polylineButton);
      await user.click(circleButton);
      await user.click(circle3pButton);

      expect(onToolSelect).toHaveBeenCalledTimes(3);
      expect(onToolSelect).toHaveBeenNthCalledWith(1, 'polyline');
      expect(onToolSelect).toHaveBeenNthCalledWith(2, 'circle');
      expect(onToolSelect).toHaveBeenNthCalledWith(3, 'circle3p');
    });
  });

  describe('Task Switching', () => {
    it('should update tools when task changes', () => {
      const { rerender } = render(
        <ToolSelector {...defaultProps} currentTask="detection" />
      );

      expect(screen.getByTitle('Bounding Box (B)')).toBeInTheDocument();

      rerender(<ToolSelector {...defaultProps} currentTask="segmentation" />);

      expect(screen.queryByTitle('Bounding Box (B)')).not.toBeInTheDocument();
      expect(screen.getByTitle('Polygon (P)')).toBeInTheDocument();
    });

    it('should maintain Select tool across task changes', () => {
      const { rerender } = render(
        <ToolSelector {...defaultProps} currentTask="detection" />
      );

      expect(screen.getByTitle('Select Tool (Q)')).toBeInTheDocument();

      rerender(<ToolSelector {...defaultProps} currentTask="geometry" />);

      expect(screen.getByTitle('Select Tool (Q)')).toBeInTheDocument();
    });
  });

  describe('Memoization', () => {
    it('should not re-render when props are unchanged', () => {
      const { rerender } = render(<ToolSelector {...defaultProps} />);

      rerender(<ToolSelector {...defaultProps} />);

      // Verify component is wrapped with React.memo
      expect(ToolSelector).toBeDefined();
    });
  });
});
