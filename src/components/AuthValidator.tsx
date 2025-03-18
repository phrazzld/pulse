'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { isGitHubTokenValid } from '@/lib/auth/tokenValidator';

interface AuthValidatorProps {
  children: React.ReactNode;
  fallback?: React.ReactNode; // Optional fallback UI while validating
}

/**
 * Component that validates GitHub token on mount and forces sign-out if invalid
 * Place this in layouts or high-level components to ensure valid auth state
 */
export function AuthValidator({ children, fallback }: AuthValidatorProps) {
  const { data: session, status } = useSession();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  
  useEffect(() => {
    // Skip validation if not authenticated or still loading
    if (status !== 'authenticated' || !session) {
      setIsValidating(false);
      return;
    }
    
    const accessToken = session?.accessToken as string;
    
    // Define an async function to validate the token
    const validateToken = async () => {
      try {
        setIsValidating(true);
        console.log('Validating GitHub token...');
        
        if (!accessToken) {
          console.error('No GitHub token found in session, signing out');
          setIsValid(false);
          await signOut({ redirect: true, callbackUrl: '/' });
          return;
        }
        
        const isValid = await isGitHubTokenValid(accessToken);
        
        if (!isValid) {
          console.error('GitHub token is invalid or expired, signing out');
          await signOut({ redirect: true, callbackUrl: '/' });
        } else {
          console.log('GitHub token is valid');
          setIsValid(true);
        }
      } catch (error) {
        console.error('Error validating GitHub token:', error);
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    };
    
    // Run the validation
    validateToken();
  }, [session, status]);
  
  // Show fallback UI while validating
  if (status === 'loading' || isValidating) {
    return fallback || <div>Validating authentication...</div>;
  }
  
  // Not authenticated - still show the children which will include the login page
  if (status !== 'authenticated') {
    return <>{children}</>;
  }
  
  // Authentication is valid, render children
  return <>{children}</>;
}

/**
 * Hook to check token validity on demand
 * Returns a function that can be called to validate the GitHub token
 */
export function useTokenValidator() {
  const { data: session } = useSession();
  
  const validateToken = async (): Promise<boolean> => {
    if (!session?.accessToken) {
      console.error('No GitHub token found in session');
      return false;
    }
    
    return await isGitHubTokenValid(session.accessToken as string);
  };
  
  return validateToken;
}