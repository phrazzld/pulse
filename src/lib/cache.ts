// Utility functions for API caching and ETag handling

import { createHash } from 'crypto';
import { logger } from './logger';
import { NextRequest, NextResponse } from 'next/server';
import { compressedJsonResponse } from './compress';
import { optimizedJSONStringify } from './optimize';

const MODULE_NAME = 'cache';

/**
 * Generates a consistent ETag for response data
 * @param data The data to generate an ETag for
 * @returns A string ETag value
 */
export function generateETag(data: any): string {
  try {
    const jsonString = JSON.stringify(data);
    // Use MD5 as it's fast and sufficient for ETag purposes
    // In a production environment, consider using a more secure hash for sensitive data
    const hash = createHash('md5').update(jsonString).digest('hex');
    return `"${hash}"`;
  } catch (error) {
    logger.warn(MODULE_NAME, 'Error generating ETag', { error });
    // Fallback to a timestamp-based ETag if stringification fails
    return `"${Date.now().toString(36)}"`;
  }
}

/**
 * Determines if the request's If-None-Match header matches the ETag
 * @param request The NextRequest object
 * @param etag The ETag to compare against
 * @returns True if the ETags match (cache is valid)
 */
export function isCacheValid(request: NextRequest, etag: string): boolean {
  const ifNoneMatch = request.headers.get('if-none-match');
  if (!ifNoneMatch) return false;
  
  // Simple exact match check
  if (ifNoneMatch === etag) return true;
  
  // Handle multiple ETags in the header (comma-separated list)
  const etags = ifNoneMatch.split(',').map(e => e.trim());
  return etags.includes(etag);
}

/**
 * Returns a 304 Not Modified response with appropriate headers
 * @param etag The ETag to include in the response
 * @param cacheControl Optional Cache-Control header value
 * @returns A NextResponse with 304 status
 */
export function notModifiedResponse(etag: string, cacheControl?: string): NextResponse {
  const headers: Record<string, string> = {
    'ETag': etag,
  };
  
  if (cacheControl) {
    headers['Cache-Control'] = cacheControl;
  }
  
  return new NextResponse(null, {
    status: 304,
    headers,
  });
}

/**
 * Returns a JSON response with caching headers
 * @param data The data to return as JSON
 * @param status The HTTP status code
 * @param options Additional response options
 * @returns A NextResponse with the data and caching headers
 */
export function cachedJsonResponse(
  data: any, 
  status: number = 200,
  options: {
    etag?: string,
    cacheControl?: string,
    maxAge?: number,
    staleWhileRevalidate?: number,
    isPrivate?: boolean,
    extraHeaders?: Record<string, string>
  } = {}
): NextResponse {
  const etag = options.etag || generateETag(data);
  
  // Use provided cache control or generate one with optional parameters
  const cacheControl = options.cacheControl || 
    generateCacheControl(
      options.maxAge || CacheTTL.SHORT,
      options.staleWhileRevalidate,
      options.isPrivate !== undefined ? options.isPrivate : true
    );
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ETag': etag,
    'Cache-Control': cacheControl,
    ...options.extraHeaders
  };
  
  return NextResponse.json(data, {
    status,
    headers,
  });
}

/**
 * Creates an optimized and possibly compressed JSON response with caching headers
 * 
 * @param request - The original NextRequest to check for compression support
 * @param data - The data to return and potentially compress
 * @param status - HTTP status code
 * @param options - Additional options for the response
 * @returns - A NextResponse with optimized data and compression if applicable
 */
export async function optimizedJsonResponse(
  request: NextRequest,
  data: any, 
  status: number = 200,
  options: {
    etag?: string,
    cacheControl?: string,
    maxAge?: number,
    staleWhileRevalidate?: number,
    isPrivate?: boolean,
    compress?: boolean,
    extraHeaders?: Record<string, string>
  } = {}
): Promise<NextResponse> {
  const etag = options.etag || generateETag(data);
  
  // Use provided cache control or generate one with optional parameters
  const cacheControl = options.cacheControl || 
    generateCacheControl(
      options.maxAge || CacheTTL.SHORT,
      options.staleWhileRevalidate,
      options.isPrivate !== undefined ? options.isPrivate : true
    );
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ETag': etag,
    'Cache-Control': cacheControl,
    ...options.extraHeaders
  };
  
  // Apply compression if enabled (default to true)
  const shouldCompress = options.compress !== false;
  
  if (shouldCompress) {
    // Use compressed response function if compression is enabled
    return await compressedJsonResponse(data, request, status, headers);
  } else {
    // Fall back to standard response without compression
    return NextResponse.json(data, {
      status,
      headers,
    });
  }
}

/**
 * Default caching options for different types of data (in seconds)
 */
export const CacheTTL = {
  SHORT: 60, // 1 minute - for dynamic data that changes frequently
  MEDIUM: 900, // 15 minutes - for semi-dynamic data
  LONG: 3600, // 1 hour - for relatively static data
  VERY_LONG: 86400, // 24 hours - for very static data
};

/**
 * Generates a Cache-Control header value with appropriate directives
 * @param maxAge Max age in seconds
 * @param staleWhileRevalidate Time in seconds the resource is stale but still usable
 * @param isPrivate Whether the response is private or public
 * @returns A formatted Cache-Control header value
 */
export function generateCacheControl(
  maxAge: number = CacheTTL.SHORT,
  staleWhileRevalidate: number = maxAge * 2,
  isPrivate: boolean = true
): string {
  const privacy = isPrivate ? 'private' : 'public';
  return `${privacy}, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`;
}