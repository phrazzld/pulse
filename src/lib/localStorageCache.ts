/**
 * Client-side localStorage caching utilities with TTL support
 */

// TTL values in milliseconds for client caching
export const ClientCacheTTL = {
  SHORT: 60 * 1000, // 1 minute
  MEDIUM: 15 * 60 * 1000, // 15 minutes
  LONG: 60 * 60 * 1000, // 1 hour
  VERY_LONG: 24 * 60 * 60 * 1000, // 24 hours
};

// Cache entry structure
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Sets an item in the cache with a specified TTL
 * 
 * @param key The cache key
 * @param data The data to cache
 * @param ttl Time-to-live in milliseconds
 * @returns true if successful, false if storage failed
 */
export function setCacheItem<T>(key: string, data: T, ttl: number = ClientCacheTTL.MEDIUM): boolean {
  try {
    // Create a cache entry with timestamp and TTL
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl
    };
    
    // Serialize and store the entry
    localStorage.setItem(key, JSON.stringify(entry));
    return true;
  } catch (error) {
    console.warn('Failed to set cache item:', error);
    return false;
  }
}

/**
 * Gets an item from the cache if it exists and is not expired
 * 
 * @param key The cache key
 * @returns The cached data if valid, null if expired or not found
 */
export function getCacheItem<T>(key: string): T | null {
  try {
    // Get the serialized entry
    const serialized = localStorage.getItem(key);
    if (!serialized) return null;
    
    // Parse the entry
    const entry = JSON.parse(serialized) as CacheEntry<T>;
    const now = Date.now();
    
    // Check if the entry is still valid
    if (now - entry.timestamp <= entry.ttl) {
      return entry.data;
    }
    
    // If expired, remove it and return null
    localStorage.removeItem(key);
    return null;
  } catch (error) {
    console.warn('Failed to get cache item:', error);
    return null;
  }
}

/**
 * Gets an item from the cache regardless of TTL (stale data)
 * 
 * @param key The cache key
 * @returns The cached data if found (even if expired), null if not found
 */
export function getStaleItem<T>(key: string): { data: T | null, isStale: boolean } {
  try {
    // Get the serialized entry
    const serialized = localStorage.getItem(key);
    if (!serialized) return { data: null, isStale: false };
    
    // Parse the entry
    const entry = JSON.parse(serialized) as CacheEntry<T>;
    const now = Date.now();
    
    // Check if the entry is stale
    const isStale = now - entry.timestamp > entry.ttl;
    
    return { 
      data: entry.data,
      isStale
    };
  } catch (error) {
    console.warn('Failed to get stale cache item:', error);
    return { data: null, isStale: false };
  }
}

/**
 * Checks if a cached item is still valid
 * 
 * @param key The cache key
 * @returns true if the item exists and is not expired, false otherwise
 */
export function isCacheValid(key: string): boolean {
  try {
    // Get the serialized entry
    const serialized = localStorage.getItem(key);
    if (!serialized) return false;
    
    // Parse the entry
    const entry = JSON.parse(serialized) as CacheEntry<any>;
    const now = Date.now();
    
    // Check if the entry is still valid
    return now - entry.timestamp <= entry.ttl;
  } catch (error) {
    console.warn('Failed to check cache validity:', error);
    return false;
  }
}

/**
 * Removes an item from the cache
 * 
 * @param key The cache key
 */
export function removeCacheItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('Failed to remove cache item:', error);
  }
}

/**
 * Clear all cache items with a specific prefix
 * 
 * @param prefix The prefix to match
 */
export function clearCacheByPrefix(prefix: string): void {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.warn('Failed to clear cache by prefix:', error);
  }
}

/**
 * Check if localStorage is available
 * 
 * @returns true if localStorage is available, false otherwise
 */
export function isStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}