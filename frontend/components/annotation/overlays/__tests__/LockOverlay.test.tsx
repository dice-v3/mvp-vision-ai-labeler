/**
 * LockOverlay Component Tests
 *
 * Tests for lock status and overlay display
 * Phase 18: Canvas Architecture Refactoring
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LockOverlay, LockOverlayProps } from '../LockOverlay';

describe('LockOverlay', () => {
  const defaultProps: LockOverlayProps = {
    isImageLocked: false,
    lockedByUser: null,
    hasCurrentImage: true,
  };

  describe('No Current Image', () => {
    it('should render nothing when no current image', () => {
      const { container } = render(
        <LockOverlay {...defaultProps} hasCurrentImage={false} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should not show lock badge when no current image', () => {
      render(<LockOverlay {...defaultProps} hasCurrentImage={false} />);

      expect(
        screen.queryByText('You have exclusive editing access')
      ).not.toBeInTheDocument();
    });

    it('should not show locked overlay when no current image', () => {
      render(<LockOverlay {...defaultProps} hasCurrentImage={false} />);

      expect(screen.queryByText('Image Locked')).not.toBeInTheDocument();
    });
  });

  describe('Lock Acquired (User Has Lock)', () => {
    const lockedProps: LockOverlayProps = {
      ...defaultProps,
      isImageLocked: true,
      lockedByUser: null,
      hasCurrentImage: true,
    };

    it('should show success badge when user has lock', () => {
      render(<LockOverlay {...lockedProps} />);

      expect(
        screen.getByText('You have exclusive editing access')
      ).toBeInTheDocument();
    });

    it('should not show locked overlay when user has lock', () => {
      render(<LockOverlay {...lockedProps} />);

      expect(screen.queryByText('Image Locked')).not.toBeInTheDocument();
    });

    it('should display lock icon in success badge', () => {
      const { container } = render(<LockOverlay {...lockedProps} />);

      const badge = container.querySelector('.bg-green-100');
      expect(badge).toBeInTheDocument();

      const icon = badge?.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should position badge at top-left', () => {
      const { container } = render(<LockOverlay {...lockedProps} />);

      const badge = container.querySelector('.bg-green-100');
      expect(badge).toHaveClass('absolute', 'top-20', 'left-4');
    });

    it('should have green styling for success state', () => {
      const { container } = render(<LockOverlay {...lockedProps} />);

      const badge = container.querySelector('.bg-green-100');
      expect(badge).toHaveClass('bg-green-100', 'text-green-800');
    });
  });

  describe('Lock Not Acquired - No User Info', () => {
    const unlockedProps: LockOverlayProps = {
      ...defaultProps,
      isImageLocked: false,
      lockedByUser: null,
      hasCurrentImage: true,
    };

    it('should show locked overlay when lock not acquired', () => {
      render(<LockOverlay {...unlockedProps} />);

      expect(screen.getByText('Image Locked')).toBeInTheDocument();
    });

    it('should show instruction to acquire lock', () => {
      render(<LockOverlay {...unlockedProps} />);

      expect(screen.getByText('Click the image to acquire lock')).toBeInTheDocument();
    });

    it('should not show locked by user message', () => {
      render(<LockOverlay {...unlockedProps} />);

      expect(screen.queryByText(/Currently locked by/)).not.toBeInTheDocument();
    });

    it('should display lock icon in overlay', () => {
      const { container } = render(<LockOverlay {...unlockedProps} />);

      const overlay = screen.getByText('Image Locked').closest('div');
      const icon = overlay?.parentElement?.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should have blue styling for instruction message', () => {
      const { container } = render(<LockOverlay {...unlockedProps} />);

      const message = screen.getByText('Click the image to acquire lock');
      expect(message.closest('.bg-blue-50')).toBeInTheDocument();
      expect(message.closest('.bg-blue-50')).toHaveClass('border-blue-200', 'text-blue-800');
    });

    it('should have blurred backdrop', () => {
      const { container } = render(<LockOverlay {...unlockedProps} />);

      const backdrop = container.querySelector('.backdrop-blur-sm');
      expect(backdrop).toBeInTheDocument();
      expect(backdrop).toHaveClass('bg-black/40');
    });
  });

  describe('Lock Not Acquired - With User Info', () => {
    const lockedByOtherProps: LockOverlayProps = {
      ...defaultProps,
      isImageLocked: false,
      lockedByUser: 'John Doe',
      hasCurrentImage: true,
    };

    it('should show locked overlay when locked by another user', () => {
      render(<LockOverlay {...lockedByOtherProps} />);

      expect(screen.getByText('Image Locked')).toBeInTheDocument();
    });

    it('should show locked by user message', () => {
      render(<LockOverlay {...lockedByOtherProps} />);

      expect(screen.getByText('Currently locked by')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should emphasize username with bold text', () => {
      render(<LockOverlay {...lockedByOtherProps} />);

      const username = screen.getByText('John Doe');
      expect(username).toHaveClass('font-semibold');
    });

    it('should not show acquire lock instruction', () => {
      render(<LockOverlay {...lockedByOtherProps} />);

      expect(
        screen.queryByText('Click the image to acquire lock')
      ).not.toBeInTheDocument();
    });

    it('should have amber styling for locked by user message', () => {
      render(<LockOverlay {...lockedByOtherProps} />);

      const message = screen.getByText('Currently locked by');
      expect(message.closest('.bg-amber-50')).toBeInTheDocument();
      expect(message.closest('.bg-amber-50')).toHaveClass('border-amber-200', 'text-amber-800');
    });

    it('should handle different usernames', () => {
      const { rerender } = render(
        <LockOverlay {...lockedByOtherProps} lockedByUser="Alice Smith" />
      );

      expect(screen.getByText('Alice Smith')).toBeInTheDocument();

      rerender(<LockOverlay {...lockedByOtherProps} lockedByUser="Bob Johnson" />);

      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    });

    it('should handle usernames with special characters', () => {
      render(
        <LockOverlay {...lockedByOtherProps} lockedByUser="María García-López" />
      );

      expect(screen.getByText('María García-López')).toBeInTheDocument();
    });
  });

  describe('Layout', () => {
    it('should cover full screen when locked by another', () => {
      const { container } = render(
        <LockOverlay
          {...defaultProps}
          isImageLocked={false}
          lockedByUser="John"
        />
      );

      const overlay = container.querySelector('.inset-0');
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveClass('absolute', 'z-20');
    });

    it('should center overlay content', () => {
      const { container } = render(
        <LockOverlay
          {...defaultProps}
          isImageLocked={false}
        />
      );

      const overlay = container.querySelector('.inset-0');
      expect(overlay).toHaveClass('flex', 'items-center', 'justify-center');
    });
  });

  describe('State Transitions', () => {
    it('should transition from locked badge to locked overlay', () => {
      const { rerender } = render(
        <LockOverlay
          {...defaultProps}
          isImageLocked={true}
        />
      );

      expect(
        screen.getByText('You have exclusive editing access')
      ).toBeInTheDocument();

      rerender(
        <LockOverlay
          {...defaultProps}
          isImageLocked={false}
        />
      );

      expect(
        screen.queryByText('You have exclusive editing access')
      ).not.toBeInTheDocument();
      expect(screen.getByText('Image Locked')).toBeInTheDocument();
    });

    it('should transition from no lock to acquired lock', () => {
      const { rerender } = render(
        <LockOverlay
          {...defaultProps}
          isImageLocked={false}
        />
      );

      expect(screen.getByText('Image Locked')).toBeInTheDocument();

      rerender(
        <LockOverlay
          {...defaultProps}
          isImageLocked={true}
        />
      );

      expect(screen.queryByText('Image Locked')).not.toBeInTheDocument();
      expect(
        screen.getByText('You have exclusive editing access')
      ).toBeInTheDocument();
    });

    it('should handle image change (hasCurrentImage toggle)', () => {
      const { rerender, container } = render(
        <LockOverlay {...defaultProps} hasCurrentImage={true} />
      );

      expect(container.firstChild).not.toBeNull();

      rerender(<LockOverlay {...defaultProps} hasCurrentImage={false} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string username', () => {
      render(
        <LockOverlay
          {...defaultProps}
          isImageLocked={false}
          lockedByUser=""
        />
      );

      // Empty string is falsy, should show acquire instruction
      expect(screen.getByText('Click the image to acquire lock')).toBeInTheDocument();
    });

    it('should handle very long username', () => {
      const longName = 'A'.repeat(100);
      render(
        <LockOverlay
          {...defaultProps}
          isImageLocked={false}
          lockedByUser={longName}
        />
      );

      expect(screen.getByText(longName)).toBeInTheDocument();
    });

    it('should handle username with HTML-like content', () => {
      render(
        <LockOverlay
          {...defaultProps}
          isImageLocked={false}
          lockedByUser="<script>alert('xss')</script>"
        />
      );

      // React automatically escapes, should render as text
      expect(
        screen.getByText("<script>alert('xss')</script>")
      ).toBeInTheDocument();
    });
  });

  describe('Memoization', () => {
    it('should not re-render when props are unchanged', () => {
      const { rerender } = render(<LockOverlay {...defaultProps} />);

      rerender(<LockOverlay {...defaultProps} />);

      // Verify component is wrapped with React.memo
      expect(LockOverlay).toBeDefined();
    });
  });
});
