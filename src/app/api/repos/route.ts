import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { fetchAllRepositories } from "@/lib/github";
import { logger } from "@/lib/logger";

const MODULE_NAME = "api:repos";

export async function GET(request: NextRequest) {
  logger.debug(MODULE_NAME, "GET /api/repos request received", { 
    url: request.url,
    headers: Object.fromEntries(request.headers)
  });
  
  const session = await getServerSession(authOptions);
  
  if (!session || !session.accessToken) {
    logger.warn(MODULE_NAME, "Unauthorized request - no valid session", { 
      sessionExists: !!session,
      hasAccessToken: !!session?.accessToken
    });
    
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
  
  logger.info(MODULE_NAME, "Authenticated user requesting repositories", { 
    user: session.user?.email || session.user?.name || 'unknown'
  });

  try {
    logger.debug(MODULE_NAME, "Fetching all user repositories");
    const startTime = Date.now();
    
    // Get all repositories the user has access to (owned, org, and collaborative)
    const repositories = await fetchAllRepositories(session.accessToken);
    
    const endTime = Date.now();
    logger.info(MODULE_NAME, "Successfully fetched repositories", { 
      count: repositories.length,
      timeMs: endTime - startTime,
      languages: Array.from(new Set(repositories.map(repo => repo.language).filter(Boolean))),
      private: repositories.filter(repo => repo.private).length,
      public: repositories.filter(repo => !repo.private).length
    });

    return NextResponse.json(repositories);
  } catch (error) {
    logger.error(MODULE_NAME, "Error fetching repositories", { error });
    // Check if it's an authentication error
    const isAuthError = error?.name === 'HttpError' && 
                       (error?.message?.includes('credentials') || 
                        error?.message?.includes('authentication'));
    
    // GitHub tokens can become invalid for various reasons:
    // 1. Token was revoked by the user
    // 2. Token was revoked by an org admin
    // 3. Token expired (if it had an expiration)
    // 4. Token scopes changed
    // 5. User revoked app access
    
    return new NextResponse(JSON.stringify({ 
      error: isAuthError ? 
        "GitHub authentication failed. Your access token is invalid or expired." : 
        "Failed to fetch repositories",
      details: error.message,
      code: isAuthError ? "GITHUB_AUTH_ERROR" : "API_ERROR"
    }), {
      // Use 403 for auth errors rather than 401 to prevent automatic browser redirects
      status: isAuthError ? 403 : 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}