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
import { optimizedJsonResponse, isCacheValid, notModifiedResponse, CacheTTL, generateETag } from "@/lib/cache";
import { optimizeCommit, optimizeRepository, optimizeContributor, MinimalCommit, MinimalRepository, MinimalContributor } from "@/lib/optimize";

const MODULE_NAME = "api:team-activity";

// Response type for team-activity endpoint
type TeamActivityResponse = {
  commits: MinimalCommit[];
  stats: {
    totalCommits: number;
    repositories: string[];
    dates: string[];
    organizations: string[];
    contributors: { 
      username: string;
      display_name: string;
      avatar_url: string | null;
    }[];
  };
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
  };
  dateRange: {
    since: string;
    until: string;
  };
  organizations: string[];
  error?: string;
  code?: string;
};

export async function GET(request: NextRequest) {
  logger.debug(MODULE_NAME, "GET /api/team-activity request received", { 
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
    
    return await optimizedJsonResponse(
      request,
      {
        commits: [],
        stats: {
          totalCommits: 0,
          repositories: [],
          dates: [],
          organizations: [],
          contributors: []
        },
        pagination: {
          hasMore: false
        },
        dateRange: {
          since,
          until
        },
        organizations: []
      },
      200,
      {
        maxAge: CacheTTL.SHORT, // Cache for 1 minute
        compress: true
      }
    );
  }
  
  try {
    logger.info(MODULE_NAME, "Fetching team commits in specified organizations", {
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
          organizations,
          contributors: []
        },
        pagination: {
          hasMore: false
        },
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
    
    // Fetch commits for filtered repositories (for all team members - no author filter)
    let allCommits: Commit[] = [];
    try {
      allCommits = await fetchCommitsForRepositories(
        accessToken,
        installationId,
        repoFullNames,
        since,
        until
        // No author parameter - we want all team members' commits
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
    
    // Extract unique contributors with minimal data
    const contributorsMap = new Map<string, MinimalContributor>();
    
    // Process commits to extract contributor data
    allCommits.forEach(commit => {
      if (commit.author) {
        const username = commit.author.login;
        if (!contributorsMap.has(username)) {
          contributorsMap.set(username, {
            username,
            display_name: commit.commit.author?.name || username,
            avatar_url: commit.author.avatar_url
          });
        }
      }
    });
    
    const contributors = Array.from(contributorsMap.values());
    
    // Optimize commits to reduce payload size
    const optimizedCommits = allCommits.map(commit => {
      // Convert to our minimal optimized format
      const minimalCommit = optimizeCommit(commit);
      
      // Add contributor information if available
      if (commit.author && contributorsMap.has(commit.author.login)) {
        minimalCommit.author_login = commit.author.login;
        minimalCommit.author_avatar = commit.author.avatar_url;
      }
      
      return minimalCommit;
    });
    
    // Apply pagination using cursor
    const { 
      pagedCommits, 
      hasMore, 
      nextCursor 
    } = applyPagination(optimizedCommits, cursor, limit);
    
    // Extract stats
    const stats = {
      totalCommits: allCommits.length,
      repositories: Array.from(new Set(allCommits.map(commit => commit.repository?.full_name || ''))),
      dates: Array.from(new Set(allCommits.map(commit => commit.commit.author?.date?.split('T')[0] || ''))),
      organizations,
      contributors
    };
    
    // Construct the response
    const response: TeamActivityResponse = {
      commits: pagedCommits,
      stats,
      pagination: {
        hasMore,
        ...(nextCursor && { nextCursor })
      },
      dateRange: {
        since,
        until
      },
      organizations
    };
    
    logger.info(MODULE_NAME, "Successfully fetched team activity in specified organizations", { 
      totalCommits: allCommits.length,
      returnedCommits: pagedCommits.length,
      hasMore,
      repositories: stats.repositories.length,
      contributors: contributors.length,
      organizations
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

// Helper to apply cursor-based pagination
function applyPagination(commits: MinimalCommit[], cursor: string | null, limit: number): {
  pagedCommits: MinimalCommit[],
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