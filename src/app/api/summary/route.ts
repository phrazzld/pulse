import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { 
  fetchAllRepositories, 
  fetchCommitsForRepositories, 
  Commit, 
  checkAppInstallation, 
  getAllAppInstallations,
  AppInstallation 
} from "@/lib/github";
import { generateCommitSummary } from "@/lib/gemini";
import { logger } from "@/lib/logger";

const MODULE_NAME = "api:summary";

// Type for grouped results
type GroupedResult = {
  groupKey: string;
  groupName: string;
  groupAvatar?: string;
  commitCount: number;
  repositories: string[];
  dates: string[];
  commits: Commit[];
  aiSummary?: any;
};

// Valid grouping options
type GroupBy = 'contributor' | 'organization' | 'repository' | 'chronological';

export async function GET(request: NextRequest) {
  logger.debug(MODULE_NAME, "GET /api/summary request received", { 
    url: request.url,
    searchParams: Object.fromEntries(request.nextUrl.searchParams.entries()),
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
  
  logger.info(MODULE_NAME, "Authenticated user requesting summary", { 
    user: session.user?.email || session.user?.name || 'unknown',
    authMethod: installationId ? "GitHub App" : "OAuth"
  });

  // Get query parameters
  const searchParams = request.nextUrl.searchParams;
  
  // Date range parameters (required)
  const since = searchParams.get("since");
  const until = searchParams.get("until");
  
  // Filter parameters
  const contributorsParam = searchParams.get("contributors");
  const contributors = contributorsParam ? contributorsParam.split(",") : [];
  
  const organizationsParam = searchParams.get("organizations");
  const organizations = organizationsParam ? organizationsParam.split(",") : [];
  
  const repositoriesParam = searchParams.get("repositories");
  const repositoryFilters = repositoriesParam ? repositoriesParam.split(",") : [];
  
  // Grouping parameter
  const groupByParam = searchParams.get("groupBy") as GroupBy;
  const groupBy: GroupBy = ['contributor', 'organization', 'repository', 'chronological'].includes(groupByParam) 
    ? groupByParam 
    : 'chronological';
  
  // Check if we should generate summaries for each group
  const generateGroupSummaries = searchParams.get("generateGroupSummaries") === 'true';
  
  logger.debug(MODULE_NAME, "Parsed query parameters", {
    since,
    until,
    contributors,
    organizations,
    repositories: repositoryFilters,
    groupBy,
    generateGroupSummaries
  });
  
  if (!since || !until) {
    logger.warn(MODULE_NAME, "Missing required date parameters");
    return new NextResponse(JSON.stringify({ error: "Missing required parameters: since and until dates" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // Get Gemini API key from environment variable
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    logger.error(MODULE_NAME, "Missing Gemini API key in environment variables");
    return new NextResponse(JSON.stringify({ error: "Server configuration error: Missing Gemini API key" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  try {
    // Fetch all repositories the user has access to
    logger.info(MODULE_NAME, "Fetching all accessible repos", {
      authMethod: installationId ? "GitHub App" : "OAuth"
    });
    
    const allRepos = await fetchAllRepositories(session.accessToken, installationId);
    
    // Apply organization and repository filters
    let filteredRepos = allRepos;
    
    if (organizations.length > 0) {
      filteredRepos = filteredRepos.filter(repo => {
        const orgName = repo.full_name.split('/')[0];
        return organizations.includes(orgName);
      });
      
      logger.debug(MODULE_NAME, "Applied organization filters", {
        originalCount: allRepos.length,
        filteredCount: filteredRepos.length,
        organizations
      });
    }
    
    if (repositoryFilters.length > 0) {
      filteredRepos = filteredRepos.filter(repo => 
        repositoryFilters.includes(repo.full_name)
      );
      
      logger.debug(MODULE_NAME, "Applied repository filters", {
        originalCount: allRepos.length,
        filteredCount: filteredRepos.length,
        repositoryFilters
      });
    }
    
    const reposToAnalyze = filteredRepos.map(repo => repo.full_name);
    
    logger.debug(MODULE_NAME, "Repositories to analyze after filtering", { 
      count: reposToAnalyze.length
    });
    
    if (reposToAnalyze.length === 0) {
      logger.warn(MODULE_NAME, "No repositories match the filter criteria");
      return new NextResponse(JSON.stringify({ 
        error: "No repositories match the specified filters",
        filterInfo: {
          organizations: organizations.length > 0 ? organizations : null,
          repositories: repositoryFilters.length > 0 ? repositoryFilters : null,
          contributors: contributors.length > 0 ? contributors : null,
          dateRange: { since, until }
        }
      }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
    
    const requestStartTime = Date.now();
    const commitFetchStartTime = Date.now();
    
    // Determine author filter
    let authorFilter: string | undefined = undefined;
    
    // If contributors has exactly one entry and it's 'me' or matches the session user,
    // set authorFilter to the current user
    if (contributors.length === 1) {
      if (contributors[0] === 'me' || contributors[0] === session.user?.name) {
        authorFilter = session.user?.name || undefined;
        logger.debug(MODULE_NAME, "Filtering for current user's commits", { authorFilter });
      } else {
        // Filter for specific contributor
        authorFilter = contributors[0];
        logger.debug(MODULE_NAME, "Filtering for specific contributor", { authorFilter });
      }
    }
    
    logger.debug(MODULE_NAME, "Fetching commits with filters", { 
      authorFilter,
      repoCount: reposToAnalyze.length,
      dateRange: { since, until }
    });
    
    const commits = await fetchCommitsForRepositories(
      session.accessToken,
      installationId, 
      reposToAnalyze, 
      since, 
      until,
      authorFilter
    );
    
    const commitFetchEndTime = Date.now();
    
    logger.info(MODULE_NAME, "Fetched commits", {
      commitCount: commits.length,
      timeMs: commitFetchEndTime - commitFetchStartTime,
    });
    
    // Filter commits by contributor if needed
    let filteredCommits = commits;
    
    if (contributors.length > 0 && !(contributors.length === 1 && (contributors[0] === 'me' || contributors[0] === session.user?.name))) {
      // Filtering for multiple contributors or a single contributor that isn't 'me'
      filteredCommits = commits.filter(commit => {
        const commitAuthor = commit.author?.login || commit.commit.author?.name;
        return contributors.includes(commitAuthor || '') || 
               (contributors.includes('me') && commitAuthor === session.user?.name);
      });
      
      logger.debug(MODULE_NAME, "Applied contributor filters", {
        originalCount: commits.length,
        filteredCount: filteredCommits.length,
        contributors
      });
    }
    
    // Group the commits based on the groupBy parameter
    let groupedResults: GroupedResult[] = [];
    
    if (groupBy === 'contributor') {
      // Group by contributor (author)
      const contributorGroups = new Map<string, Commit[]>();
      
      filteredCommits.forEach(commit => {
        const authorLogin = commit.author?.login || 'unknown';
        const authorName = commit.commit.author?.name || authorLogin;
        const key = authorLogin;
        
        if (!contributorGroups.has(key)) {
          contributorGroups.set(key, []);
        }
        
        contributorGroups.get(key)?.push(commit);
      });
      
      // Convert map to array of groups
      for (const [authorLogin, authorCommits] of contributorGroups.entries()) {
        const firstCommit = authorCommits[0];
        const authorName = firstCommit.commit.author?.name || authorLogin;
        const authorAvatar = firstCommit.author?.avatar_url;
        
        groupedResults.push({
          groupKey: authorLogin,
          groupName: authorName,
          groupAvatar: authorAvatar,
          commitCount: authorCommits.length,
          repositories: [...new Set(authorCommits.map(c => c.repository?.full_name || ''))],
          dates: [...new Set(authorCommits.map(c => c.commit.author.date.split('T')[0]))],
          commits: authorCommits,
          // AI summary will be added later if requested
        });
      }
      
      // Sort by commit count descending
      groupedResults.sort((a, b) => b.commitCount - a.commitCount);
      
    } else if (groupBy === 'organization') {
      // Group by organization
      const orgGroups = new Map<string, Commit[]>();
      
      filteredCommits.forEach(commit => {
        const repoFullName = commit.repository?.full_name || '';
        const orgName = repoFullName.split('/')[0];
        
        if (!orgGroups.has(orgName)) {
          orgGroups.set(orgName, []);
        }
        
        orgGroups.get(orgName)?.push(commit);
      });
      
      // Convert map to array of groups
      for (const [orgName, orgCommits] of orgGroups.entries()) {
        // Find an installation that matches this org for avatar
        const matchingInstallation = allInstallations.find(
          inst => inst.account.login === orgName
        );
        
        groupedResults.push({
          groupKey: orgName,
          groupName: orgName,
          groupAvatar: matchingInstallation?.account.avatarUrl,
          commitCount: orgCommits.length,
          repositories: [...new Set(orgCommits.map(c => c.repository?.full_name || ''))],
          dates: [...new Set(orgCommits.map(c => c.commit.author.date.split('T')[0]))],
          commits: orgCommits,
          // AI summary will be added later if requested
        });
      }
      
      // Sort by commit count descending
      groupedResults.sort((a, b) => b.commitCount - a.commitCount);
      
    } else if (groupBy === 'repository') {
      // Group by repository
      const repoGroups = new Map<string, Commit[]>();
      
      filteredCommits.forEach(commit => {
        const repoFullName = commit.repository?.full_name || '';
        
        if (!repoGroups.has(repoFullName)) {
          repoGroups.set(repoFullName, []);
        }
        
        repoGroups.get(repoFullName)?.push(commit);
      });
      
      // Convert map to array of groups
      for (const [repoName, repoCommits] of repoGroups.entries()) {
        // Find the repo details from our fetched list
        const repoDetails = allRepos.find(repo => repo.full_name === repoName);
        
        groupedResults.push({
          groupKey: repoName,
          groupName: repoName,
          commitCount: repoCommits.length,
          repositories: [repoName],
          dates: [...new Set(repoCommits.map(c => c.commit.author.date.split('T')[0]))],
          commits: repoCommits,
          // AI summary will be added later if requested
        });
      }
      
      // Sort by commit count descending
      groupedResults.sort((a, b) => b.commitCount - a.commitCount);
      
    } else {
      // Default: chronological (no grouping)
      // Just put all commits in a single group
      groupedResults = [{
        groupKey: 'all',
        groupName: 'All Commits',
        commitCount: filteredCommits.length,
        repositories: [...new Set(filteredCommits.map(c => c.repository?.full_name || ''))],
        dates: [...new Set(filteredCommits.map(c => c.commit.author.date.split('T')[0]))],
        commits: filteredCommits,
        // AI summary will be added later
      }];
    }
    
    // Generate AI summaries for overall and for each group if requested
    logger.debug(MODULE_NAME, "Generating AI summaries", {
      generateOverallSummary: true,
      generateGroupSummaries,
      groupCount: groupedResults.length
    });
    
    // Generate overall summary first
    const aiSummaryStartTime = Date.now();
    let overallSummary = null;
    
    if (filteredCommits.length > 0) {
      overallSummary = await generateCommitSummary(filteredCommits, geminiApiKey);
      logger.info(MODULE_NAME, "Generated overall AI summary", {
        timeMs: Date.now() - aiSummaryStartTime,
        keyThemes: overallSummary.keyThemes.length,
        technicalAreas: overallSummary.technicalAreas.length
      });
    }
    
    // Generate group summaries if requested
    if (generateGroupSummaries && groupedResults.length > 1) {
      // Generate summaries for up to 5 largest groups to avoid excessive API calls
      const groupsToSummarize = groupedResults
        .filter(group => group.commitCount >= 5) // Only summarize groups with enough commits
        .slice(0, 5); // Limit to 5 groups
      
      logger.debug(MODULE_NAME, "Generating group summaries", {
        eligibleGroups: groupsToSummarize.length,
        totalGroups: groupedResults.length
      });
      
      // Generate summaries in parallel
      const summaryPromises = groupsToSummarize.map(async group => {
        if (group.commits.length > 0) {
          try {
            const groupSummary = await generateCommitSummary(group.commits, geminiApiKey);
            return { groupKey: group.groupKey, summary: groupSummary };
          } catch (error) {
            logger.warn(MODULE_NAME, `Error generating summary for group ${group.groupKey}`, { error });
            return { groupKey: group.groupKey, summary: null };
          }
        }
        return { groupKey: group.groupKey, summary: null };
      });
      
      const groupSummaries = await Promise.all(summaryPromises);
      
      // Assign summaries to the correct groups
      groupSummaries.forEach(result => {
        if (result.summary) {
          const group = groupedResults.find(g => g.groupKey === result.groupKey);
          if (group) {
            group.aiSummary = result.summary;
          }
        }
      });
      
      logger.info(MODULE_NAME, "Generated group summaries", {
        completedSummaries: groupSummaries.filter(s => s.summary).length,
        totalAttempted: groupsToSummarize.length
      });
    }
    
    // Generate basic overall stats
    const overallStats = generateBasicStats(filteredCommits);
    
    const totalTime = Date.now() - requestStartTime;
    logger.info(MODULE_NAME, "Completed summary request with filtering and grouping", {
      totalTimeMs: totalTime,
      commitCount: filteredCommits.length,
      groupCount: groupedResults.length,
      groupBy
    });
    
    // Prepare the response with all the data
    return NextResponse.json({
      user: session.user?.name,
      // Legacy fields for backward compatibility
      commits: filteredCommits,
      stats: overallStats,
      aiSummary: overallSummary,
      // New fields for filtering and grouping
      filterInfo: {
        contributors: contributors.length > 0 ? contributors : null,
        organizations: organizations.length > 0 ? organizations : null,
        repositories: repositoryFilters.length > 0 ? repositoryFilters : null,
        dateRange: { since, until },
        groupBy
      },
      groupedResults,
      // Authentication and installation info
      authMethod: installationId ? "github_app" : "oauth",
      installationId: installationId || null,
      installations: allInstallations,
      currentInstallation: allInstallations.find(i => i.id === installationId)
    });
  } catch (error) {
    logger.error(MODULE_NAME, "Error generating summary", { 
      error,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Check what kind of error we have
    const isAuthError = error?.name === 'HttpError' && 
                        (error?.message?.includes('credentials') || 
                        error?.message?.includes('authentication'));
    
    const isAppError = error?.message?.includes('GitHub App credentials not configured');
    
    let errorMessage = "Failed to generate summary";
    let errorCode = "API_ERROR";
    
    if (isAppError) {
      errorMessage = "GitHub App not properly configured. Please contact the administrator.";
      errorCode = "GITHUB_APP_CONFIG_ERROR";
    } else if (isAuthError) {
      errorMessage = "GitHub authentication failed. Your authentication is invalid or expired.";
      errorCode = "GITHUB_AUTH_ERROR";
    }
    
    return new NextResponse(JSON.stringify({ 
      error: errorMessage, 
      details: error instanceof Error ? error.message : "Unknown error",
      code: errorCode
    }), {
      status: (isAuthError || isAppError) ? 403 : 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

function generateBasicStats(commits: Commit[]) {
  logger.debug(MODULE_NAME, "Generating basic stats", { commitCount: commits.length });
  
  // Generate basic statistics about the commits
  const stats = {
    totalCommits: commits.length,
    repositories: [...new Set(commits.map((commit) => commit.repository?.full_name || commit.html_url.split('/').slice(3, 5).join('/')))],
    dates: [...new Set(commits.map((commit) => commit.commit.author.date.split('T')[0]))],
  };
  
  logger.debug(MODULE_NAME, "Basic stats generated", {
    totalCommits: stats.totalCommits,
    uniqueRepos: stats.repositories.length,
    uniqueDates: stats.dates.length
  });
  
  return stats;
}