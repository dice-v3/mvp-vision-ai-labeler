/**
 * useImagePrefetch Hook
 *
 * Prefetches adjacent images to improve navigation performance.
 * Implements LRU cache to store loaded images.
 *
 * Performance optimization for Canvas image switching.
 *
 * @module hooks/useImagePrefetch
 */

import { useEffect, useRef } from 'react';

// LRU Image Cache
class ImageCache {
  private cache: Map<string, HTMLImageElement>;
  private maxSize: number;
  private accessOrder: string[];

  constructor(maxSize: number = 10) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.accessOrder = [];
  }

  get(url: string): HTMLImageElement | null {
    const img = this.cache.get(url);
    if (img) {
      // Update access order (LRU)
      this.accessOrder = this.accessOrder.filter(u => u !== url);
      this.accessOrder.push(url);
      return img;
    }
    return null;
  }

  set(url: string, img: HTMLImageElement): void {
    // Remove oldest if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(url)) {
      const oldest = this.accessOrder.shift();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }

    this.cache.set(url, img);
    this.accessOrder = this.accessOrder.filter(u => u !== url);
    this.accessOrder.push(url);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }
}

// Global image cache shared across all hook instances
const imageCache = new ImageCache(10);

interface UseImagePrefetchParams {
  images: Array<{ id: string | number; url: string }>;
  currentIndex: number;
  prefetchRange?: number; // Number of images to prefetch in each direction
}

/**
 * Prefetch adjacent images to improve navigation performance
 *
 * @param params - Hook parameters
 *
 * @example
 * ```tsx
 * useImagePrefetch({
 *   images,
 *   currentIndex,
 *   prefetchRange: 2  // Prefetch 2 images before and after
 * });
 * ```
 */
export function useImagePrefetch(params: UseImagePrefetchParams) {
  const { images, currentIndex, prefetchRange = 2 } = params;
  const prefetchedUrls = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!images || images.length === 0) return;

    // Calculate range to prefetch
    const startIndex = Math.max(0, currentIndex - prefetchRange);
    const endIndex = Math.min(images.length - 1, currentIndex + prefetchRange);

    // Prefetch images in range
    for (let i = startIndex; i <= endIndex; i++) {
      if (i === currentIndex) continue; // Skip current image (already loading)

      const image = images[i];
      if (!image || !image.url) continue;

      const url = image.url;

      // Skip if already in cache or already prefetched
      if (imageCache.get(url) || prefetchedUrls.current.has(url)) {
        continue;
      }

      // Prefetch image
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        imageCache.set(url, img);
        prefetchedUrls.current.add(url);
        console.log(`[Prefetch] Loaded: ${url.substring(url.lastIndexOf('/') + 1)}`);
      };

      img.onerror = () => {
        console.error(`[Prefetch] Failed: ${url}`);
      };

      img.src = url;
    }
  }, [images, currentIndex, prefetchRange]);

  return imageCache;
}

/**
 * Get image from cache or create new one
 *
 * @param url - Image URL
 * @param onLoad - Callback when image loads
 * @param onError - Callback on error
 * @returns HTMLImageElement
 */
export function getOrLoadImage(
  url: string,
  onLoad?: (img: HTMLImageElement) => void,
  onError?: () => void
): HTMLImageElement {
  // Check cache first
  const cached = imageCache.get(url);
  if (cached) {
    console.log(`[ImageCache] Hit: ${url.substring(url.lastIndexOf('/') + 1)}`);
    // Call onLoad immediately if image is already loaded
    if (cached.complete && onLoad) {
      setTimeout(() => onLoad(cached), 0);
    }
    return cached;
  }

  console.log(`[ImageCache] Miss: ${url.substring(url.lastIndexOf('/') + 1)}`);

  // Create new image
  const img = new Image();
  img.crossOrigin = 'anonymous';

  img.onload = () => {
    imageCache.set(url, img);
    if (onLoad) onLoad(img);
  };

  img.onerror = () => {
    console.error(`[ImageCache] Load failed: ${url}`);
    if (onError) onError();
  };

  img.src = url;
  return img;
}

/**
 * Clear image cache (useful for testing or memory management)
 */
export function clearImageCache(): void {
  imageCache.clear();
}
