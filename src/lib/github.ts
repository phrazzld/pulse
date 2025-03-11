import { Octokit } from "octokit";
import { logger } from "./logger";

const MODULE_NAME = "github";

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  private: boolean;
  html_url: string;
  description: string | null;
  updated_at: string;
  language: string | null;
}

export interface Commit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  html_url: string;
  author: {
    login: string;
    avatar_url: string;
  } | null;
  repository?: {
    full_name: string;
  };
}

// Fetch all repositories accessible to the authenticated user
export async function fetchAllRepositories(accessToken: string): Promise<Repository[]> {
  logger.debug(MODULE_NAME, "fetchAllRepositories called", { accessTokenLength: accessToken?.length });
  const octokit = new Octokit({ auth: accessToken });
  let allRepos: Repository[] = [];
  
  try {
    // 1. Fetch user-owned repositories
    logger.debug(MODULE_NAME, "Fetching user-owned repositories");
    const userRepos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
      per_page: 100,
      sort: "updated",
      affiliation: "owner",
    });
    logger.info(MODULE_NAME, "Fetched user-owned repositories", { count: userRepos.length });
    allRepos = [...userRepos];

    // 2. Fetch repositories the user collaborates on
    logger.debug(MODULE_NAME, "Fetching collaborator repositories");
    const collaboratorRepos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
      per_page: 100,
      sort: "updated",
      affiliation: "collaborator",
    });
    logger.info(MODULE_NAME, "Fetched collaborator repositories", { count: collaboratorRepos.length });
    allRepos = [...allRepos, ...collaboratorRepos];

    // 3. Fetch repositories from organizations the user belongs to
    logger.debug(MODULE_NAME, "Fetching user organizations");
    const orgs = await octokit.paginate(octokit.rest.orgs.listForAuthenticatedUser, {
      per_page: 100,
    });
    logger.info(MODULE_NAME, "Fetched user organizations", { count: orgs.length, orgs: orgs.map(org => org.login) });
    
    for (const org of orgs) {
      logger.debug(MODULE_NAME, `Fetching repositories for org: ${org.login}`);
      const orgRepos = await octokit.paginate(octokit.rest.repos.listForOrg, {
        org: org.login,
        per_page: 100,
        sort: "updated",
      });
      logger.info(MODULE_NAME, `Fetched repositories for org: ${org.login}`, { count: orgRepos.length });
      allRepos = [...allRepos, ...orgRepos];
    }

    // Deduplicate repositories by full_name
    logger.debug(MODULE_NAME, "Deduplicating repositories", { beforeCount: allRepos.length });
    const uniqueRepos = Array.from(
      new Map(allRepos.map(repo => [repo.full_name, repo])).values()
    );
    logger.info(MODULE_NAME, "Deduplicated repositories", { 
      afterCount: uniqueRepos.length,
      duplicatesRemoved: allRepos.length - uniqueRepos.length 
    });

    return uniqueRepos;
  } catch (error) {
    logger.error(MODULE_NAME, "Error fetching repositories", { error });
    throw error;
  }
}

// Fetch commits for a single repository within a date range
export async function fetchRepositoryCommits(
  accessToken: string,
  owner: string,
  repo: string, 
  since: string,
  until: string,
  author?: string
): Promise<Commit[]> {
  logger.debug(MODULE_NAME, `fetchRepositoryCommits called for ${owner}/${repo}`, { 
    since, 
    until, 
    author: author || 'not specified'
  });
  
  const octokit = new Octokit({ auth: accessToken });
  
  try {
    logger.debug(MODULE_NAME, `Starting pagination for ${owner}/${repo} commits`);
    const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
      owner,
      repo,
      since,
      until,
      author,
      per_page: 100,
    });
    
    logger.info(MODULE_NAME, `Fetched commits for ${owner}/${repo}`, { 
      count: commits.length,
      firstCommitSha: commits.length > 0 ? commits[0].sha : null,
      lastCommitSha: commits.length > 0 ? commits[commits.length - 1].sha : null
    });
    
    // Add repository information to each commit
    const commitsWithRepoInfo = commits.map(commit => ({
      ...commit,
      repository: {
        full_name: `${owner}/${repo}`
      }
    }));
    
    return commitsWithRepoInfo;
  } catch (error) {
    logger.error(MODULE_NAME, `Error fetching commits for ${owner}/${repo}`, { error });
    // Return empty array for repositories we can't access
    return [];
  }
}

// Fetch commits for multiple repositories within a date range
export async function fetchCommitsForRepositories(
  accessToken: string,
  repositories: string[],
  since: string,
  until: string,
  author?: string
): Promise<Commit[]> {
  logger.debug(MODULE_NAME, "fetchCommitsForRepositories called", { 
    repositoriesCount: repositories.length, 
    since, 
    until, 
    author: author || 'not specified' 
  });
  
  const allCommits: Commit[] = [];
  
  // Extract GitHub username from repositories if author is provided but no commits are found
  // This fixes issues where display name doesn't match GitHub username
  let githubUsername = author;
  
  // Process repositories in batches to avoid overwhelming the API
  const batchSize = 5;
  logger.debug(MODULE_NAME, `Processing repositories in batches of ${batchSize}`);
  
  // First attempt with provided author name
  for (let i = 0; i < repositories.length; i += batchSize) {
    const batch = repositories.slice(i, i + batchSize);
    logger.debug(MODULE_NAME, `Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(repositories.length/batchSize)}`, { 
      batchRepos: batch 
    });
    
    const batchPromises = batch.map(repoFullName => {
      const [owner, repo] = repoFullName.split('/');
      return fetchRepositoryCommits(accessToken, owner, repo, since, until, githubUsername);
    });
    
    const batchResults = await Promise.all(batchPromises);
    let batchCommitCount = 0;
    
    batchResults.forEach(commits => {
      allCommits.push(...commits);
      batchCommitCount += commits.length;
    });
    
    logger.info(MODULE_NAME, `Batch ${Math.floor(i/batchSize) + 1} processed`, { 
      batchCommitCount, 
      totalCommitsSoFar: allCommits.length 
    });
  }
  
  // If no commits were found with the provided author name, try again with repository owner as username
  if (allCommits.length === 0 && author) {
    logger.info(MODULE_NAME, "No commits found with provided author name, trying with repository owner as author");
    
    // Try getting the username from the first repository's owner
    if (repositories.length > 0) {
      const [owner] = repositories[0].split('/');
      githubUsername = owner;
      
      logger.debug(MODULE_NAME, "Retrying with extracted username", { 
        originalAuthor: author,
        extractedUsername: githubUsername 
      });
      
      // Retry with the extracted username
      for (let i = 0; i < repositories.length; i += batchSize) {
        const batch = repositories.slice(i, i + batchSize);
        logger.debug(MODULE_NAME, `Retrying batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(repositories.length/batchSize)}`, { 
          batchRepos: batch 
        });
        
        const batchPromises = batch.map(repoFullName => {
          const [owner, repo] = repoFullName.split('/');
          return fetchRepositoryCommits(accessToken, owner, repo, since, until, githubUsername);
        });
        
        const batchResults = await Promise.all(batchPromises);
        let batchCommitCount = 0;
        
        batchResults.forEach(commits => {
          allCommits.push(...commits);
          batchCommitCount += commits.length;
        });
        
        logger.info(MODULE_NAME, `Retry batch ${Math.floor(i/batchSize) + 1} processed`, { 
          batchCommitCount, 
          totalCommitsSoFar: allCommits.length 
        });
      }
    }
  }
  
  // If still no commits found, try without author filter as a fallback
  if (allCommits.length === 0 && author) {
    logger.info(MODULE_NAME, "No commits found with author filter, trying without author filter");
    
    for (let i = 0; i < repositories.length; i += batchSize) {
      const batch = repositories.slice(i, i + batchSize);
      logger.debug(MODULE_NAME, `Final retry batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(repositories.length/batchSize)} without author filter`, { 
        batchRepos: batch 
      });
      
      const batchPromises = batch.map(repoFullName => {
        const [owner, repo] = repoFullName.split('/');
        // Pass undefined to omit author parameter completely
        return fetchRepositoryCommits(accessToken, owner, repo, since, until, undefined);
      });
      
      const batchResults = await Promise.all(batchPromises);
      let batchCommitCount = 0;
      
      batchResults.forEach(commits => {
        allCommits.push(...commits);
        batchCommitCount += commits.length;
      });
      
      logger.info(MODULE_NAME, `Final retry batch ${Math.floor(i/batchSize) + 1} processed without author filter`, { 
        batchCommitCount, 
        totalCommitsSoFar: allCommits.length 
      });
    }
  }
  
  logger.info(MODULE_NAME, "All repository commits fetched", { 
    totalRepositories: repositories.length,
    totalCommits: allCommits.length,
    finalAuthorFilter: githubUsername || 'none'
  });
  
  return allCommits;
}