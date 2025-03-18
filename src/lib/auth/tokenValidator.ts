import { logger } from "../logger";
import { Session } from "next-auth";
import { signOut } from "next-auth/react";

const MODULE_NAME = "auth:tokenValidator";

/**
 * Checks if the provided GitHub token is valid by making a test API call
 * @param accessToken The GitHub access token to validate
 * @returns {Promise<boolean>} True if the token is valid, false otherwise
 */
export async function isGitHubTokenValid(accessToken: string): Promise<boolean> {
  if (!accessToken) {
    logger.warn(MODULE_NAME, "No access token provided for validation");
    return false;
  }

  try {
    // Make a lightweight API call to GitHub to check token validity
    // Using the rate_limit endpoint is ideal as it's lightweight and always accessible
    const response = await fetch("https://api.github.com/rate_limit", {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (response.status === 200) {
      logger.info(MODULE_NAME, "GitHub token is valid");
      return true;
    }

    // Status 401 indicates that the token is invalid
    if (response.status === 401) {
      logger.warn(MODULE_NAME, "GitHub token is invalid or expired", {
        status: response.status,
      });
      return false;
    }

    // Other status codes may indicate other GitHub API issues
    logger.warn(MODULE_NAME, "Unexpected status code when validating GitHub token", {
      status: response.status,
    });
    return false;
  } catch (error) {
    logger.error(MODULE_NAME, "Error validating GitHub token", { error });
    return false;
  }
}

/**
 * Validates the authentication state and handles invalid tokens by forcing a sign-out
 * @param session The current user session
 * @param options Configuration options
 * @returns {Promise<boolean>} True if the session is valid, false otherwise
 */
export async function validateAuthState(
  session: Session | null, 
  options: { 
    forceSignOut?: boolean;
    callback?: (isValid: boolean) => void;
  } = {}
): Promise<boolean> {
  const { forceSignOut = true, callback } = options;
  
  if (!session) {
    logger.warn(MODULE_NAME, "No session found during auth validation");
    return false;
  }

  if (!session.accessToken) {
    logger.warn(MODULE_NAME, "Session missing GitHub access token");
    
    if (forceSignOut) {
      logger.info(MODULE_NAME, "Forcing sign out due to missing access token");
      await signOut({ 
        redirect: true, 
        callbackUrl: '/'
      });
    }
    
    if (callback) callback(false);
    return false;
  }

  // Validate the token with the GitHub API
  const isValid = await isGitHubTokenValid(session.accessToken);
  
  if (!isValid && forceSignOut) {
    logger.info(MODULE_NAME, "Forcing sign out due to invalid GitHub token");
    await signOut({ 
      redirect: true, 
      callbackUrl: '/'
    });
  }
  
  if (callback) callback(isValid);
  return isValid;
}

/**
 * A React hook for client components to verify authentication status on mount
 * This can be used in layout.tsx or individual pages
 */
export function useAuthValidator() {
  if (typeof window === "undefined") {
    return { isValidating: false, isValid: false };
  }
  
  // This would be implemented with React hooks
  // using useState and useEffect to validate auth on component mount
  // Implementation details omitted as this is a TypeScript-only file
}