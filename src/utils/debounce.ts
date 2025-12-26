/**
 * Debounce utility function
 * Delays function execution until after a specified wait time has elapsed
 * since the last time it was invoked
 *
 * @param func - The function to debounce
 * @param wait - The number of milliseconds to delay
 * @returns Debounced function
 *
 * @example
 * ```typescript
 * const debouncedSearch = debounce((query: string) => {
 *   console.log('Searching:', query);
 * }, 300);
 *
 * debouncedSearch('a');
 * debouncedSearch('ab');
 * debouncedSearch('abc'); // Only this will execute after 300ms
 * ```
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function debounced(this: any, ...args: Parameters<T>): void {
    // Clear previous timeout
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    // Set new timeout
    timeoutId = setTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
    }, wait);
  };
}

/**
 * Throttle utility function
 * Ensures function is called at most once per specified time period
 *
 * @param func - The function to throttle
 * @param limit - The number of milliseconds to limit
 * @returns Throttled function
 *
 * @example
 * ```typescript
 * const throttledScroll = throttle(() => {
 *   console.log('Scroll event');
 * }, 16); // 60fps
 * ```
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function throttled(this: any, ...args: Parameters<T>): void {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}
