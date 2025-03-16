import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { fetchAllRepositories, fetchCommitsForRepositories, Commit } from "@/lib/github";
import { logger } from "@/lib/logger";
import { generateETag, isCacheValid, notModifiedResponse, cachedJsonResponse, CacheTTL, generateCacheControl } from "@/lib/cache";

const MODULE_NAME = "api:contributors";

// Define a more optimized contributor type
type OptimizedContributor = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  commitCount?: number;
};

export async function GET(request: NextRequest) {
  logger.debug(MODULE_NAME, "GET /api/contributors request received", { 
    url: request.url,
    headers: Object.fromEntries([...request.headers.entries()])
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

  // Get organization filters if present
  const organizationsParam = request.nextUrl.searchParams.get('organizations');
  const organizations = organizationsParam ? organizationsParam.split(',') : [];
  
  // Get repository filters if present
  const repositoriesParam = request.nextUrl.searchParams.get('repositories');
  const repositoryFilters = repositoriesParam ? repositoriesParam.split(',') : [];
  
  // Get date range if provided (optional for contributor list)
  const since = request.nextUrl.searchParams.get('since') || '';
  const until = request.nextUrl.searchParams.get('until') || '';
  
  // Create cache key based on query parameters and user
  const cacheKey = {
    user: session.user?.email || 'unknown',
    installationId: installationId || 'oauth',
    organizations,
    repositories: repositoryFilters,
    since,
    until,
    includeCommitCount: request.nextUrl.searchParams.get('include_commit_count') === 'true',
    // Add a timestamp that changes every 15 minutes for semi-frequently changing data
    timestamp: Math.floor(Date.now() / (CacheTTL.MEDIUM * 1000))
  };
  
  const etag = generateETag(cacheKey);
  
  // Check if client has valid cached data
  if (isCacheValid(request, etag)) {
    logger.info(MODULE_NAME, "Returning 304 Not Modified - client has current contributor data", {
      etag,
      filters: {
        organizations: organizations.length,
        repositories: repositoryFilters.length,
        since,
        until
      }
    });
    
    return notModifiedResponse(etag, generateCacheControl(CacheTTL.MEDIUM, CacheTTL.MEDIUM * 2));
  }
  
  logger.info(MODULE_NAME, "Fetching contributors with filters", {
    hasInstallationId: !!installationId,
    hasAccessToken: !!session.accessToken,
    organizationFilters: organizations.length,
    repositoryFilters: repositoryFilters.length,
    dateRange: { since, until }
  });

  try {
    // Fetch repositories
    const repositories = await fetchAllRepositories(session.accessToken, installationId);
    
    // Apply organization and repository filters
    let filteredRepos = repositories;
    
    if (organizations.length > 0) {
      filteredRepos = filteredRepos.filter(repo => {
        const orgName = repo.full_name.split('/')[0].toLowerCase();
        return organizations.some(org => org.toLowerCase() === orgName);
      });
    }
    
    if (repositoryFilters.length > 0) {
      filteredRepos = filteredRepos.filter(repo => 
        repositoryFilters.some(filter => filter.toLowerCase() === repo.full_name.toLowerCase())
      );
    }
    
    const repoNames = filteredRepos.map(repo => repo.full_name);
    
    // Determine if we need to fetch commits for accurate contributor information
    const needCommits = since || until || request.nextUrl.searchParams.get('include_commit_count') === 'true';
    
    let commits: Commit[] = [];
    if (needCommits && repoNames.length > 0) {
      commits = await fetchCommitsForRepositories(
        session.accessToken,
        installationId,
        repoNames,
        since,
        until
      );
    }
    
    // Extract unique contributors
    const contributorsMap = new Map<string, OptimizedContributor>();
    
    if (needCommits && commits.length > 0) {
      // Extract from commits if we have them
      commits.forEach(commit => {
        if (!commit.author) return; // Skip commits without author info
        
        const username = commit.author.login;
        const displayName = commit.commit.author?.name || username;
        const avatarUrl = commit.author.avatar_url || null;
        
        if (contributorsMap.has(username)) {
          // Increment commit count for existing contributor
          const existing = contributorsMap.get(username);
          if (existing) {
            existing.commitCount = (existing.commitCount || 0) + 1;
          }
        } else {
          // Add new contributor - omit email for privacy/optimization
          contributorsMap.set(username, {
            username,
            displayName,
            avatarUrl,
            commitCount: 1
          });
        }
      });
    } else {
      // If no date range is provided, we'll fetch recent commits (last 30 days)
      // to show some contributors even without explicit date filters
      logger.info(MODULE_NAME, "No date range provided, using last 30 days as default");
      
      if (repoNames.length > 0) {
        // Calculate last 30 days date range
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        try {
          const defaultCommits = await fetchCommitsForRepositories(
            session.accessToken,
            installationId,
            repoNames,
            startDate,
            endDate
          );
          
          // Extract unique contributors from these commits
          defaultCommits.forEach(commit => {
            if (!commit.author) return; // Skip commits without author info
            
            const username = commit.author.login;
            const displayName = commit.commit.author?.name || username;
            const avatarUrl = commit.author.avatar_url || null;
            
            if (contributorsMap.has(username)) {
              // Increment commit count for existing contributor
              const existing = contributorsMap.get(username);
              if (existing) {
                existing.commitCount = (existing.commitCount || 0) + 1;
              }
            } else {
              // Add new contributor
              contributorsMap.set(username, {
                username,
                displayName,
                avatarUrl,
                commitCount: 1
              });
            }
          });
          
          logger.info(MODULE_NAME, "Fetched default contributors using last 30 days", {
            count: contributorsMap.size,
            commits: defaultCommits.length
          });
        } catch (error) {
          logger.error(MODULE_NAME, "Error fetching default contributors", { error });
          logger.info(MODULE_NAME, "Falling back to empty contributor set");
        }
      } else {
        logger.info(MODULE_NAME, "No repositories available, returning empty contributor set");
      }
    }
    
    // Convert map to array and sort by commit count or name
    const contributors = Array.from(contributorsMap.values())
      .sort((a, b) => {
        // Sort by commit count if available, otherwise by name
        if (a.commitCount && b.commitCount) {
          return b.commitCount - a.commitCount;
        }
        return a.displayName.localeCompare(b.displayName);
      });
    
    logger.info(MODULE_NAME, "Successfully fetched contributors", {
      count: contributors.length,
      filteredRepos: repoNames.length,
      totalCommits: commits.length
    });
    
    // Create response data
    const responseData = {
      contributors,
      filterInfo: {
        organizations: organizations.length > 0 ? organizations : null,
        repositories: repositoryFilters.length > 0 ? repositoryFilters : null,
        dateRange: since || until ? { since, until } : null
      }
    };
    
    // Return cached JSON response with appropriate headers
    return cachedJsonResponse(responseData, 200, {
      etag,
      maxAge: CacheTTL.MEDIUM, // Cache for 15 minutes
      staleWhileRevalidate: CacheTTL.MEDIUM * 2 // Allow stale content for 30 minutes while revalidating
    });
    
  } catch (error) {
    logger.error(MODULE_NAME, "Error fetching contributors", { error });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return cachedJsonResponse({ 
      error: "Failed to fetch contributors",
      details: errorMessage
    }, 500);
  }
}