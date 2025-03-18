'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface UseProtectedRouteOptions {
  redirectTo?: string;      // Where to redirect unauthenticated users
  redirectIfFound?: boolean; // Redirect if authenticated (for login pages)
  loadingDelay?: number;    // Small delay for smoother transitions
}

/**
 * Custom hook to protect routes based on authentication status
 * @param options Configuration options
 * @returns Loading state and authentication status information
 */
export function useProtectedRoute(options: UseProtectedRouteOptions = {}) {
  const {
    redirectTo = '/',
    redirectIfFound = false,
    loadingDelay = 200
  } = options;
  
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    if (status === 'loading') return;
    
    // Add a small delay to prevent flash of content
    const timer = setTimeout(() => {
      if (
        // If redirectIfFound is true, redirect authenticated users
        (redirectIfFound && status === 'authenticated') ||
        // If redirectIfFound is false, redirect unauthenticated users
        (!redirectIfFound && status === 'unauthenticated')
      ) {
        router.replace(redirectTo);
      } else {
        setIsLoading(false);
      }
    }, loadingDelay);
    
    return () => clearTimeout(timer);
  }, [status, router, redirectIfFound, redirectTo, loadingDelay]);
  
  return {
    isLoading: isLoading || status === 'loading',
    isAuthenticated: status === 'authenticated',
    session,
    status
  };
}

export default useProtectedRoute;