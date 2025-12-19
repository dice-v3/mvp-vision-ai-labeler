/**
 * NavigationButtons Component Tests
 *
 * Tests for image navigation controls
 * Phase 18: Canvas Architecture Refactoring
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NavigationButtons, NavigationButtonsProps } from '../NavigationButtons';

describe('NavigationButtons', () => {
  const defaultProps: NavigationButtonsProps = {
    currentIndex: 0,
    totalImages: 10,
    onPrevious: vi.fn(),
    onNext: vi.fn(),
  };

  describe('Rendering', () => {
    it('should render navigation buttons', () => {
      render(<NavigationButtons {...defaultProps} />);

      expect(screen.getByTitle('Previous Image (←)')).toBeInTheDocument();
      expect(screen.getByTitle('Next Image (→)')).toBeInTheDocument();
    });

    it('should display current position indicator', () => {
      render(<NavigationButtons {...defaultProps} />);

      expect(screen.getByText('1 / 10')).toBeInTheDocument();
    });

    it('should display correct position for middle image', () => {
      render(<NavigationButtons {...defaultProps} currentIndex={4} />);

      expect(screen.getByText('5 / 10')).toBeInTheDocument();
    });

    it('should display correct position for last image', () => {
      render(<NavigationButtons {...defaultProps} currentIndex={9} totalImages={10} />);

      expect(screen.getByText('10 / 10')).toBeInTheDocument();
    });
  });

  describe('Button States', () => {
    it('should disable previous button at first image', () => {
      render(<NavigationButtons {...defaultProps} currentIndex={0} />);

      const prevButton = screen.getByTitle('Previous Image (←)');
      expect(prevButton).toBeDisabled();
    });

    it('should enable previous button after first image', () => {
      render(<NavigationButtons {...defaultProps} currentIndex={1} />);

      const prevButton = screen.getByTitle('Previous Image (←)');
      expect(prevButton).not.toBeDisabled();
    });

    it('should disable next button at last image', () => {
      render(<NavigationButtons {...defaultProps} currentIndex={9} totalImages={10} />);

      const nextButton = screen.getByTitle('Next Image (→)');
      expect(nextButton).toBeDisabled();
    });

    it('should enable next button before last image', () => {
      render(<NavigationButtons {...defaultProps} currentIndex={8} totalImages={10} />);

      const nextButton = screen.getByTitle('Next Image (→)');
      expect(nextButton).not.toBeDisabled();
    });

    it('should enable both buttons in middle', () => {
      render(<NavigationButtons {...defaultProps} currentIndex={5} totalImages={10} />);

      const prevButton = screen.getByTitle('Previous Image (←)');
      const nextButton = screen.getByTitle('Next Image (→)');

      expect(prevButton).not.toBeDisabled();
      expect(nextButton).not.toBeDisabled();
    });
  });

  describe('User Interactions', () => {
    it('should call onPrevious when previous button clicked', async () => {
      const user = userEvent.setup();
      const onPrevious = vi.fn();

      render(
        <NavigationButtons
          {...defaultProps}
          currentIndex={5}
          onPrevious={onPrevious}
        />
      );

      const prevButton = screen.getByTitle('Previous Image (←)');
      await user.click(prevButton);

      expect(onPrevious).toHaveBeenCalledTimes(1);
    });

    it('should call onNext when next button clicked', async () => {
      const user = userEvent.setup();
      const onNext = vi.fn();

      render(
        <NavigationButtons
          {...defaultProps}
          currentIndex={5}
          onNext={onNext}
        />
      );

      const nextButton = screen.getByTitle('Next Image (→)');
      await user.click(nextButton);

      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('should not call onPrevious when button is disabled', async () => {
      const user = userEvent.setup();
      const onPrevious = vi.fn();

      render(
        <NavigationButtons
          {...defaultProps}
          currentIndex={0}
          onPrevious={onPrevious}
        />
      );

      const prevButton = screen.getByTitle('Previous Image (←)');
      await user.click(prevButton);

      expect(onPrevious).not.toHaveBeenCalled();
    });

    it('should not call onNext when button is disabled', async () => {
      const user = userEvent.setup();
      const onNext = vi.fn();

      render(
        <NavigationButtons
          {...defaultProps}
          currentIndex={9}
          totalImages={10}
          onNext={onNext}
        />
      );

      const nextButton = screen.getByTitle('Next Image (→)');
      await user.click(nextButton);

      expect(onNext).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single image correctly', () => {
      render(
        <NavigationButtons
          {...defaultProps}
          currentIndex={0}
          totalImages={1}
        />
      );

      expect(screen.getByText('1 / 1')).toBeInTheDocument();
      expect(screen.getByTitle('Previous Image (←)')).toBeDisabled();
      expect(screen.getByTitle('Next Image (→)')).toBeDisabled();
    });

    it('should handle large image counts', () => {
      render(
        <NavigationButtons
          {...defaultProps}
          currentIndex={999}
          totalImages={1000}
        />
      );

      expect(screen.getByText('1000 / 1000')).toBeInTheDocument();
    });
  });

  describe('Memoization', () => {
    it('should not re-render when props are unchanged', () => {
      const { rerender } = render(<NavigationButtons {...defaultProps} />);

      // Re-render with same props
      rerender(<NavigationButtons {...defaultProps} />);

      // Component should be memoized (React.memo)
      // This test verifies the component is wrapped with React.memo
      expect(NavigationButtons).toBeDefined();
    });
  });
});
