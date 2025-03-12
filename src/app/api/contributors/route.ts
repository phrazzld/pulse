import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { fetchAllRepositories, fetchCommitsForRepositories } from "@/lib/github";
import { logger } from "@/lib/logger";

const MODULE_NAME = "api:contributors";

type Contributor = {
  username: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  commitCount?: number;
};

export async function GET(request: NextRequest) {
  logger.debug(MODULE_NAME, "GET /api/contributors request received", { 
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

  // Get organization filters if present
  const organizationsParam = request.nextUrl.searchParams.get('organizations');
  const organizations = organizationsParam ? organizationsParam.split(',') : [];
  
  // Get repository filters if present
  const repositoriesParam = request.nextUrl.searchParams.get('repositories');
  const repositoryFilters = repositoriesParam ? repositoriesParam.split(',') : [];
  
  // Get date range if provided (optional for contributor list)
  const since = request.nextUrl.searchParams.get('since') || '';
  const until = request.nextUrl.searchParams.get('until') || '';
  
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
        const orgName = repo.full_name.split('/')[0];
        return organizations.includes(orgName);
      });
    }
    
    if (repositoryFilters.length > 0) {
      filteredRepos = filteredRepos.filter(repo => 
        repositoryFilters.includes(repo.full_name)
      );
    }
    
    const repoNames = filteredRepos.map(repo => repo.full_name);
    
    // Determine if we need to fetch commits for accurate contributor information
    const needCommits = since || until || request.nextUrl.searchParams.get('include_commit_count') === 'true';
    
    let commits = [];
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
    const contributorsMap = new Map<string, Contributor>();
    
    if (needCommits && commits.length > 0) {
      // Extract from commits if we have them
      commits.forEach(commit => {
        if (!commit.author) return; // Skip commits without author info
        
        const username = commit.author.login;
        const displayName = commit.commit.author?.name || username;
        const email = commit.commit.author?.email || null;
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
            email,
            avatarUrl,
            commitCount: 1
          });
        }
      });
    } else {
      // We'll need to add placeholder logic here for when we don't have commits
      // but want to show potential contributors
      // This would typically involve querying the GitHub API for repository collaborators
      // But for now, we'll just return an empty set
      logger.info(MODULE_NAME, "No commits or date range provided, returning empty contributor set");
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
    
    return NextResponse.json({
      contributors,
      filterInfo: {
        organizations: organizations.length > 0 ? organizations : null,
        repositories: repositoryFilters.length > 0 ? repositoryFilters : null,
        dateRange: since || until ? { since, until } : null
      }
    });
  } catch (error) {
    logger.error(MODULE_NAME, "Error fetching contributors", { error });
    
    return new NextResponse(JSON.stringify({ 
      error: "Failed to fetch contributors",
      details: error.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}