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
  const since = searchParams.get("since");
  const until = searchParams.get("until");
  const repoParam = searchParams.get("repos");
  
  logger.debug(MODULE_NAME, "Parsed query parameters", {
    since,
    until,
    repos: repoParam ? repoParam.split(",") : []
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
    // Always fetch all accessible repos
    logger.info(MODULE_NAME, "Fetching all accessible repos", {
      authMethod: installationId ? "GitHub App" : "OAuth"
    });
    
    const allRepos = await fetchAllRepositories(session.accessToken, installationId);
    const reposToAnalyze = allRepos.map(repo => repo.full_name);
    
    logger.debug(MODULE_NAME, "All accessible repositories", { 
      count: reposToAnalyze.length,
      authMethod: installationId ? "GitHub App" : "OAuth" 
    });
    
    const requestStartTime = Date.now();
    
    logger.info(MODULE_NAME, "Generating individual summary", {
      user: session.user?.name,
      repoCount: reposToAnalyze.length,
      dateRange: { since, until }
    });
    
    const commitFetchStartTime = Date.now();
    
    // Extract author from either username or derive from repository
    // First try with username from session, GitHub API will try alternatives if needed
    const authorName = session.user?.name || "";
    
    logger.debug(MODULE_NAME, "Fetching commits with author", { 
      authorName,
      firstRepo: reposToAnalyze.length > 0 ? reposToAnalyze[0] : null,
      authMethod: installationId ? "GitHub App" : "OAuth"
    });
    
    const commits = await fetchCommitsForRepositories(
      session.accessToken,
      installationId, 
      reposToAnalyze, 
      since, 
      until,
      authorName
    );
    const commitFetchEndTime = Date.now();
    
    logger.info(MODULE_NAME, "Fetched commits for individual summary", {
      user: session.user?.name,
      commitCount: commits.length,
      timeMs: commitFetchEndTime - commitFetchStartTime,
      authMethod: installationId ? "GitHub App" : "OAuth"
    });
    
    // Generate AI summary using Gemini
    logger.debug(MODULE_NAME, "Generating AI summary for individual commits");
    const aiSummaryStartTime = Date.now();
    const aiSummary = await generateCommitSummary(commits, geminiApiKey);
    const aiSummaryEndTime = Date.now();
    
    logger.info(MODULE_NAME, "Generated AI summary for individual commits", {
      timeMs: aiSummaryEndTime - aiSummaryStartTime,
      keyThemes: aiSummary.keyThemes.length,
      technicalAreas: aiSummary.technicalAreas.length
    });
    
    const stats = generateBasicStats(commits);
    logger.debug(MODULE_NAME, "Generated basic stats", stats);
    
    const totalTime = Date.now() - requestStartTime;
    logger.info(MODULE_NAME, "Completed individual summary request", {
      totalTimeMs: totalTime,
      commitCount: commits.length,
      repoCount: stats.repositories.length,
      authMethod: installationId ? "GitHub App" : "OAuth"
    });
    
    return NextResponse.json({
      user: session.user?.name,
      commits,
      stats,
      aiSummary,
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