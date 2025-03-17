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

const MODULE_NAME = "api:my-org-activity";

// Response type for my-org-activity endpoint
type MyOrgActivityResponse = {
  commits: Commit[];
  stats: {
    totalCommits: number;
    repositories: string[];
    dates: string[];
    organizations: string[];
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
  organizations: string[];
  error?: string;
  code?: string;
};

export async function GET(request: NextRequest) {
  logger.debug(MODULE_NAME, "GET /api/my-org-activity request received", { 
    url: request.url,
    searchParams: Object.fromEntries(request.nextUrl.searchParams.entries()),
    headers: Object.fromEntries([...request.headers.entries()])
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
  
  // Get organization parameters
  const organizationsParam = request.nextUrl.searchParams.get('organizations');
  let organizations: string[] = [];
  
  if (organizationsParam) {
    organizations = organizationsParam.split(',').map(org => org.trim()).filter(Boolean);
  }
  
  // If no organizations specified, return empty results
  if (organizations.length === 0) {
    logger.info(MODULE_NAME, "No organizations specified, returning empty results");
    
    return new NextResponse(JSON.stringify({
      commits: [],
      stats: {
        totalCommits: 0,
        repositories: [],
        dates: [],
        organizations: []
      },
      pagination: {
        hasMore: false
      },
      user: session.user.name || session.user.email || 'Unknown',
      dateRange: {
        since,
        until
      },
      organizations: []
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=60", // Cache for 1 minute
      },
    });
  }
  
  try {
    // Get the authenticated user's info
    const userEmail = session.user.email;
    const userName = session.user.name;
    const userLogin = getUserLoginFromSession(session);
    
    logger.info(MODULE_NAME, "Fetching commits for authenticated user in specified organizations", {
      user: userName || userEmail,
      dateRange: { since, until },
      organizations,
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
    let allRepositories: Repository[] = [];
    try {
      allRepositories = await fetchAllRepositories(accessToken, installationId);
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
    
    // Filter repositories by the specified organizations
    const organizationLowerCase = organizations.map(org => org.toLowerCase());
    const filteredRepositories = allRepositories.filter(repo => {
      const ownerName = repo.full_name.split('/')[0].toLowerCase();
      return organizationLowerCase.includes(ownerName);
    });
    
    if (filteredRepositories.length === 0) {
      logger.info(MODULE_NAME, "No repositories found in the specified organizations", {
        requestedOrganizations: organizations
      });
      
      return new NextResponse(JSON.stringify({
        commits: [],
        stats: {
          totalCommits: 0,
          repositories: [],
          dates: [],
          organizations
        },
        pagination: {
          hasMore: false
        },
        user: userName || userEmail || 'Unknown',
        dateRange: {
          since,
          until
        },
        organizations
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "private, max-age=60", // Cache for 1 minute
        },
      });
    }
    
    // Get repository full names for fetching commits
    const repoFullNames = filteredRepositories.map(repo => repo.full_name);
    
    // Fetch commits for filtered repositories
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
    
    // Apply pagination using cursor
    const { 
      pagedCommits, 
      hasMore, 
      nextCursor 
    } = applyPagination(allCommits, cursor, limit);
    
    // Extract stats
    const stats = {
      totalCommits: allCommits.length,
      repositories: Array.from(new Set(allCommits.map(commit => commit.repository?.full_name || ''))),
      dates: Array.from(new Set(allCommits.map(commit => commit.commit.author?.date?.split('T')[0] || ''))),
      organizations
    };
    
    // Construct the response
    const response: MyOrgActivityResponse = {
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
      },
      organizations
    };
    
    logger.info(MODULE_NAME, "Successfully fetched user's activity in specified organizations", { 
      totalCommits: allCommits.length,
      returnedCommits: pagedCommits.length,
      hasMore,
      repositories: stats.repositories.length,
      organizations
    });
    
    // Return the response with cache headers
    return new NextResponse(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=60", // Cache for 1 minute
        "ETag": generateETag(response)
      },
    });
    
  } catch (error: any) {
    logger.error(MODULE_NAME, "Unexpected error processing request", { error });
    
    return new NextResponse(JSON.stringify({ 
      error: "An unexpected error occurred: " + error.message,
      code: "UNEXPECTED_ERROR"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
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

// Helper function to generate an ETag for caching
function generateETag(data: any): string {
  // Simple implementation - in a real app you might want to use a hash function
  return `"${Buffer.from(JSON.stringify(data)).toString('base64').slice(0, 40)}"`;
}

// Helper to extract user login from session
function getUserLoginFromSession(session: any): string | undefined {
  if (session.profile?.login) {
    return session.profile.login;
  }
  
  // Fallback to username or email if login not available
  return session.user?.name || (session.user?.email ? session.user.email.split('@')[0] : undefined);
}

// Helper to apply cursor-based pagination
function applyPagination(commits: Commit[], cursor: string | null, limit: number): {
  pagedCommits: Commit[],
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