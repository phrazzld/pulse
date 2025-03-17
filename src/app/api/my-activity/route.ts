import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { 
  fetchAllRepositories, 
  fetchCommitsForRepositories, 
  Commit,
  Repository,
  AppInstallation 
} from "@/lib/github";
import { logger } from "@/lib/logger";
import { optimizedJsonResponse, generateETag, isCacheValid, notModifiedResponse, CacheTTL } from "@/lib/cache";
import { optimizeCommit, optimizeRepository, MinimalCommit, MinimalRepository } from "@/lib/optimize";

const MODULE_NAME = "api:my-activity";

// Response type for my-activity endpoint
type MyActivityResponse = {
  commits: MinimalCommit[];
  stats: {
    totalCommits: number;
    repositories: string[];
    dates: string[];
  };
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
  };
  user: string;
  dateRange: {
    since: string;
    until: string;
  };
  error?: string;
  code?: string;
};

export async function GET(request: NextRequest) {
  logger.debug(MODULE_NAME, "GET /api/my-activity request received", { 
    url: request.url,
    searchParams: Object.fromEntries(request.nextUrl.searchParams.entries()),
    headers: Object.fromEntries(request.headers)
  });
  
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
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

  // Get date range parameters
  const since = request.nextUrl.searchParams.get('since') || getDefaultSince();
  const until = request.nextUrl.searchParams.get('until') || getDefaultUntil();
  
  // Get cursor for pagination
  const cursor = request.nextUrl.searchParams.get('cursor') || null;
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
  
  try {
    // Get the authenticated user's info
    const userEmail = session.user.email;
    const userName = session.user.name;
    const userLogin = getUserLoginFromSession(session);
    
    logger.info(MODULE_NAME, "Fetching commits for authenticated user", {
      user: userName || userEmail,
      dateRange: { since, until },
      cursor,
      limit
    });
    
    // We'll use the access token from the session and/or installation ID
    const accessToken = session.accessToken as string;
    const installationId = session.installationId as number;
    
    if (!accessToken && !installationId) {
      logger.error(MODULE_NAME, "No authentication method available", {
        hasAccessToken: !!accessToken,
        hasInstallationId: !!installationId
      });
      
      return new NextResponse(JSON.stringify({ 
        error: "GitHub authentication required. Please sign in again.", 
        code: "GITHUB_AUTH_ERROR" 
      }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
    
    // Fetch all repositories accessible to the user
    let repositories: Repository[] = [];
    try {
      repositories = await fetchAllRepositories(accessToken, installationId);
    } catch (error: any) {
      logger.error(MODULE_NAME, "Error fetching repositories", { error });
      
      return new NextResponse(JSON.stringify({ 
        error: "Error fetching repositories: " + error.message,
        code: "GITHUB_REPO_ERROR"
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
    
    // Get repository full names for fetching commits
    const repoFullNames = repositories.map(repo => repo.full_name);
    
    // Fetch commits for all repositories
    let allCommits: Commit[] = [];
    try {
      allCommits = await fetchCommitsForRepositories(
        accessToken,
        installationId,
        repoFullNames,
        since,
        until,
        userLogin // Only fetch commits by the current user
      );
    } catch (error: any) {
      logger.error(MODULE_NAME, "Error fetching commits", { error });
      
      return new NextResponse(JSON.stringify({ 
        error: "Error fetching commits: " + error.message,
        code: "GITHUB_COMMIT_ERROR"
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
    
    // Optimize commits to reduce payload size
    const optimizedCommits = allCommits.map(commit => optimizeCommit(commit));
    
    // Apply pagination using cursor
    const { 
      pagedCommits, 
      hasMore, 
      nextCursor 
    } = applyPagination(optimizedCommits, cursor, limit);
    
    // Extract stats
    const stats = {
      totalCommits: allCommits.length,
      repositories: [...new Set(allCommits.map(commit => commit.repository?.full_name || ''))],
      dates: [...new Set(allCommits.map(commit => commit.commit.author?.date?.split('T')[0] || ''))]
    };
    
    // Construct the response
    const response: MyActivityResponse = {
      commits: pagedCommits,
      stats,
      pagination: {
        hasMore,
        ...(nextCursor && { nextCursor })
      },
      user: userName || userEmail || 'Unknown',
      dateRange: {
        since,
        until
      }
    };
    
    logger.info(MODULE_NAME, "Successfully fetched user's activity", { 
      totalCommits: allCommits.length,
      returnedCommits: pagedCommits.length,
      hasMore,
      repositories: stats.repositories.length
    });
    
    // Generate ETag for the response
    const etag = generateETag(response);
    
    // Check if client has valid cached data
    if (isCacheValid(request, etag)) {
      return notModifiedResponse(etag);
    }
    
    // Return the optimized and compressed response with cache headers
    return await optimizedJsonResponse(request, response, 200, {
      etag,
      maxAge: CacheTTL.SHORT, // Cache for 1 minute
      compress: true
    });
    
  } catch (error: any) {
    logger.error(MODULE_NAME, "Unexpected error processing request", { error });
    
    return await optimizedJsonResponse(request, { 
      error: "An unexpected error occurred: " + error.message,
      code: "UNEXPECTED_ERROR"
    }, 500);
  }
}

// Helper function to get a default "since" date (30 days ago)
function getDefaultSince(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().split('T')[0];
}

// Helper function to get default "until" date (today)
function getDefaultUntil(): string {
  return new Date().toISOString().split('T')[0];
}

// We now import generateETag from cache.ts

// Helper to extract user login from session
function getUserLoginFromSession(session: any): string | undefined {
  if (session.profile?.login) {
    return session.profile.login;
  }
  
  // Fallback to username or email if login not available
  return session.user?.name || session.user?.email?.split('@')[0];
}

// Helper to apply cursor-based pagination
function applyPagination<T extends { sha: string }>(commits: T[], cursor: string | null, limit: number): {
  pagedCommits: T[],
  hasMore: boolean,
  nextCursor?: string
} {
  if (commits.length === 0) {
    return { pagedCommits: [], hasMore: false };
  }
  
  // If we have a cursor, find its position
  let startIndex = 0;
  if (cursor) {
    const cursorIndex = commits.findIndex(commit => commit.sha === cursor);
    startIndex = cursorIndex !== -1 ? cursorIndex + 1 : 0;
  }
  
  // Get the page of commits
  const endIndex = Math.min(startIndex + limit, commits.length);
  const pagedCommits = commits.slice(startIndex, endIndex);
  
  // Check if there are more commits
  const hasMore = endIndex < commits.length;
  
  // Set the next cursor if there are more commits
  const nextCursor = hasMore ? commits[endIndex - 1].sha : undefined;
  
  return {
    pagedCommits,
    hasMore,
    nextCursor
  };
}