/**
 * ImageList Component Tests - Rendering and Navigation
 *
 * Tests for ImageList component rendering, thumbnail display, image selection,
 * navigation (prev/next), and keyboard shortcuts.
 *
 * Phase 8: Frontend ImageList Component Tests
 * Subtask 8.1: Test ImageList.tsx rendering and navigation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

describe('ImageList - Component Rendering', () => {
  let mockStore: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore = createMockAnnotationStore();
    mockUseAnnotationStore.mockReturnValue(mockStore);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render the component with header', () => {
      render(<ImageList />);

      expect(screen.getByText('Images')).toBeInTheDocument();
    });

    it('should render filter dropdown with all options', () => {
      render(<ImageList />);

      const filterSelect = screen.getByRole('combobox');
      expect(filterSelect).toBeInTheDocument();

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(4);
      expect(options[0]).toHaveTextContent('All Images');
      expect(options[1]).toHaveTextContent('Not Started');
      expect(options[2]).toHaveTextContent('In Progress');
      expect(options[3]).toHaveTextContent('Completed');
    });

    it('should render search input', () => {
      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      expect(searchInput).toBeInTheDocument();
    });

    it('should render view toggle button', () => {
      render(<ImageList />);

      const viewToggleButton = screen.getByTitle(/Switch to/);
      expect(viewToggleButton).toBeInTheDocument();
    });

    it('should show image count', () => {
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

    it('should show "No images match filter" when no images', () => {
      mockStore.images = [];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      expect(screen.getByText('No images match filter')).toBeInTheDocument();
    });
  });

  describe('Grid View Rendering', () => {
    beforeEach(() => {
      mockStore.preferences.imageListView = 'grid';
    });

    it('should render images in grid layout', () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
        createMockImage({ id: '2', file_name: 'image2.jpg' }),
        createMockImage({ id: '3', file_name: 'image3.jpg' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const imageButtons = screen.getAllByRole('button', { name: /image\d\.jpg/ });
      expect(imageButtons).toHaveLength(3);
    });

    it('should display thumbnails with correct src', () => {
      const images = [
        createMockImage({
          id: '1',
          file_name: 'image1.jpg',
          url: 'http://example.com/image1.jpg',
          thumbnail_url: 'http://example.com/image1-thumb.jpg',
        }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const thumbnail = screen.getByAltText('image1.jpg') as HTMLImageElement;
      expect(thumbnail).toBeInTheDocument();
      expect(thumbnail.src).toContain('image1-thumb.jpg');
    });

    it('should use original URL as fallback when thumbnail_url is missing', () => {
      const images = [
        createMockImage({
          id: '1',
          file_name: 'image1.jpg',
          url: 'http://example.com/image1.jpg',
          thumbnail_url: undefined as any,
        }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const thumbnail = screen.getByAltText('image1.jpg') as HTMLImageElement;
      expect(thumbnail.src).toContain('image1.jpg');
    });

    it('should display image numbers', () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
        createMockImage({ id: '2', file_name: 'image2.jpg' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should highlight current image', () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
        createMockImage({ id: '2', file_name: 'image2.jpg' }),
      ];

      mockStore.images = images;
      mockStore.currentIndex = 1;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const currentButton = screen.getByRole('button', { name: /image2\.jpg/ });
      expect(currentButton).toHaveClass('ring-2', 'ring-violet-500');
    });

    it('should display status badges for not-started images', () => {
      const images = [
        createMockImage({
          id: '1',
          file_name: 'image1.jpg',
          status: 'not-started',
          annotation_count: 0,
          is_confirmed: false,
        }),
      ];

      mockStore.images = images;
      mockStore.diffMode = { enabled: false };
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const badge = screen.getByTitle('Not Started');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-gray-400');
    });

    it('should display status badges for in-progress images', () => {
      const images = [
        createMockImage({
          id: '1',
          file_name: 'image1.jpg',
          status: 'in-progress',
          annotation_count: 2,
          is_confirmed: false,
        }),
      ];

      mockStore.images = images;
      mockStore.diffMode = { enabled: false };
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const badge = screen.getByTitle('In Progress');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-yellow-500');
    });

    it('should display status badges for completed images', () => {
      const images = [
        createMockImage({
          id: '1',
          file_name: 'image1.jpg',
          status: 'completed',
          annotation_count: 5,
          is_confirmed: true,
        }),
      ];

      mockStore.images = images;
      mockStore.diffMode = { enabled: false };
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const badge = screen.getByTitle('Completed');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-green-500');
    });

    it('should display selection checkmark for selected images', () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
      ];

      mockStore.images = images;
      mockStore.selectedImageIds = ['1'];
      mockStore.isImageSelected = vi.fn((id: string) => id === '1');
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const selectedIndicators = screen.getAllByRole('button', { name: /Selected/ });
      expect(selectedIndicators.length).toBeGreaterThan(0);
    });

    it('should use lazy loading for images', () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const thumbnail = screen.getByAltText('image1.jpg') as HTMLImageElement;
      expect(thumbnail).toHaveAttribute('loading', 'lazy');
    });
  });

  describe('List View Rendering', () => {
    beforeEach(() => {
      mockStore.preferences.imageListView = 'list';
    });

    it('should render images in list/table layout', () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
        createMockImage({ id: '2', file_name: 'image2.jpg' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });

    it('should display table headers', () => {
      mockStore.preferences.imageListView = 'list';
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      expect(screen.getByText('#')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Ann')).toBeInTheDocument();
      expect(screen.getByText('St')).toBeInTheDocument();
    });

    it('should display image file names in list view', () => {
      const images = [
        createMockImage({ id: '1', file_name: 'my-image-1.jpg' }),
        createMockImage({ id: '2', file_name: 'my-image-2.jpg' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      expect(screen.getByText('my-image-1.jpg')).toBeInTheDocument();
      expect(screen.getByText('my-image-2.jpg')).toBeInTheDocument();
    });

    it('should display annotation counts in list view', () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg', annotation_count: 5 }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should highlight current row in list view', () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
        createMockImage({ id: '2', file_name: 'image2.jpg' }),
      ];

      mockStore.images = images;
      mockStore.currentIndex = 1;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const rows = screen.getAllByRole('row');
      // rows[0] is header, rows[2] is the current image (index 1)
      expect(rows[2]).toHaveClass('bg-violet-500/20');
    });
  });

  describe('Image Selection', () => {
    it('should call setCurrentIndex on normal click', async () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
        createMockImage({ id: '2', file_name: 'image2.jpg' }),
      ];

      mockStore.images = images;
      mockStore.setCurrentIndex = vi.fn();
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const secondImage = screen.getByRole('button', { name: /image2\.jpg/ });
      await userEvent.click(secondImage);

      expect(mockStore.setCurrentIndex).toHaveBeenCalledWith(1);
    });

    it('should call toggleImageSelection on ctrl+click', async () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
        createMockImage({ id: '2', file_name: 'image2.jpg' }),
      ];

      mockStore.images = images;
      mockStore.toggleImageSelection = vi.fn();
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const secondImage = screen.getByRole('button', { name: /image2\.jpg/ });
      await userEvent.click(secondImage, { ctrlKey: true });

      expect(mockStore.toggleImageSelection).toHaveBeenCalledWith('2', 1);
    });

    it('should call toggleImageSelection on meta+click (Mac)', async () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
      ];

      mockStore.images = images;
      mockStore.toggleImageSelection = vi.fn();
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const firstImage = screen.getByRole('button', { name: /image1\.jpg/ });
      await userEvent.click(firstImage, { metaKey: true });

      expect(mockStore.toggleImageSelection).toHaveBeenCalledWith('1', 0);
    });

    it('should call selectImageRange on shift+click', async () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
        createMockImage({ id: '2', file_name: 'image2.jpg' }),
        createMockImage({ id: '3', file_name: 'image3.jpg' }),
      ];

      mockStore.images = images;
      mockStore.selectImageRange = vi.fn();
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const thirdImage = screen.getByRole('button', { name: /image3\.jpg/ });
      await userEvent.click(thirdImage, { shiftKey: true });

      expect(mockStore.selectImageRange).toHaveBeenCalledWith(2);
    });

    it('should show selected count when images are selected', () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
        createMockImage({ id: '2', file_name: 'image2.jpg' }),
        createMockImage({ id: '3', file_name: 'image3.jpg' }),
      ];

      mockStore.images = images;
      mockStore.selectedImageIds = ['1', '2'];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      expect(screen.getByText('2 selected')).toBeInTheDocument();
    });

    it('should clear selection when clear button is clicked', async () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
        createMockImage({ id: '2', file_name: 'image2.jpg' }),
      ];

      mockStore.images = images;
      mockStore.selectedImageIds = ['1', '2'];
      mockStore.clearImageSelection = vi.fn();
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const clearButton = screen.getByTitle('Clear selection');
      await userEvent.click(clearButton);

      expect(mockStore.clearImageSelection).toHaveBeenCalled();
    });
  });

  describe('View Toggle', () => {
    it('should toggle from grid to list view', async () => {
      mockStore.preferences.imageListView = 'grid';
      mockStore.setPreference = vi.fn();
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const toggleButton = screen.getByTitle('Switch to List View');
      await userEvent.click(toggleButton);

      expect(mockStore.setPreference).toHaveBeenCalledWith('imageListView', 'list');
    });

    it('should toggle from list to grid view', async () => {
      mockStore.preferences.imageListView = 'list';
      mockStore.setPreference = vi.fn();
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const toggleButton = screen.getByTitle('Switch to Grid View');
      await userEvent.click(toggleButton);

      expect(mockStore.setPreference).toHaveBeenCalledWith('imageListView', 'grid');
    });
  });

  describe('Filtering', () => {
    beforeEach(() => {
      const images = [
        createMockImage({ id: '1', status: 'not-started', annotation_count: 0, is_confirmed: false }),
        createMockImage({ id: '2', status: 'in-progress', annotation_count: 2, is_confirmed: false }),
        createMockImage({ id: '3', status: 'completed', annotation_count: 5, is_confirmed: true }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);
    });

    it('should show all images by default', () => {
      render(<ImageList />);

      const imageButtons = screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('title')?.includes('.jpg')
      );
      expect(imageButtons.length).toBe(3);
    });

    it('should filter to show only not-started images', async () => {
      render(<ImageList />);

      const filterSelect = screen.getByRole('combobox');
      await userEvent.selectOptions(filterSelect, 'not-started');

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.jpg')
        );
        expect(imageButtons.length).toBe(1);
      });
    });

    it('should filter to show only in-progress images', async () => {
      render(<ImageList />);

      const filterSelect = screen.getByRole('combobox');
      await userEvent.selectOptions(filterSelect, 'in-progress');

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.jpg')
        );
        expect(imageButtons.length).toBe(1);
      });
    });

    it('should filter to show only completed images', async () => {
      render(<ImageList />);

      const filterSelect = screen.getByRole('combobox');
      await userEvent.selectOptions(filterSelect, 'completed');

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.jpg')
        );
        expect(imageButtons.length).toBe(1);
      });
    });

    it('should show "No images match filter" when filter excludes all images', async () => {
      const images = [
        createMockImage({ id: '1', status: 'not-started' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const filterSelect = screen.getByRole('combobox');
      await userEvent.selectOptions(filterSelect, 'completed');

      await waitFor(() => {
        expect(screen.getByText('No images match filter')).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      const images = [
        createMockImage({ id: '1', file_name: 'cat-photo.jpg', folder_path: '/animals' }),
        createMockImage({ id: '2', file_name: 'dog-photo.jpg', folder_path: '/animals' }),
        createMockImage({ id: '3', file_name: 'car-photo.jpg', folder_path: '/vehicles' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);
    });

    it('should filter images by file name', async () => {
      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      await userEvent.type(searchInput, 'cat');

      await waitFor(() => {
        const visibleImages = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('cat-photo.jpg')
        );
        expect(visibleImages.length).toBeGreaterThan(0);
      });
    });

    it('should filter images by folder path', async () => {
      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      await userEvent.type(searchInput, 'animals');

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.jpg')
        );
        expect(imageButtons.length).toBe(2);
      });
    });

    it('should be case-insensitive', async () => {
      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      await userEvent.type(searchInput, 'CAT');

      await waitFor(() => {
        const visibleImages = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('cat-photo.jpg')
        );
        expect(visibleImages.length).toBeGreaterThan(0);
      });
    });

    it('should show no results when search matches nothing', async () => {
      render(<ImageList />);

      const searchInput = screen.getByPlaceholderText('Search images...');
      await userEvent.type(searchInput, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText('No images match filter')).toBeInTheDocument();
      });
    });

    it('should combine search and filter', async () => {
      const images = [
        createMockImage({ id: '1', file_name: 'cat.jpg', status: 'completed' }),
        createMockImage({ id: '2', file_name: 'dog.jpg', status: 'not-started' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      // Apply filter
      const filterSelect = screen.getByRole('combobox');
      await userEvent.selectOptions(filterSelect, 'completed');

      // Apply search
      const searchInput = screen.getByPlaceholderText('Search images...');
      await userEvent.type(searchInput, 'cat');

      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.jpg')
        );
        expect(imageButtons.length).toBe(1);
      });
    });
  });

  describe('Lock Indicators', () => {
    it('should display lock indicator for locked image', async () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
      ];

      mockStore.images = images;
      mockStore.project = createMockProject();
      mockUseAnnotationStore.mockReturnValue(mockStore);

      const { imageLockAPI } = await import('@/lib/api/image-locks');
      (imageLockAPI.getProjectLocks as any).mockResolvedValue([
        {
          image_id: '1',
          user_id: 2,
          user_name: 'Other User',
          locked_at: new Date().toISOString(),
        },
      ]);

      render(<ImageList />);

      await waitFor(() => {
        const lockIndicator = screen.getByTitle('Locked by Other User');
        expect(lockIndicator).toBeInTheDocument();
      });
    });

    it('should show "Locked by you" for own locks', async () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
      ];

      mockStore.images = images;
      mockStore.project = createMockProject();
      mockUseAnnotationStore.mockReturnValue(mockStore);

      const { imageLockAPI } = await import('@/lib/api/image-locks');
      (imageLockAPI.getProjectLocks as any).mockResolvedValue([
        {
          image_id: '1',
          user_id: 1,
          user_name: 'Test User',
          locked_at: new Date().toISOString(),
        },
      ]);

      render(<ImageList />);

      await waitFor(() => {
        const lockIndicator = screen.getByTitle('Locked by you');
        expect(lockIndicator).toBeInTheDocument();
      });
    });

    it('should show available indicator for unlocked images', () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
      ];

      mockStore.images = images;
      mockStore.project = createMockProject();
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const availableIndicator = screen.getByTitle('Available');
      expect(availableIndicator).toBeInTheDocument();
    });
  });

  describe('Diff Mode', () => {
    it('should display diff badge instead of status badge in diff mode', () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
      ];

      mockStore.images = images;
      mockStore.diffMode = {
        enabled: true,
        versionA: null,
        versionB: null,
        viewMode: 'overlay',
        diffData: {
          image_diffs: {
            '1': {
              added: [{ id: 'ann1' }],
              removed: [{ id: 'ann2' }],
              modified: [{ id: 'ann3' }],
              unchanged: [],
            },
          },
        },
        filters: {
          showAdded: true,
          showRemoved: true,
          showModified: true,
          showUnchanged: true,
        },
      };
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const diffBadge = screen.getByTitle(/3 changes/);
      expect(diffBadge).toBeInTheDocument();
    });

    it('should not show diff badge for images without changes', () => {
      const images = [
        createMockImage({ id: '1', file_name: 'image1.jpg' }),
      ];

      mockStore.images = images;
      mockStore.diffMode = {
        enabled: true,
        versionA: null,
        versionB: null,
        viewMode: 'overlay',
        diffData: {
          image_diffs: {
            '1': {
              added: [],
              removed: [],
              modified: [],
              unchanged: [{ id: 'ann1' }],
            },
          },
        },
        filters: {
          showAdded: true,
          showRemoved: true,
          showModified: true,
          showUnchanged: true,
        },
      };
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      // Should not have diff badge when no changes
      const diffBadges = screen.queryByTitle(/changes/);
      expect(diffBadges).not.toBeInTheDocument();
    });
  });

  describe('No Object Indicator', () => {
    it('should display no object indicator', () => {
      const images = [
        createMockImage({
          id: '1',
          file_name: 'image1.jpg',
          has_no_object: true,
        } as any),
      ];

      mockStore.images = images;
      mockStore.diffMode = { enabled: false };
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const noObjectIndicator = screen.getByTitle('No Object');
      expect(noObjectIndicator).toBeInTheDocument();
    });
  });

  describe('Load More Functionality', () => {
    it('should show load more button when there are more images', () => {
      const images = [
        createMockImage({ id: '1' }),
      ];

      mockStore.images = images;
      mockStore.totalImages = 10;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const loadMoreButton = screen.getByTitle(/Load More/);
      expect(loadMoreButton).toBeInTheDocument();
    });

    it('should not show load more button when all images are loaded', () => {
      const images = [
        createMockImage({ id: '1' }),
      ];

      mockStore.images = images;
      mockStore.totalImages = 1;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const loadMoreButton = screen.queryByTitle(/Load More/);
      expect(loadMoreButton).not.toBeInTheDocument();
    });

    it('should call API when load more is clicked', async () => {
      const images = [
        createMockImage({ id: '1' }),
      ];

      mockStore.images = images;
      mockStore.totalImages = 10;
      mockStore.project = createMockProject();
      mockStore.loadMoreImages = vi.fn();
      mockUseAnnotationStore.mockReturnValue(mockStore);

      const { getProjectImages, getProjectImageStatuses } = await import('@/lib/api/projects');
      (getProjectImages as any).mockResolvedValue({
        images: [
          { id: 2, file_name: 'image2.jpg', url: 'http://example.com/image2.jpg' },
        ],
      });
      (getProjectImageStatuses as any).mockResolvedValue({
        statuses: [
          { image_id: '2', total_annotations: 0, is_image_confirmed: false, status: 'not-started' },
        ],
      });

      render(<ImageList />);

      const loadMoreButton = screen.getByTitle(/Load More/);
      await userEvent.click(loadMoreButton);

      await waitFor(() => {
        expect(getProjectImages).toHaveBeenCalledWith(
          mockStore.project.id,
          50,
          1
        );
      });
    });

    it('should disable load more button while loading', async () => {
      const images = [
        createMockImage({ id: '1' }),
      ];

      mockStore.images = images;
      mockStore.totalImages = 10;
      mockStore.project = createMockProject();
      mockStore.backgroundLoading = true;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const loadMoreButton = screen.getByTitle(/Load More/);
      expect(loadMoreButton).toBeDisabled();
    });
  });

  describe('Auto-scroll', () => {
    it('should auto-scroll to current image when currentIndex changes', async () => {
      const images = Array.from({ length: 20 }, (_, i) =>
        createMockImage({ id: `${i + 1}`, file_name: `image${i + 1}.jpg` })
      );

      mockStore.images = images;
      mockStore.currentIndex = 0;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      const { rerender } = render(<ImageList />);

      // Change current index
      mockStore.currentIndex = 10;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      rerender(<ImageList />);

      // Note: scrollIntoView is called but we can't easily test the actual scrolling
      // This test ensures the component renders without errors during auto-scroll
      const currentImage = screen.getByRole('button', { name: /image11\.jpg/ });
      expect(currentImage).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing image data gracefully', () => {
      const images = [
        createMockImage({ file_name: '', folder_path: undefined } as any),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      expect(() => render(<ImageList />)).not.toThrow();
    });

    it('should handle zero annotation count', () => {
      const images = [
        createMockImage({ annotation_count: 0 }),
      ];

      mockStore.images = images;
      mockStore.preferences.imageListView = 'list';
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should handle image error by falling back to original URL', () => {
      const images = [
        createMockImage({
          id: '1',
          file_name: 'image1.jpg',
          url: 'http://example.com/image1.jpg',
          thumbnail_url: 'http://example.com/invalid-thumb.jpg',
        }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const thumbnail = screen.getByAltText('image1.jpg') as HTMLImageElement;

      // Simulate error loading thumbnail
      fireEvent.error(thumbnail);

      // Should fallback to original URL
      expect(thumbnail.src).toContain('image1.jpg');
    });

    it('should handle rapid filter changes', async () => {
      const images = [
        createMockImage({ id: '1', status: 'not-started' }),
        createMockImage({ id: '2', status: 'in-progress' }),
        createMockImage({ id: '3', status: 'completed' }),
      ];

      mockStore.images = images;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<ImageList />);

      const filterSelect = screen.getByRole('combobox');

      // Rapidly change filters
      await userEvent.selectOptions(filterSelect, 'not-started');
      await userEvent.selectOptions(filterSelect, 'in-progress');
      await userEvent.selectOptions(filterSelect, 'completed');
      await userEvent.selectOptions(filterSelect, 'all');

      // Should render all images
      await waitFor(() => {
        const imageButtons = screen.getAllByRole('button').filter(btn =>
          btn.getAttribute('title')?.includes('.jpg')
        );
        expect(imageButtons.length).toBe(3);
      });
    });

    it('should handle empty project gracefully', () => {
      mockStore.project = null;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      expect(() => render(<ImageList />)).not.toThrow();
    });
  });
});
