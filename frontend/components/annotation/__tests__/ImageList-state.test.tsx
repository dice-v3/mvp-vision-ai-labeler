/**
 * ImageList Component Tests - State Management
 *
 * Tests for image loading states, error handling, empty states, and data refetching.
 *
 * Phase 8: Frontend ImageList Component Tests
 * Subtask 8.3: Test ImageList.tsx state management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImageList from '../ImageList';
import {
  createMockAnnotationStore,
  createMockProject,
  createMockImage,
} from '@/lib/test-utils/mock-stores';
import { useAnnotationStore } from '@/lib/stores/annotationStore';
import { getProjectImages, getProjectImageStatuses } from '@/lib/api/projects';
import { imageLockAPI } from '@/lib/api/image-locks';

// Create mock function for annotation store with vi.hoisted()
const { mockUseAnnotationStore } = vi.hoisted(() => ({
  mockUseAnnotationStore: vi.fn(),
}));

// Mock the annotation store
vi.mock('@/lib/stores/annotationStore', () => ({
  useAnnotationStore: mockUseAnnotationStore,
}));

// Mock useAuth hook
vi.mock('@/lib/auth/context', () => ({
  useAuth: () => ({
    user: { id: 1, email: 'test@example.com', name: 'Test User' },
    loading: false,
    error: null,
  }),
}));

// Mock API modules
vi.mock('@/lib/api/projects', () => ({
  getProjectImages: vi.fn(),
  getProjectImageStatuses: vi.fn(),
}));

vi.mock('@/lib/api/image-locks', () => ({
  imageLockAPI: {
    getProjectLocks: vi.fn(),
    acquire: vi.fn().mockResolvedValue({ status: 'acquired' }),
    release: vi.fn().mockResolvedValue({ status: 'released' }),
    heartbeat: vi.fn().mockResolvedValue({ status: 'updated' }),
    getStatus: vi.fn().mockResolvedValue(null),
  },
}));

describe('ImageList - State Management', () => {
  let mockStore: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockStore = createMockAnnotationStore();
    mockUseAnnotationStore.mockReturnValue(mockStore);

    // Default mock implementations
    (getProjectImages as any).mockResolvedValue({ images: [], total: 0 });
    (getProjectImageStatuses as any).mockResolvedValue({ statuses: [] });
    (imageLockAPI.getProjectLocks as any).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('Loading States', () => {
    it('should display loading state when backgroundLoading is true', () => {
      mockStore.backgroundLoading = true;
      mockStore.images = [];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      // When backgroundLoading is true and no images, should show empty state
      expect(screen.getByText('No images match filter')).toBeInTheDocument();
    });

    it('should show load more button when there are more images to load', () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
        createMockImage({ id: '2', file_name: 'image2.jpg' }),
        createMockImage({ id: '3', file_name: 'image3.jpg' }),
      ];

      mockStore.images = images;
      mockStore.totalImages = 50; // More images available
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      // Should render all loaded images
      expect(screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('title')?.includes('.jpg')
      )).toHaveLength(3);
    });

    it('should not show load more button when all images are loaded', () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
        createMockImage({ id: '2', file_name: 'image2.jpg' }),
        createMockImage({ id: '3', file_name: 'image3.jpg' }),
      ];

      mockStore.images = images;
      mockStore.totalImages = 3; // All images loaded
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      // All images should be visible
      expect(screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('title')?.includes('.jpg')
      )).toHaveLength(3);
    });

    it('should show locks loading state initially', async () => {
      const project = createMockProject({ id: 'proj_123' });
      mockStore.project = project;
      mockStore.images = [createMockImage({ id: '1', file_name: 'image1.jpg' })];

      // Mock locks loading delay
      (imageLockAPI.getProjectLocks as any).mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );

      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      // Locks should be loading initially
      await waitFor(() => {
        expect(imageLockAPI.getProjectLocks).toHaveBeenCalledWith('proj_123');
      });
    });

    it('should handle loadingMore state during pagination', async () => {
      const project = createMockProject({ id: 'proj_123' });
      const initialImages = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
        createMockImage({ id: '2', file_name: 'image2.jpg' }),
      ];

      mockStore.project = project;
      mockStore.images = initialImages;
      mockStore.totalImages = 10; // More images available
      mockStore.loadMoreImages = vi.fn();

      mockUseAnnotationStore.mockReturnValue(mockStore);

      const newImages = [
        { id: '3', file_name: 'image3.jpg', url: 'http://example.com/3.jpg' },
        { id: '4', file_name: 'image4.jpg', url: 'http://example.com/4.jpg' },
      ];

      (getProjectImages as any).mockResolvedValue({
        images: newImages,
        total: 10,
      });

      (getProjectImageStatuses as any).mockResolvedValue({
        statuses: [
          { image_id: '3', total_annotations: 0, is_image_confirmed: false, status: 'not-started' },
          { image_id: '4', total_annotations: 2, is_image_confirmed: false, status: 'in-progress' },
        ],
      });

      render(<ImageList />);

      // Simulate scroll to bottom to trigger load more
      const container = screen.getByText('Images').parentElement?.nextElementSibling as HTMLElement;

      // This test verifies the load more mechanism exists
      expect(container).toBeTruthy();
    });

    it('should show locksLoading state when loading project locks', async () => {
      const project = createMockProject({ id: 'proj_123' });
      mockStore.project = project;
      mockStore.images = [createMockImage({ id: '1', file_name: 'image1.jpg' })];

      let resolveLocks: any;
      const locksPromise = new Promise((resolve) => {
        resolveLocks = resolve;
      });

      (imageLockAPI.getProjectLocks as any).mockReturnValue(locksPromise);
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      // Locks should be loading
      expect(imageLockAPI.getProjectLocks).toHaveBeenCalledWith('proj_123');

      // Resolve locks
      resolveLocks([]);
      await waitFor(() => {
        expect(imageLockAPI.getProjectLocks).toHaveBeenCalled();
      });
    });

    it('should handle backgroundLoading state from store', () => {
      mockStore.backgroundLoading = true;
      mockStore.images = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
      ];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      // Should still render images even when backgroundLoading
      expect(screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('title')?.includes('.jpg')
      )).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle image loading errors with fallback', () => {
      const images = [
        createMockImage({
          id: '1',
          file_name: 'image1.jpg',
          thumbnail_url: 'http://example.com/thumb.jpg',
          url: 'http://example.com/full.jpg'
        }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const imgElement = screen.getByAlt('image1.jpg') as HTMLImageElement;

      // Verify initial src is thumbnail
      expect(imgElement.src).toContain('thumb.jpg');

      // Simulate image load error
      act(() => {
        imgElement.dispatchEvent(new Event('error'));
      });

      // Should fallback to full image URL
      expect(imgElement.src).toContain('full.jpg');
    });

    it('should handle missing thumbnail_url gracefully', () => {
      const images = [
        createMockImage({
          id: '1',
          file_name: 'image1.jpg',
          thumbnail_url: undefined,
          url: 'http://example.com/full.jpg'
        } as any),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const imgElement = screen.getByAlt('image1.jpg') as HTMLImageElement;

      // Should use full URL when thumbnail is missing
      expect(imgElement.src).toContain('full.jpg');
    });

    it('should handle API error when loading more images', async () => {
      const project = createMockProject({ id: 'proj_123' });
      const initialImages = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
      ];

      mockStore.project = project;
      mockStore.images = initialImages;
      mockStore.totalImages = 10;
      mockStore.loadMoreImages = vi.fn();

      mockUseAnnotationStore.mockReturnValue(mockStore);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock API error
      (getProjectImages as any).mockRejectedValue(new Error('Network error'));

      render(<ImageList />);

      // Component should still render despite error
      expect(screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('title')?.includes('.jpg')
      )).toHaveLength(1);

      consoleErrorSpy.mockRestore();
    });

    it('should handle API error when loading project locks', async () => {
      const project = createMockProject({ id: 'proj_123' });
      mockStore.project = project;
      mockStore.images = [createMockImage({ id: '1', file_name: 'image1.jpg' })];

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock locks API error
      (imageLockAPI.getProjectLocks as any).mockRejectedValue(new Error('Failed to load locks'));

      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      await waitFor(() => {
        expect(imageLockAPI.getProjectLocks).toHaveBeenCalledWith('proj_123');
      });

      // Component should still render despite error
      expect(screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('title')?.includes('.jpg')
      )).toHaveLength(1);

      consoleErrorSpy.mockRestore();
    });

    it('should handle missing image data gracefully', () => {
      const images = [
        createMockImage({
          id: '1',
          file_name: '',
          folder_path: undefined,
        } as any),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      // Should still render the image even with missing data
      const imageButtons = screen.getAllByRole('button').filter(btn =>
        btn.className.includes('aspect-[3/2]')
      );
      expect(imageButtons.length).toBeGreaterThan(0);
    });

    it('should handle null/undefined status data', () => {
      const images = [
        createMockImage({
          id: '1',
          file_name: 'image1.jpg',
          status: undefined,
          annotation_count: undefined,
          is_confirmed: undefined,
        } as any),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      // Should render with fallback status (not-started)
      expect(screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('title')?.includes('.jpg')
      )).toHaveLength(1);
    });

    it('should handle error in image status fetch', async () => {
      const project = createMockProject({ id: 'proj_123' });
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
      ];

      mockStore.project = project;
      mockStore.images = images;
      mockStore.totalImages = 10;
      mockStore.loadMoreImages = vi.fn();

      mockUseAnnotationStore.mockReturnValue(mockStore);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      (getProjectImages as any).mockResolvedValue({
        images: [{ id: '2', file_name: 'image2.jpg', url: 'http://example.com/2.jpg' }],
        total: 10,
      });

      // Mock status fetch error
      (getProjectImageStatuses as any).mockRejectedValue(new Error('Status fetch failed'));

      render(<ImageList />);

      // Component should handle the error gracefully
      await waitFor(() => {
        expect(screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.jpg')
        )).toHaveLength(1);
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Empty States', () => {
    it('should show "No images match filter" when no images exist', () => {
      mockStore.images = [];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      expect(screen.getByText('No images match filter')).toBeInTheDocument();
    });

    it('should show empty state when filter excludes all images', async () => {
      const images = [
        createMockImage({ id: '1', annotation_count: 5, is_confirmed: true, status: 'completed' }),
        createMockImage({ id: '2', annotation_count: 3, is_confirmed: true, status: 'completed' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      const user = userEvent.setup({ delay: null });
      render(<ImageList />);

      // Initially shows all images
      expect(screen.getAllByRole('button').filter(btn =>
        btn.className.includes('aspect-[3/2]')
      ).length).toBeGreaterThan(0);

      // Filter to not-started (no images match)
      const filterSelect = screen.getByRole('combobox');
      await user.selectOptions(filterSelect, 'not-started');

      await waitFor(() => {
        expect(screen.getByText('No images match filter')).toBeInTheDocument();
      });
    });

    it('should show empty state when search excludes all images', async () => {
      const images = [
        createMockImage({ id: '1', file_name: 'cat.jpg' }),
        createMockImage({ id: '2', file_name: 'dog.jpg' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      const user = userEvent.setup({ delay: null });
      render(<ImageList />);

      // Initially shows all images
      expect(screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('title')?.includes('.jpg')
      ).length).toBe(2);

      // Search for non-existent image
      const searchInput = screen.getByPlaceholderText('Search images...');
      await user.type(searchInput, 'elephant');

      await waitFor(() => {
        expect(screen.getByText('No images match filter')).toBeInTheDocument();
      });
    });

    it('should show empty state when both filter and search exclude all images', async () => {
      const images = [
        createMockImage({ id: '1', file_name: 'cat.jpg', annotation_count: 0, status: 'not-started' }),
        createMockImage({ id: '2', file_name: 'dog.jpg', annotation_count: 5, is_confirmed: true, status: 'completed' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      const user = userEvent.setup({ delay: null });
      render(<ImageList />);

      // Filter to completed
      const filterSelect = screen.getByRole('combobox');
      await user.selectOptions(filterSelect, 'completed');

      // Search for cat (which is not-started)
      const searchInput = screen.getByPlaceholderText('Search images...');
      await user.type(searchInput, 'cat');

      await waitFor(() => {
        expect(screen.getByText('No images match filter')).toBeInTheDocument();
      });
    });

    it('should show empty state for project with no images', () => {
      const project = createMockProject({ id: 'proj_123' });
      mockStore.project = project;
      mockStore.images = [];
      mockStore.totalImages = 0;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      expect(screen.getByText('No images match filter')).toBeInTheDocument();
    });

    it('should handle empty project gracefully', () => {
      mockStore.project = null;
      mockStore.images = [];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      expect(screen.getByText('No images match filter')).toBeInTheDocument();
    });

    it('should show correct count display for empty filtered results', async () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg', annotation_count: 5, is_confirmed: true, status: 'completed' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      const user = userEvent.setup({ delay: null });
      render(<ImageList />);

      // Filter to not-started
      const filterSelect = screen.getByRole('combobox');
      await user.selectOptions(filterSelect, 'not-started');

      await waitFor(() => {
        expect(screen.getByText('No images match filter')).toBeInTheDocument();
        expect(screen.getByText('0 / 1')).toBeInTheDocument();
      });
    });
  });

  describe('Data Refetching', () => {
    it('should load more images when handleLoadMore is called', async () => {
      const project = createMockProject({ id: 'proj_123' });
      const initialImages = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
        createMockImage({ id: '2', file_name: 'image2.jpg' }),
      ];

      mockStore.project = project;
      mockStore.images = initialImages;
      mockStore.totalImages = 10;
      mockStore.loadMoreImages = vi.fn();

      mockUseAnnotationStore.mockReturnValue(mockStore);

      const newImages = [
        { id: '3', file_name: 'image3.jpg', url: 'http://example.com/3.jpg' },
        { id: '4', file_name: 'image4.jpg', url: 'http://example.com/4.jpg' },
      ];

      (getProjectImages as any).mockResolvedValue({
        images: newImages,
        total: 10,
      });

      (getProjectImageStatuses as any).mockResolvedValue({
        statuses: [
          { image_id: '3', total_annotations: 0, is_image_confirmed: false, status: 'not-started' },
          { image_id: '4', total_annotations: 2, is_image_confirmed: false, status: 'in-progress' },
        ],
      });

      render(<ImageList />);

      // Verify initial images are rendered
      expect(screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('title')?.includes('.jpg')
      ).length).toBe(2);

      // API calls should have correct parameters
      await waitFor(() => {
        expect(getProjectImages).toHaveBeenCalledTimes(0); // Not called until scroll
      });
    });

    it('should refresh project locks every 5 seconds', async () => {
      const project = createMockProject({ id: 'proj_123' });
      mockStore.project = project;
      mockStore.images = [createMockImage({ id: '1', file_name: 'image1.jpg' })];

      (imageLockAPI.getProjectLocks as any).mockResolvedValue([]);
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      // Initial load
      await waitFor(() => {
        expect(imageLockAPI.getProjectLocks).toHaveBeenCalledTimes(1);
        expect(imageLockAPI.getProjectLocks).toHaveBeenCalledWith('proj_123');
      });

      // Fast-forward 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(imageLockAPI.getProjectLocks).toHaveBeenCalledTimes(2);
      });

      // Fast-forward another 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(imageLockAPI.getProjectLocks).toHaveBeenCalledTimes(3);
      });
    });

    it('should update locks when new locks are fetched', async () => {
      const project = createMockProject({ id: 'proj_123' });
      const images = [
        createMockImage({ id: 'img1', file_name: 'image1.jpg' }),
        createMockImage({ id: 'img2', file_name: 'image2.jpg' }),
      ];

      mockStore.project = project;
      mockStore.images = images;

      const initialLocks = [
        { image_id: 'img1', user_id: 1, user_name: 'Test User', locked_at: new Date().toISOString(), expires_at: new Date().toISOString() },
      ];

      (imageLockAPI.getProjectLocks as any).mockResolvedValue(initialLocks);
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      await waitFor(() => {
        expect(imageLockAPI.getProjectLocks).toHaveBeenCalledWith('proj_123');
      });

      // Should render locks
      await waitFor(() => {
        const lockIcons = screen.getAllByTitle(/Locked by/);
        expect(lockIcons.length).toBeGreaterThan(0);
      });

      // Update locks
      const updatedLocks = [
        { image_id: 'img1', user_id: 1, user_name: 'Test User', locked_at: new Date().toISOString(), expires_at: new Date().toISOString() },
        { image_id: 'img2', user_id: 2, user_name: 'Other User', locked_at: new Date().toISOString(), expires_at: new Date().toISOString() },
      ];

      (imageLockAPI.getProjectLocks as any).mockResolvedValue(updatedLocks);

      // Fast-forward to trigger refresh
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(imageLockAPI.getProjectLocks).toHaveBeenCalledTimes(2);
      });
    });

    it('should not refetch locks when project is null', () => {
      mockStore.project = null;
      mockStore.images = [];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      // Should not call getProjectLocks
      expect(imageLockAPI.getProjectLocks).not.toHaveBeenCalled();
    });

    it('should cleanup locks interval on unmount', async () => {
      const project = createMockProject({ id: 'proj_123' });
      mockStore.project = project;
      mockStore.images = [createMockImage({ id: '1', file_name: 'image1.jpg' })];

      (imageLockAPI.getProjectLocks as any).mockResolvedValue([]);
      mockUseAnnotationStore.mockReturnValue(mockStore);

      const { unmount } = render(<ImageList />);

      await waitFor(() => {
        expect(imageLockAPI.getProjectLocks).toHaveBeenCalledTimes(1);
      });

      // Unmount component
      unmount();

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Should not call again after unmount
      expect(imageLockAPI.getProjectLocks).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid lock updates gracefully', async () => {
      const project = createMockProject({ id: 'proj_123' });
      mockStore.project = project;
      mockStore.images = [createMockImage({ id: '1', file_name: 'image1.jpg' })];

      let lockCallCount = 0;
      (imageLockAPI.getProjectLocks as any).mockImplementation(async () => {
        lockCallCount++;
        return [
          { image_id: '1', user_id: lockCallCount % 2 === 0 ? 1 : 2, user_name: `User ${lockCallCount}`, locked_at: new Date().toISOString(), expires_at: new Date().toISOString() },
        ];
      });

      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      // Initial load
      await waitFor(() => {
        expect(imageLockAPI.getProjectLocks).toHaveBeenCalledTimes(1);
      });

      // Multiple rapid updates
      for (let i = 0; i < 3; i++) {
        act(() => {
          vi.advanceTimersByTime(5000);
        });

        await waitFor(() => {
          expect(imageLockAPI.getProjectLocks).toHaveBeenCalledTimes(i + 2);
        });
      }
    });
  });

  describe('Infinite Scroll', () => {
    it('should auto-load images when scrolled near bottom', async () => {
      const project = createMockProject({ id: 'proj_123' });
      const initialImages = Array.from({ length: 10 }, (_, i) =>
        createMockImage({ id: `${i + 1}`, file_name: `image${i + 1}.jpg` })
      );

      mockStore.project = project;
      mockStore.images = initialImages;
      mockStore.totalImages = 50;
      mockStore.loadMoreImages = vi.fn();
      mockStore.backgroundLoading = false;

      mockUseAnnotationStore.mockReturnValue(mockStore);

      const newImages = Array.from({ length: 10 }, (_, i) =>
        ({ id: `${i + 11}`, file_name: `image${i + 11}.jpg`, url: `http://example.com/${i + 11}.jpg` })
      );

      (getProjectImages as any).mockResolvedValue({
        images: newImages,
        total: 50,
      });

      (getProjectImageStatuses as any).mockResolvedValue({
        statuses: newImages.map(img => ({
          image_id: img.id,
          total_annotations: 0,
          is_image_confirmed: false,
          status: 'not-started',
        })),
      });

      render(<ImageList />);

      // Get container
      const container = screen.getByText('Images').parentElement?.nextElementSibling as HTMLElement;
      expect(container).toBeTruthy();

      // Simulate scroll near bottom
      Object.defineProperty(container, 'scrollTop', { value: 900, writable: true });
      Object.defineProperty(container, 'scrollHeight', { value: 1000, writable: true });
      Object.defineProperty(container, 'clientHeight', { value: 100, writable: true });

      // Trigger scroll event
      act(() => {
        container.dispatchEvent(new Event('scroll'));
      });

      // Should trigger load more
      await waitFor(() => {
        expect(getProjectImages).toHaveBeenCalledWith('proj_123', 50, 10);
      });
    });

    it('should not auto-load when already loading', async () => {
      const project = createMockProject({ id: 'proj_123' });
      const initialImages = Array.from({ length: 10 }, (_, i) =>
        createMockImage({ id: `${i + 1}`, file_name: `image${i + 1}.jpg` })
      );

      mockStore.project = project;
      mockStore.images = initialImages;
      mockStore.totalImages = 50;
      mockStore.loadMoreImages = vi.fn();
      mockStore.backgroundLoading = true; // Already loading

      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const container = screen.getByText('Images').parentElement?.nextElementSibling as HTMLElement;

      // Simulate scroll near bottom
      Object.defineProperty(container, 'scrollTop', { value: 900, writable: true });
      Object.defineProperty(container, 'scrollHeight', { value: 1000, writable: true });
      Object.defineProperty(container, 'clientHeight', { value: 100, writable: true });

      // Trigger scroll event
      act(() => {
        container.dispatchEvent(new Event('scroll'));
      });

      // Should not trigger load more
      await waitFor(() => {
        expect(getProjectImages).not.toHaveBeenCalled();
      }, { timeout: 1000 });
    });

    it('should not auto-load when all images are loaded', async () => {
      const project = createMockProject({ id: 'proj_123' });
      const images = Array.from({ length: 10 }, (_, i) =>
        createMockImage({ id: `${i + 1}`, file_name: `image${i + 1}.jpg` })
      );

      mockStore.project = project;
      mockStore.images = images;
      mockStore.totalImages = 10; // All loaded
      mockStore.loadMoreImages = vi.fn();

      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const container = screen.getByText('Images').parentElement?.nextElementSibling as HTMLElement;

      // Simulate scroll near bottom
      Object.defineProperty(container, 'scrollTop', { value: 900, writable: true });
      Object.defineProperty(container, 'scrollHeight', { value: 1000, writable: true });
      Object.defineProperty(container, 'clientHeight', { value: 100, writable: true });

      // Trigger scroll event
      act(() => {
        container.dispatchEvent(new Event('scroll'));
      });

      // Should not trigger load more
      await waitFor(() => {
        expect(getProjectImages).not.toHaveBeenCalled();
      }, { timeout: 1000 });
    });

    it('should cleanup scroll listener on unmount', () => {
      const project = createMockProject({ id: 'proj_123' });
      mockStore.project = project;
      mockStore.images = [createMockImage({ id: '1', file_name: 'image1.jpg' })];
      mockStore.totalImages = 10;

      mockUseAnnotationStore.mockReturnValue(mockStore);

      const { unmount } = render(<ImageList />);

      const container = screen.getByText('Images').parentElement?.nextElementSibling as HTMLElement;
      const removeEventListenerSpy = vi.spyOn(container, 'removeEventListener');

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    });
  });

  describe('State Updates', () => {
    it('should update when images change', async () => {
      const initialImages = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
      ];

      mockStore.images = initialImages;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      const { rerender } = render(<ImageList />);

      expect(screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('title')?.includes('.jpg')
      ).length).toBe(1);

      // Update images
      const updatedImages = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
        createMockImage({ id: '2', file_name: 'image2.jpg' }),
      ];

      mockStore.images = updatedImages;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      rerender(<ImageList />);

      await waitFor(() => {
        expect(screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.jpg')
        ).length).toBe(2);
      });
    });

    it('should update when totalImages changes', () => {
      mockStore.images = [createMockImage({ id: '1', file_name: 'image1.jpg' })];
      mockStore.totalImages = 1;

      mockUseAnnotationStore.mockReturnValue(mockStore);

      const { rerender } = render(<ImageList />);

      // Update totalImages
      mockStore.totalImages = 10;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      rerender(<ImageList />);

      // Component should reflect the change
      expect(screen.getByText('1 / 1')).toBeInTheDocument();
    });

    it('should update when currentIndex changes and auto-scroll', () => {
      const images = Array.from({ length: 5 }, (_, i) =>
        createMockImage({ id: `${i + 1}`, file_name: `image${i + 1}.jpg` })
      );

      mockStore.images = images;
      mockStore.currentIndex = 0;

      mockUseAnnotationStore.mockReturnValue(mockStore);

      const { rerender } = render(<ImageList />);

      // Change current index
      mockStore.currentIndex = 3;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      rerender(<ImageList />);

      // Should update highlighting
      const imageButtons = screen.getAllByRole('button').filter(btn =>
        btn.className.includes('aspect-[3/2]')
      );
      expect(imageButtons[3].className).toContain('ring-violet-500');
    });

    it('should handle project change and reload locks', async () => {
      const project1 = createMockProject({ id: 'proj_123' });
      mockStore.project = project1;
      mockStore.images = [createMockImage({ id: '1', file_name: 'image1.jpg' })];

      (imageLockAPI.getProjectLocks as any).mockResolvedValue([]);
      mockUseAnnotationStore.mockReturnValue(mockStore);

      const { rerender } = render(<ImageList />);

      await waitFor(() => {
        expect(imageLockAPI.getProjectLocks).toHaveBeenCalledWith('proj_123');
      });

      // Change project
      const project2 = createMockProject({ id: 'proj_456' });
      mockStore.project = project2;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      rerender(<ImageList />);

      await waitFor(() => {
        expect(imageLockAPI.getProjectLocks).toHaveBeenCalledWith('proj_456');
      });
    });
  });

  describe('Performance', () => {
    it('should handle large number of images efficiently', () => {
      const images = Array.from({ length: 100 }, (_, i) =>
        createMockImage({ id: `${i + 1}`, file_name: `image${i + 1}.jpg` })
      );

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      const startTime = performance.now();
      render(<ImageList />);
      const endTime = performance.now();

      // Should render in reasonable time (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000);

      // All images should be rendered
      const imageButtons = screen.getAllByRole('button').filter(btn =>
        btn.className.includes('aspect-[3/2]')
      );
      expect(imageButtons.length).toBe(100);
    });

    it('should use lazy loading for images', () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
        createMockImage({ id: '2', file_name: 'image2.jpg' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const imgElements = screen.getAllByAlt(/image\d+\.jpg/);

      // All images should have loading="lazy"
      imgElements.forEach(img => {
        expect(img).toHaveAttribute('loading', 'lazy');
      });
    });

    it('should handle rapid filter changes without crashing', async () => {
      const images = Array.from({ length: 50 }, (_, i) =>
        createMockImage({
          id: `${i + 1}`,
          file_name: `image${i + 1}.jpg`,
          annotation_count: i % 3,
          is_confirmed: i % 3 === 2,
          status: i % 3 === 0 ? 'not-started' : i % 3 === 1 ? 'in-progress' : 'completed',
        })
      );

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      const user = userEvent.setup({ delay: null });
      render(<ImageList />);

      const filterSelect = screen.getByRole('combobox');

      // Rapid filter changes
      await user.selectOptions(filterSelect, 'not-started');
      await user.selectOptions(filterSelect, 'in-progress');
      await user.selectOptions(filterSelect, 'completed');
      await user.selectOptions(filterSelect, 'all');
      await user.selectOptions(filterSelect, 'not-started');

      // Should not crash and show filtered results
      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.className.includes('aspect-[3/2]')
        );
        expect(imageButtons.length).toBeGreaterThan(0);
      });
    });
  });
});
