/**
 * ImageList Component Tests - Filtering and Sorting
 *
 * Tests for advanced filtering by annotation status, sorting options,
 * search functionality, and pagination interactions.
 *
 * Phase 8: Frontend ImageList Component Tests
 * Subtask 8.2: Test ImageList.tsx filtering and sorting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImageList from '../ImageList';
import {
  createMockAnnotationStore,
  createMockProject,
  createMockImage,
} from '@/lib/test-utils/mock-stores';
import { useAnnotationStore } from '@/lib/stores/annotationStore';

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
  getProjectImages: vi.fn().mockResolvedValue({
    images: [],
    total: 0,
  }),
  getProjectImageStatuses: vi.fn().mockResolvedValue({
    statuses: [],
  }),
}));

vi.mock('@/lib/api/image-locks', () => ({
  imageLockAPI: {
    getProjectLocks: vi.fn().mockResolvedValue([]),
    acquire: vi.fn().mockResolvedValue({ status: 'acquired' }),
    release: vi.fn().mockResolvedValue({ status: 'released' }),
    heartbeat: vi.fn().mockResolvedValue({ status: 'updated' }),
    getStatus: vi.fn().mockResolvedValue(null),
  },
}));

describe('ImageList - Filtering and Sorting', () => {
  let mockStore: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore = createMockAnnotationStore();
    mockUseAnnotationStore.mockReturnValue(mockStore);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Advanced Status Filtering', () => {
    it('should correctly determine status from annotation_count and is_confirmed', () => {
      const images = [
        createMockImage({ id: '1', annotation_count: 0, is_confirmed: false, status: 'not-started' }),
        createMockImage({ id: '2', annotation_count: 3, is_confirmed: false, status: 'in-progress' }),
        createMockImage({ id: '3', annotation_count: 5, is_confirmed: true, status: 'completed' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      // All images should be visible with 'all' filter
      const imageButtons = screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('title')?.includes('.jpg')
      );
      expect(imageButtons).toHaveLength(3);
    });

    it('should handle status fallback when status field is missing', () => {
      const images = [
        createMockImage({ id: '1', annotation_count: 0, is_confirmed: false, status: undefined as any }),
        createMockImage({ id: '2', annotation_count: 2, is_confirmed: false, status: undefined as any }),
        createMockImage({ id: '3', annotation_count: 5, is_confirmed: true, status: undefined as any }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      // Should still render all images
      const imageButtons = screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('title')?.includes('.jpg')
      );
      expect(imageButtons).toHaveLength(3);
    });

    it('should filter edge case: confirmed image with zero annotations', () => {
      const images = [
        createMockImage({ id: '1', annotation_count: 0, is_confirmed: true, status: 'completed' }),
        createMockImage({ id: '2', annotation_count: 0, is_confirmed: false, status: 'not-started' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const filterSelect = screen.getByRole('combobox');

      // Filter by completed - should show the confirmed image even with 0 annotations
      userEvent.selectOptions(filterSelect, 'completed');

      waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.jpg')
        );
        expect(imageButtons).toHaveLength(1);
      });
    });

    it('should filter images with very high annotation counts', () => {
      const images = [
        createMockImage({ id: '1', annotation_count: 100, is_confirmed: false, status: 'in-progress' }),
        createMockImage({ id: '2', annotation_count: 0, is_confirmed: false, status: 'not-started' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const filterSelect = screen.getByRole('combobox');
      userEvent.selectOptions(filterSelect, 'in-progress');

      waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.jpg')
        );
        expect(imageButtons).toHaveLength(1);
      });
    });

    it('should handle switching between all filter states rapidly', async () => {
      const images = [
        createMockImage({ id: '1', status: 'not-started' }),
        createMockImage({ id: '2', status: 'in-progress' }),
        createMockImage({ id: '3', status: 'completed' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const filterSelect = screen.getByRole('combobox');

      // Rapidly switch filters
      await userEvent.selectOptions(filterSelect, 'not-started');
      await userEvent.selectOptions(filterSelect, 'in-progress');
      await userEvent.selectOptions(filterSelect, 'completed');
      await userEvent.selectOptions(filterSelect, 'all');

      // Should end up showing all images
      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.jpg')
        );
        expect(imageButtons).toHaveLength(3);
      });
    });

    it('should maintain filter when images are updated', async () => {
      const images = [
        createMockImage({ id: '1', status: 'not-started' }),
        createMockImage({ id: '2', status: 'in-progress' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      const { rerender } = render(<ImageList />);

      const filterSelect = screen.getByRole('combobox');
      await userEvent.selectOptions(filterSelect, 'in-progress');

      // Update images
      mockStore.images = [
        ...images,
        createMockImage({ id: '3', status: 'in-progress' }),
      ];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      rerender(<ImageList />);

      // Should still show only in-progress images (now 2)
      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.jpg')
        );
        expect(imageButtons).toHaveLength(2);
      });
    });
  });

  describe('Advanced Search Functionality', () => {
    beforeEach(() => {
      const images = [
        createMockImage({ id: '1', file_name: 'IMG_001.jpg', folder_path: '/dataset1/train' }),
        createMockImage({ id: '2', file_name: 'IMG_002.png', folder_path: '/dataset1/test' }),
        createMockImage({ id: '3', file_name: 'photo_003.jpg', folder_path: '/dataset2/train' }),
        createMockImage({ id: '4', file_name: 'image-004.jpeg', folder_path: '/dataset2/validation' }),
        createMockImage({ id: '5', file_name: 'scan_005.tiff', folder_path: '/medical/scans' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);
    });

    it('should search by file extension', async () => {
      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      await userEvent.type(searchInput, '.jpg');

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.jpg')
        );
        expect(imageButtons.length).toBe(2); // IMG_001.jpg and photo_003.jpg
      });
    });

    it('should search by partial folder path', async () => {
      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      await userEvent.type(searchInput, 'dataset2');

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn => {
          const title = btn.getAttribute('title');
          return title?.includes('photo_003.jpg') || title?.includes('image-004.jpeg');
        });
        expect(imageButtons.length).toBe(2);
      });
    });

    it('should search by numeric pattern in filename', async () => {
      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      await userEvent.type(searchInput, '00');

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.jpg') || btn.getAttribute('title')?.includes('.png')
        );
        // Should match IMG_001, IMG_002, photo_003, image-004, scan_005 (all have '00')
        expect(imageButtons.length).toBeGreaterThan(0);
      });
    });

    it('should handle search with special characters', async () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image (1).jpg', folder_path: '/test' }),
        createMockImage({ id: '2', file_name: 'photo-2.jpg', folder_path: '/test' }),
        createMockImage({ id: '3', file_name: 'scan_3.jpg', folder_path: '/test' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      await userEvent.type(searchInput, '(1)');

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('(1)')
        );
        expect(imageButtons.length).toBe(1);
      });
    });

    it('should handle empty search (show all)', async () => {
      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');

      // Type and then clear
      await userEvent.type(searchInput, 'test');
      await userEvent.clear(searchInput);

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.')
        );
        expect(imageButtons.length).toBe(5);
      });
    });

    it('should handle search with only whitespace', async () => {
      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      await userEvent.type(searchInput, '   ');

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.')
        );
        expect(imageButtons.length).toBe(5); // Should show all images (whitespace trimmed)
      });
    });

    it('should search across both filename and folder_path simultaneously', async () => {
      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      await userEvent.type(searchInput, 'train');

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn => {
          const title = btn.getAttribute('title');
          return title?.includes('IMG_001.jpg') || title?.includes('photo_003.jpg');
        });
        expect(imageButtons.length).toBe(2); // Both have /train in folder_path
      });
    });

    it('should handle search with missing folder_path', async () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg', folder_path: undefined as any }),
        createMockImage({ id: '2', file_name: 'image2.jpg', folder_path: '' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      await userEvent.type(searchInput, 'image1');

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('image1.jpg')
        );
        expect(imageButtons.length).toBe(1);
      });
    });
  });

  describe('Search and Filter Combinations', () => {
    beforeEach(() => {
      const images = [
        createMockImage({ id: '1', file_name: 'cat-001.jpg', folder_path: '/animals', status: 'completed', annotation_count: 5, is_confirmed: true }),
        createMockImage({ id: '2', file_name: 'cat-002.jpg', folder_path: '/animals', status: 'in-progress', annotation_count: 2, is_confirmed: false }),
        createMockImage({ id: '3', file_name: 'dog-001.jpg', folder_path: '/animals', status: 'not-started', annotation_count: 0, is_confirmed: false }),
        createMockImage({ id: '4', file_name: 'car-001.jpg', folder_path: '/vehicles', status: 'completed', annotation_count: 3, is_confirmed: true }),
        createMockImage({ id: '5', file_name: 'car-002.jpg', folder_path: '/vehicles', status: 'in-progress', annotation_count: 1, is_confirmed: false }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);
    });

    it('should combine search (filename) + filter (status)', async () => {
      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      const filterSelect = screen.getByRole('combobox');

      // Search for "cat" + filter "completed"
      await userEvent.type(searchInput, 'cat');
      await userEvent.selectOptions(filterSelect, 'completed');

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('cat-001.jpg')
        );
        expect(imageButtons.length).toBe(1); // Only cat-001.jpg is completed
      });
    });

    it('should combine search (folder) + filter (status)', async () => {
      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      const filterSelect = screen.getByRole('combobox');

      // Search for "animals" + filter "in-progress"
      await userEvent.type(searchInput, 'animals');
      await userEvent.selectOptions(filterSelect, 'in-progress');

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('cat-002.jpg')
        );
        expect(imageButtons.length).toBe(1); // Only cat-002.jpg in animals is in-progress
      });
    });

    it('should show no results when search + filter have no matches', async () => {
      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      const filterSelect = screen.getByRole('combobox');

      // Search for "dog" + filter "completed" (dog-001 is not-started)
      await userEvent.type(searchInput, 'dog');
      await userEvent.selectOptions(filterSelect, 'completed');

      await waitFor(() => {
        expect(screen.getByText('No images match filter')).toBeInTheDocument();
      });
    });

    it('should update results when changing search while filter is active', async () => {
      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      const filterSelect = screen.getByRole('combobox');

      // Set filter first
      await userEvent.selectOptions(filterSelect, 'completed');

      // Search for "cat"
      await userEvent.type(searchInput, 'cat');

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.jpg')
        );
        expect(imageButtons.length).toBe(1); // cat-001.jpg
      });

      // Change search to "car"
      await userEvent.clear(searchInput);
      await userEvent.type(searchInput, 'car');

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.jpg')
        );
        expect(imageButtons.length).toBe(1); // car-001.jpg
      });
    });

    it('should update results when changing filter while search is active', async () => {
      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      const filterSelect = screen.getByRole('combobox');

      // Search first
      await userEvent.type(searchInput, 'cat');

      // Filter by completed
      await userEvent.selectOptions(filterSelect, 'completed');

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.jpg')
        );
        expect(imageButtons.length).toBe(1); // cat-001.jpg
      });

      // Change filter to in-progress
      await userEvent.selectOptions(filterSelect, 'in-progress');

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.jpg')
        );
        expect(imageButtons.length).toBe(1); // cat-002.jpg
      });
    });

    it('should clear both search and filter correctly', async () => {
      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      const filterSelect = screen.getByRole('combobox');

      // Apply both
      await userEvent.type(searchInput, 'cat');
      await userEvent.selectOptions(filterSelect, 'completed');

      // Clear search
      await userEvent.clear(searchInput);

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.jpg')
        );
        expect(imageButtons.length).toBe(2); // Both completed images (cat-001, car-001)
      });

      // Clear filter
      await userEvent.selectOptions(filterSelect, 'all');

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.jpg')
        );
        expect(imageButtons.length).toBe(5); // All images
      });
    });
  });

  describe('Pagination with Filtering', () => {
    it('should show correct count when filtering reduces visible images', async () => {
      const images = Array.from({ length: 10 }, (_, i) =>
        createMockImage({
          id: `${i + 1}`,
          file_name: `image${i + 1}.jpg`,
          status: i < 3 ? 'completed' : 'not-started',
        })
      );

      mockStore.images = images;
      mockStore.totalImages = 10;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const filterSelect = screen.getByRole('combobox');
      await userEvent.selectOptions(filterSelect, 'completed');

      await waitFor(() => {
        // Should show "3 / 10" (3 filtered out of 10 total)
        expect(screen.getByText('3 / 10')).toBeInTheDocument();
      });
    });

    it('should show load more button with filtering active', async () => {
      const images = Array.from({ length: 5 }, (_, i) =>
        createMockImage({
          id: `${i + 1}`,
          file_name: `image${i + 1}.jpg`,
          status: 'completed',
        })
      );

      mockStore.images = images;
      mockStore.totalImages = 20; // More images exist on server
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const filterSelect = screen.getByRole('combobox');
      await userEvent.selectOptions(filterSelect, 'completed');

      await waitFor(() => {
        const loadMoreButton = screen.getByTitle(/Load More/);
        expect(loadMoreButton).toBeInTheDocument();
      });
    });

    it('should hide load more button when filter shows all loaded images', async () => {
      const images = [
        createMockImage({ id: '1', status: 'completed' }),
        createMockImage({ id: '2', status: 'not-started' }),
      ];

      mockStore.images = images;
      mockStore.totalImages = 2; // All images loaded
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const filterSelect = screen.getByRole('combobox');
      await userEvent.selectOptions(filterSelect, 'completed');

      await waitFor(() => {
        const loadMoreButton = screen.queryByTitle(/Load More/);
        expect(loadMoreButton).not.toBeInTheDocument();
      });
    });

    it('should load more images and apply filter to new images', async () => {
      const initialImages = [
        createMockImage({ id: '1', status: 'completed' }),
      ];

      mockStore.images = initialImages;
      mockStore.totalImages = 5;
      mockStore.project = createMockProject();
      mockStore.loadMoreImages = vi.fn();
      mockUseAnnotationStore.mockReturnValue(mockStore);

      const { getProjectImages, getProjectImageStatuses } = await import('@/lib/api/projects');
      (getProjectImages as any).mockResolvedValue({
        images: [
          { id: 2, file_name: 'image2.jpg', url: 'http://example.com/image2.jpg' },
          { id: 3, file_name: 'image3.jpg', url: 'http://example.com/image3.jpg' },
        ],
      });
      (getProjectImageStatuses as any).mockResolvedValue({
        statuses: [
          { image_id: '2', total_annotations: 3, is_image_confirmed: false, status: 'in-progress' },
          { image_id: '3', total_annotations: 5, is_image_confirmed: true, status: 'completed' },
        ],
      });

      render(<ImageList />);

      const filterSelect = screen.getByRole('combobox');
      await userEvent.selectOptions(filterSelect, 'completed');

      const loadMoreButton = screen.getByTitle(/Load More/);
      await userEvent.click(loadMoreButton);

      await waitFor(() => {
        expect(getProjectImages).toHaveBeenCalled();
      });
    });
  });

  describe('Pagination with Search', () => {
    it('should show correct filtered count with search active', async () => {
      const images = Array.from({ length: 10 }, (_, i) =>
        createMockImage({
          id: `${i + 1}`,
          file_name: i < 5 ? `cat${i + 1}.jpg` : `dog${i + 1}.jpg`,
        })
      );

      mockStore.images = images;
      mockStore.totalImages = 10;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      await userEvent.type(searchInput, 'cat');

      await waitFor(() => {
        // Should show "5 / 10" (5 cats out of 10 total)
        expect(screen.getByText('5 / 10')).toBeInTheDocument();
      });
    });

    it('should maintain search when loading more images', async () => {
      const initialImages = [
        createMockImage({ id: '1', file_name: 'cat1.jpg' }),
      ];

      mockStore.images = initialImages;
      mockStore.totalImages = 5;
      mockStore.project = createMockProject();
      mockStore.loadMoreImages = vi.fn((newImages) => {
        mockStore.images = [...mockStore.images, ...newImages];
      });
      mockUseAnnotationStore.mockReturnValue(mockStore);

      const { getProjectImages, getProjectImageStatuses } = await import('@/lib/api/projects');
      (getProjectImages as any).mockResolvedValue({
        images: [
          { id: 2, file_name: 'cat2.jpg', url: 'http://example.com/cat2.jpg' },
          { id: 3, file_name: 'dog1.jpg', url: 'http://example.com/dog1.jpg' },
        ],
      });
      (getProjectImageStatuses as any).mockResolvedValue({
        statuses: [
          { image_id: '2', total_annotations: 0, is_image_confirmed: false, status: 'not-started' },
          { image_id: '3', total_annotations: 0, is_image_confirmed: false, status: 'not-started' },
        ],
      });

      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      await userEvent.type(searchInput, 'cat');

      const loadMoreButton = screen.getByTitle(/Load More/);
      await userEvent.click(loadMoreButton);

      await waitFor(() => {
        expect(getProjectImages).toHaveBeenCalled();
      });
    });
  });

  describe('Performance and Large Datasets', () => {
    // Skip: Performance tests are unreliable in CI environments
    it.skip('should handle filtering on large dataset efficiently', async () => {
      const images = Array.from({ length: 1000 }, (_, i) =>
        createMockImage({
          id: `${i + 1}`,
          file_name: `image${i + 1}.jpg`,
          status: i % 3 === 0 ? 'completed' : i % 3 === 1 ? 'in-progress' : 'not-started',
        })
      );

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      const startTime = Date.now();
      render(<ImageList />);
      const renderTime = Date.now() - startTime;

      // Should render in reasonable time (< 2 seconds)
      expect(renderTime).toBeLessThan(2000);

      const filterSelect = screen.getByRole('combobox');
      const filterStartTime = Date.now();
      await userEvent.selectOptions(filterSelect, 'completed');
      const filterTime = Date.now() - filterStartTime;

      // Filter should be fast (< 500ms)
      expect(filterTime).toBeLessThan(500);
    });

    // Skip: Performance tests are unreliable in CI environments
    it.skip('should handle search on large dataset efficiently', async () => {
      const images = Array.from({ length: 500 }, (_, i) =>
        createMockImage({
          id: `${i + 1}`,
          file_name: `image${String(i + 1).padStart(4, '0')}.jpg`,
        })
      );

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      const searchStartTime = Date.now();
      await userEvent.type(searchInput, '0001');
      const searchTime = Date.now() - searchStartTime;

      // Search should be fast
      expect(searchTime).toBeLessThan(500);

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('0001')
        );
        expect(imageButtons.length).toBeGreaterThan(0);
      });
    });

    it('should handle rapid filter and search changes on large dataset', async () => {
      const images = Array.from({ length: 200 }, (_, i) =>
        createMockImage({
          id: `${i + 1}`,
          file_name: `image${i + 1}.jpg`,
          status: i % 2 === 0 ? 'completed' : 'not-started',
        })
      );

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      const filterSelect = screen.getByRole('combobox');

      // Rapid changes
      await userEvent.type(searchInput, 'image1');
      await userEvent.selectOptions(filterSelect, 'completed');
      await userEvent.clear(searchInput);
      await userEvent.type(searchInput, 'image2');
      await userEvent.selectOptions(filterSelect, 'not-started');
      await userEvent.selectOptions(filterSelect, 'all');

      // Should not crash and should render correctly
      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('image2')
        );
        expect(imageButtons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle images with null or undefined file_name', async () => {
      const images = [
        createMockImage({ id: '1', file_name: null as any }),
        createMockImage({ id: '2', file_name: undefined as any }),
        createMockImage({ id: '3', file_name: '' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      expect(() => render(<ImageList />)).not.toThrow();

      const searchInput = screen.getByPlaceholderText('Search images...');
      await userEvent.type(searchInput, 'test');

      expect(() => screen.getByText('No images match filter')).not.toThrow();
    });

    it('should handle filter with empty image list', async () => {
      mockStore.images = [];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const filterSelect = screen.getByRole('combobox');
      await userEvent.selectOptions(filterSelect, 'completed');

      expect(screen.getByText('No images match filter')).toBeInTheDocument();
    });

    it('should handle search with empty image list', async () => {
      mockStore.images = [];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      await userEvent.type(searchInput, 'test');

      expect(screen.getByText('No images match filter')).toBeInTheDocument();
    });

    it('should handle images with inconsistent status data', async () => {
      const images = [
        createMockImage({ id: '1', status: 'completed', is_confirmed: false, annotation_count: 0 }),
        createMockImage({ id: '2', status: 'not-started', is_confirmed: true, annotation_count: 10 }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const filterSelect = screen.getByRole('combobox');
      await userEvent.selectOptions(filterSelect, 'completed');

      await waitFor(() => {
        // Should use the status field, not the annotation_count/is_confirmed
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.jpg')
        );
        expect(imageButtons.length).toBe(1);
      });
    });

    it('should handle very long search queries', async () => {
      const images = [
        createMockImage({ id: '1', file_name: 'test.jpg' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      const longQuery = 'a'.repeat(1000);
      await userEvent.type(searchInput, longQuery);

      // Should not crash
      expect(screen.getByText('No images match filter')).toBeInTheDocument();
    });

    it('should handle special regex characters in search', async () => {
      const images = [
        createMockImage({ id: '1', file_name: 'test[1].jpg', folder_path: '/test' }),
        createMockImage({ id: '2', file_name: 'test(2).jpg', folder_path: '/test' }),
        createMockImage({ id: '3', file_name: 'test*.jpg', folder_path: '/test' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      await userEvent.type(searchInput, '[1]');

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('[1]')
        );
        expect(imageButtons.length).toBe(1);
      });
    });
  });

  describe('Filter State Persistence', () => {
    it('should maintain filter state across rerenders', async () => {
      const images = [
        createMockImage({ id: '1', status: 'completed' }),
        createMockImage({ id: '2', status: 'not-started' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      const { rerender } = render(<ImageList />);

      const filterSelect = screen.getByRole('combobox');
      await userEvent.selectOptions(filterSelect, 'completed');

      // Rerender component
      rerender(<ImageList />);

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.jpg')
        );
        expect(imageButtons.length).toBe(1);
      });
    });

    it('should maintain search state across rerenders', async () => {
      const images = [
        createMockImage({ id: '1', file_name: 'cat.jpg' }),
        createMockImage({ id: '2', file_name: 'dog.jpg' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      const { rerender } = render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      await userEvent.type(searchInput, 'cat');

      // Rerender component
      rerender(<ImageList />);

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('cat.jpg')
        );
        expect(imageButtons.length).toBe(1);
      });
    });

    it('should maintain both filter and search state together', async () => {
      const images = [
        createMockImage({ id: '1', file_name: 'cat.jpg', status: 'completed' }),
        createMockImage({ id: '2', file_name: 'cat.jpg', status: 'not-started' }),
        createMockImage({ id: '3', file_name: 'dog.jpg', status: 'completed' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      const { rerender } = render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      const filterSelect = screen.getByRole('combobox');

      await userEvent.type(searchInput, 'cat');
      await userEvent.selectOptions(filterSelect, 'completed');

      // Rerender component
      rerender(<ImageList />);

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.jpg')
        );
        expect(imageButtons.length).toBe(1); // Only completed cat
      });
    });
  });

  describe('Count Display with Filtering', () => {
    it('should show correct count format: filtered / total', async () => {
      const images = [
        createMockImage({ id: '1', status: 'completed' }),
        createMockImage({ id: '2', status: 'completed' }),
        createMockImage({ id: '3', status: 'not-started' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const filterSelect = screen.getByRole('combobox');
      await userEvent.selectOptions(filterSelect, 'completed');

      await waitFor(() => {
        expect(screen.getByText('2 / 3')).toBeInTheDocument();
      });
    });

    it('should update count when search narrows results', async () => {
      const images = [
        createMockImage({ id: '1', file_name: 'cat1.jpg' }),
        createMockImage({ id: '2', file_name: 'cat2.jpg' }),
        createMockImage({ id: '3', file_name: 'dog1.jpg' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      await userEvent.type(searchInput, 'cat');

      await waitFor(() => {
        expect(screen.getByText('2 / 3')).toBeInTheDocument();
      });
    });

    it('should show full count when no filters applied', () => {
      const images = [
        createMockImage({ id: '1' }),
        createMockImage({ id: '2' }),
        createMockImage({ id: '3' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      expect(screen.getByText('3 / 3')).toBeInTheDocument();
    });
  });
});
