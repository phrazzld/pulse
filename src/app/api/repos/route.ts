import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { fetchAllRepositories, checkAppInstallation, getAllAppInstallations, AppInstallation } from "@/lib/github";
import { logger } from "@/lib/logger";

const MODULE_NAME = "api:repos";

export async function GET(request: NextRequest) {
  logger.debug(MODULE_NAME, "GET /api/repos request received", { 
    url: request.url,
    headers: Object.fromEntries(request.headers)
  });
  
  const session = await getServerSession(authOptions);
  
  if (!session) {
    logger.warn(MODULE_NAME, "Unauthorized request - no valid session", { 
      sessionExists: !!session
    });
    
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
  
  // Get installation ID from query parameter if present
  let requestedInstallationId = request.nextUrl.searchParams.get('installation_id');
  let installationId = requestedInstallationId ? parseInt(requestedInstallationId, 10) : session.installationId;
  
  // Get all available installations if we have an access token
  let allInstallations: AppInstallation[] = [];
  if (session.accessToken) {
    try {
      allInstallations = await getAllAppInstallations(session.accessToken);
      logger.info(MODULE_NAME, "Retrieved all GitHub App installations", {
        count: allInstallations.length,
        accounts: allInstallations.map(i => i.account.login)
      });
      
      // If we don't have an installation ID yet, use the first available installation
      if (!installationId && allInstallations.length > 0) {
        installationId = allInstallations[0].id;
        logger.info(MODULE_NAME, "Using first available installation", {
          installationId,
          account: allInstallations[0].account.login
        });
      }
      
      // Validate that the requested installation ID is in our list
      if (requestedInstallationId && allInstallations.length > 0) {
        const validInstallation = allInstallations.find(
          inst => inst.id === parseInt(requestedInstallationId, 10)
        );
        
        if (!validInstallation) {
          logger.warn(MODULE_NAME, "Requested installation ID not found in user's installations", {
            requestedId: requestedInstallationId,
            availableIds: allInstallations.map(i => i.id)
          });
          // Fallback to the first available installation
          installationId = allInstallations[0].id;
        }
      }
    } catch (error) {
      logger.warn(MODULE_NAME, "Error getting all GitHub App installations", { error });
    }
  }
  
  // Also check for installation ID in cookies if we still don't have one
  if (!installationId) {
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader && cookieHeader.includes('github_installation_id=')) {
      const match = cookieHeader.match(/github_installation_id=([^;]+)/);
      if (match && match[1]) {
        installationId = parseInt(match[1], 10);
        logger.info(MODULE_NAME, "Found installation ID in cookie", { installationId });
      }
    }
  }
  
  // If we don't have either auth method, we can't proceed
  if (!installationId && !session.accessToken) {
    logger.warn(MODULE_NAME, "No authentication method available", {
      hasAccessToken: !!session.accessToken,
      hasInstallationId: !!installationId
    });
    
    return new NextResponse(JSON.stringify({ 
      error: "GitHub authentication required",
      needsInstallation: true,
      message: "Please install the GitHub App to access your repositories."
    }), {
      status: 403,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
  
  logger.info(MODULE_NAME, "Authenticated user requesting repositories", { 
    user: session.user?.email || session.user?.name || 'unknown',
    authMethod: installationId ? "GitHub App" : "OAuth"
  });

  try {
    logger.debug(MODULE_NAME, "Fetching all user repositories");
    const startTime = Date.now();
    
    if (installationId) {
      logger.debug(MODULE_NAME, "Using GitHub App installation", { installationId });
    } else if (session.accessToken) {
      // Log GitHub token info (safely)
      const tokenInfo = {
        length: session.accessToken?.length,
        prefix: session.accessToken?.substring(0, 4) + '...',
      };
      logger.debug(MODULE_NAME, "Using GitHub access token", tokenInfo);
    }
    
    // Get all repositories the user has access to (owned, org, and collaborative)
    const repositories = await fetchAllRepositories(session.accessToken, installationId);
    
    const endTime = Date.now();
    
    // Group repositories by organization
    const orgRepos = repositories.reduce((acc, repo) => {
      const orgName = repo.full_name.split('/')[0];
      if (!acc[orgName]) {
        acc[orgName] = [];
      }
      acc[orgName].push(repo.full_name);
      return acc;
    }, {} as Record<string, string[]>);
    
    // Compute organization-level statistics
    const orgStats = Object.entries(orgRepos).map(([org, repos]) => ({
      organization: org,
      repoCount: repos.length,
      repoNames: repos,
    }));
    
    // Log detailed repository information
    logger.info(MODULE_NAME, "Successfully fetched repositories", { 
      count: repositories.length,
      timeMs: endTime - startTime,
      languages: Array.from(new Set(repositories.map(repo => repo.language).filter(Boolean))),
      private: repositories.filter(repo => repo.private).length,
      public: repositories.filter(repo => !repo.private).length,
      organizationCount: Object.keys(orgRepos).length,
      organizationSummary: orgStats.map(stat => `${stat.organization}: ${stat.repoCount} repos`),
      authMethod: installationId ? "GitHub App" : "OAuth"
    });
    
    // Log additional debugging info for troubleshooting
    logger.debug(MODULE_NAME, "Repository fetch details", {
      fetchTimeMs: endTime - startTime,
      userInfo: {
        name: session.user?.name,
        email: session.user?.email,
      },
      organizationDetails: orgStats
    });

    return NextResponse.json({
      repositories,
      authMethod: installationId ? "github_app" : "oauth",
      installationId: installationId || null,
      installations: allInstallations,
      currentInstallation: allInstallations.find(i => i.id === installationId)
    });
  } catch (error) {
    logger.error(MODULE_NAME, "Error fetching repositories", { error });
    // Check what kind of error we have
    const isAuthError = error?.name === 'HttpError' && 
                       (error?.message?.includes('credentials') || 
                        error?.message?.includes('authentication'));
    
    const isScopeError = error?.message?.includes('missing') && error?.message?.includes('scope');
    const isAppError = error?.message?.includes('GitHub App credentials not configured');
    
    // GitHub tokens can become invalid for various reasons:
    // 1. Token was revoked by the user
    // 2. Token was revoked by an org admin
    // 3. Token expired (if it had an expiration)
    // 4. Token scopes changed
    // 5. User revoked app access
    // 6. Token missing required scopes
    // 7. GitHub App credentials missing
    
    let errorMessage = "Failed to fetch repositories";
    let errorCode = "API_ERROR";
    
    if (isAppError) {
      errorMessage = "GitHub App not properly configured. Please contact the administrator.";
      errorCode = "GITHUB_APP_CONFIG_ERROR";
    } else if (isScopeError) {
      errorMessage = "Your GitHub token is missing required permissions. Please sign out and sign in again to grant access to your repositories.";
      errorCode = "GITHUB_SCOPE_ERROR";
    } else if (isAuthError) {
      errorMessage = "GitHub authentication failed. Your access token is invalid or expired.";
      errorCode = "GITHUB_AUTH_ERROR";
    }
    
    return new NextResponse(JSON.stringify({ 
      error: errorMessage,
      details: error.message,
      code: errorCode
    }), {
      // Use 403 for auth errors rather than 401 to prevent automatic browser redirects
      status: (isAuthError || isScopeError || isAppError) ? 403 : 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}