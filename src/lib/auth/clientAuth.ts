'use client';

import { signOut } from 'next-auth/react';

/**
 * Type for API error responses
 */
interface ApiErrorResponse {
  error?: string;
  message?: string;
  code?: string;
  signOutRequired?: boolean;
}

/**
 * Handle API fetch errors, with special handling for auth errors
 * @param error The error object from a fetch call
 * @param response The response object, if available
 * @returns A standardized error object
 */
export async function handleApiFetchError(
  error: any,
  response?: Response
): Promise<ApiErrorResponse> {
  console.error('API Error:', error);
  
  let errorData: ApiErrorResponse = {
    error: 'Unknown error occurred',
    code: 'UNKNOWN_ERROR'
  };
  
  // Parse error response if available
  if (response) {
    try {
      // Try to parse the error response as JSON
      errorData = await response.json();
    } catch (parseError) {
      console.error('Error parsing error response:', parseError);
      errorData = {
        error: `Error ${response.status}: ${response.statusText}`,
        code: 'RESPONSE_PARSE_ERROR'
      };
    }
  }
  
  // Handle authentication errors
  const authErrorCodes = [
    'GITHUB_AUTH_ERROR',
    'INVALID_GITHUB_TOKEN',
    'MISSING_GITHUB_TOKEN',
    'NOT_AUTHENTICATED',
    'GITHUB_SCOPE_ERROR'
  ];
  
  // Check if this is an auth error by code or if signOutRequired flag is true
  const isAuthError = 
    authErrorCodes.includes(errorData.code || '') || 
    errorData.signOutRequired === true;
    
  if (isAuthError) {
    console.warn('Authentication error detected, signing out:', errorData);
    
    // Give the UI a moment to display the error before redirecting
    setTimeout(() => {
      signOut({ redirect: true, callbackUrl: window.location.origin + '/' })
        .catch(signOutError => {
          console.error('Error during sign out:', signOutError);
        });
    }, 1500);
    
    // Add a flag that we're handling the sign out
    errorData.signOutRequired = true;
  }
  
  return errorData;
}

/**
 * Wrapper for fetch that handles auth errors
 * @param url The URL to fetch
 * @param options Fetch options
 * @returns A promise that resolves to the response data or throws an error
 */
export async function authenticatedFetch<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorData = await handleApiFetchError(null, response);
      throw errorData;
    }
    
    return await response.json();
  } catch (error) {
    // If it's already been processed by handleApiFetchError, just rethrow
    if (error && typeof error === 'object' && 'code' in error) {
      throw error;
    }
    
    // Otherwise, process it
    const errorData = await handleApiFetchError(error);
    throw errorData;
  }
}