// github.ts

import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";
import { logger } from "./logger";

const MODULE_NAME = "github";

// loosen up the fields that github can return as null or undefined
export interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    // you could add node_id?: string; avatar_url?: string; etc. if you need them
  };
  private: boolean;
  html_url: string;
  description: string | null;
  updated_at?: string | null;
  language?: string | null;
  // optionally: license?: License|null;
}

export interface Commit {
  sha: string;
  commit: {
    author: {
      name?: string;
      email?: string;
      date?: string;
    } | null;
    committer?: {
      name?: string;
      email?: string;
      date?: string;
    } | null;
    message: string;
    // Add other properties that might exist
    [key: string]: any;
  };
  html_url: string;
  author: {
    login: string;
    avatar_url: string;
    // Add other properties that might exist
    [key: string]: any;
  } | null;
  repository?: {
    full_name: string;
  };
  // Allow other properties from the GitHub API
  [key: string]: any;
}

// Installation type for managing multiple installations
export interface AppInstallation {
  id: number;
  account: {
    login: string;
    type?: string;
    avatarUrl?: string;
  } | null;
  appSlug: string;
  appId: number;
  repositorySelection: string;
  targetType: string; // 'User' or 'Organization'
}

/**
 * Generate the URL for managing a GitHub App installation
 * @param installationId The installation ID
 * @param accountLogin The account login (organization or user)
 * @param accountType The account type ('Organization' or 'User')
 * @returns The URL to GitHub's installation management page
 */
export function getInstallationManagementUrl(
  installationId: number,
  accountLogin?: string | null,
  accountType?: string | null,
): string {
  // For organization installations
  if (accountType === "Organization" && accountLogin) {
    return `https://github.com/organizations/${accountLogin}/settings/installations/${installationId}`;
  }

  // For user installations or when we don't have specific information
  return `https://github.com/settings/installations/${installationId}`;
}

// Get all GitHub App installations for the authenticated user
export async function getAllAppInstallations(
  accessToken: string,
): Promise<AppInstallation[]> {
  logger.debug(MODULE_NAME, "getAllAppInstallations called", {
    accessTokenLength: accessToken?.length,
  });

  try {
    const octokit = new Octokit({ auth: accessToken });

    // Get all installations for the authenticated user
    const { data } =
      await octokit.rest.apps.listInstallationsForAuthenticatedUser();

    // Find our app's installations
    const appName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME;
    const appId = process.env.GITHUB_APP_ID;

    logger.debug(MODULE_NAME, "Retrieved user installations", {
      installationsCount: data.installations.length,
      appName,
      appId,
    });

    // Filter installations by app name/id if provided
    let filteredInstallations = data.installations;
    if (appName || appId) {
      filteredInstallations = data.installations.filter(
        (inst) => inst.app_slug === appName || inst.app_id.toString() === appId,
      );
    }

    // Map to our simplified format
    const installations: AppInstallation[] = filteredInstallations.map((inst) => {
      // Ensure we have a valid account object
      if (!inst.account || typeof inst.account !== 'object') {
        return {
          id: inst.id,
          account: null,
          appSlug: inst.app_slug,
          appId: inst.app_id,
          repositorySelection: inst.repository_selection,
          targetType: inst.target_type,
        };
      }
      
      // Handle both user and organization accounts
      // Safe assertion - we already checked inst.account is not null
      const account = inst.account as any;
      
      return {
        id: inst.id,
        account: {
          login: account.login,
          type: 'type' in account ? account.type : undefined, 
          avatarUrl: account.avatar_url,
        },
        appSlug: inst.app_slug,
        appId: inst.app_id,
        repositorySelection: inst.repository_selection,
        targetType: inst.target_type,
      };
    });

    logger.info(MODULE_NAME, "Found GitHub App installations", {
      count: installations.length,
      accounts: installations
        .filter(i => i.account !== null && 'login' in i.account)
        .map((i) => i.account?.login)
        .join(", "),
    });

    return installations;
  } catch (error) {
    logger.error(MODULE_NAME, "Error getting GitHub App installations", {
      error,
    });
    return [];
  }
}

// Check if the GitHub App is installed for the authenticated user
export async function checkAppInstallation(
  accessToken: string,
): Promise<number | null> {
  logger.debug(MODULE_NAME, "checkAppInstallation called", {
    accessTokenLength: accessToken?.length,
  });

  try {
    // Get all installations
    const installations = await getAllAppInstallations(accessToken);

    if (installations.length > 0) {
      // For now, return the first installation ID
      // The UI will provide a way to switch between installations
      const installationId = installations[0].id;

      logger.info(MODULE_NAME, "Using first GitHub App installation", {
        installationId,
        account: installations[0].account?.login || 'unknown',
      });

      return installationId;
    }

    logger.info(MODULE_NAME, "No GitHub App installation found for this user");
    return null;
  } catch (error) {
    logger.error(MODULE_NAME, "Error checking for GitHub App installation", {
      error,
    });
    return null;
  }
}

// Get an Octokit instance with installation access token
export async function getInstallationOctokit(
  installationId: number,
): Promise<Octokit> {
  logger.debug(MODULE_NAME, "getInstallationOctokit called", {
    installationId,
  });

  try {
    // Verify required environment variables
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY_PKCS8;

    if (!appId || !privateKey) {
      logger.error(MODULE_NAME, "Missing GitHub App credentials", {
        hasAppId: !!appId,
        hasPrivateKey: !!privateKey,
      });
      throw new Error("GitHub App credentials not configured");
    }

    // Create an Octokit instance authenticated as the GitHub App installation
    const auth = createAppAuth({
      appId: appId,
      privateKey: privateKey.replace(/\\n/g, "\n"), // Handle newlines in the key
      installationId,
    });

    // Get an installation access token
    const installationAuth = await auth({ type: "installation" });
    logger.debug(MODULE_NAME, "Generated installation access token", {
      tokenType: installationAuth.type,
      expiresAt: installationAuth.expiresAt,
    });

    // Create an Octokit instance with the installation token
    return new Octokit({ auth: installationAuth.token });
  } catch (error) {
    logger.error(MODULE_NAME, "Error creating installation Octokit", { error });
    throw error;
  }
}

// Fetch repositories using user OAuth token
export async function fetchAllRepositoriesOAuth(
  accessToken: string,
): Promise<Repository[]> {
  logger.debug(MODULE_NAME, "fetchAllRepositoriesOAuth called", {
    accessTokenLength: accessToken?.length,
  });
  const octokit = new Octokit({ auth: accessToken });
  let allRepos: Repository[] = [];

  try {
    // check github api rate limits
    try {
      const rateLimit = await octokit.rest.rateLimit.get();
      const core = rateLimit.data.resources.core;
      logger.info(MODULE_NAME, "GitHub API rate limit status", {
        limit: core.limit,
        remaining: core.remaining,
        reset: new Date(core.reset * 1000).toISOString(),
        usedPercent:
          100 - Number(((core.remaining / core.limit) * 100).toFixed(1)),
      });

      if (core.remaining < 100) {
        logger.warn(MODULE_NAME, "GitHub API rate limit is running low", {
          remaining: core.remaining,
          resetTime: new Date(core.reset * 1000).toISOString(),
        });
      }
    } catch (rateLimitError) {
      logger.warn(MODULE_NAME, "Failed to check GitHub API rate limits", {
        error: rateLimitError,
      });
    }

    // retrieve authenticated user info (and check token scopes)
    try {
      const userInfo = await octokit.rest.users.getAuthenticated();
      const scopesHeader = userInfo.headers["x-oauth-scopes"] || "";
      const scopes = scopesHeader ? scopesHeader.split(", ") : [];

      logger.info(MODULE_NAME, "Authenticated user details", {
        login: userInfo.data.login,
        id: userInfo.data.id,
        type: userInfo.data.type,
        // this property isn't in official octokit types:
        twoFactorEnabled: (userInfo.data as any).two_factor_authentication,
        tokenScopes: scopes,
        hasRepoScope: scopes.includes("repo"),
        hasReadOrgScope: scopes.includes("read:org"),
        // etc...
      });

      // strongly recommend ensuring 'repo' and 'read:org' if you want all repos
      if (!scopes.includes("repo")) {
        logger.warn(
          MODULE_NAME,
          "GitHub token is missing 'repo' scope. This will prevent access to private repositories.",
        );
        throw new Error(
          "GitHub token is missing 'repo' scope. Please re-authenticate with the necessary permissions.",
        );
      }

      if (!scopes.includes("read:org")) {
        logger.warn(
          MODULE_NAME,
          "GitHub token is missing 'read:org' scope. This may limit access to organization data.",
        );
        // optionally make this an error if you absolutely need org repos
        // throw new Error("GitHub token is missing 'read:org' scope. Please re-authenticate with the necessary permissions.");
      }
    } catch (userInfoError) {
      logger.warn(MODULE_NAME, "Could not retrieve authenticated user info", {
        error: userInfoError,
      });
    }

    // the simplest approach to get as many repos as possible:
    logger.debug(
      MODULE_NAME,
      "Fetching all repos with combined affiliation=owner,collaborator,organization_member and visibility=all",
    );
    const combinedRepos = await octokit.paginate(
      octokit.rest.repos.listForAuthenticatedUser,
      {
        per_page: 100,
        sort: "updated",
        visibility: "all",
        affiliation: "owner,collaborator,organization_member",
      },
    );
    logger.info(MODULE_NAME, "Fetched combined affiliation repos", {
      count: combinedRepos.length,
    });
    allRepos = combinedRepos;

    // you can optionally also iterate over orgs you belong to and list them directly,
    // in case you want to see if the direct org approach yields anything new:
    try {
      const orgs = await octokit.paginate(
        octokit.rest.orgs.listForAuthenticatedUser,
        {
          per_page: 100,
        },
      );
      logger.info(MODULE_NAME, "Fetched user organizations", {
        count: orgs.length,
        orgs: orgs.map((o) => o.login),
      });

      for (const org of orgs) {
        try {
          const orgRepos = await octokit.paginate(
            octokit.rest.repos.listForOrg,
            {
              org: org.login,
              per_page: 100,
              sort: "updated",
              type: "all", // private + public + forks, etc. as long as your token can see them
            },
          );
          logger.info(MODULE_NAME, `Fetched repos for org: ${org.login}`, {
            count: orgRepos.length,
          });
          // Make sure we're creating a proper array of repositories
          // @ts-ignore - Octokit types for returned repository data vary
          if (Array.isArray(orgRepos)) {
            allRepos = [...allRepos, ...orgRepos];
          } else if (orgRepos) {
            // If it's a single repo, add it to the array
            // @ts-ignore - Octokit type complexities
            allRepos.push(orgRepos);
          }
        } catch (orgError) {
          logger.warn(
            MODULE_NAME,
            `Error fetching repos for org: ${org.login}`,
            { error: orgError },
          );
        }
      }
    } catch (orgListError) {
      logger.warn(MODULE_NAME, "Failed to list user orgs", {
        error: orgListError,
      });
    }

    // deduplicate by full_name
    logger.debug(MODULE_NAME, "Deduplicating repositories", {
      beforeCount: allRepos.length,
    });
    const uniqueRepos = Array.from(
      new Map(allRepos.map((r) => [r.full_name, r])).values(),
    );
    logger.info(MODULE_NAME, "Deduplicated repositories", {
      afterCount: uniqueRepos.length,
      duplicatesRemoved: allRepos.length - uniqueRepos.length,
    });

    return uniqueRepos;
  } catch (error) {
    logger.error(MODULE_NAME, "Error fetching repositories", { error });
    throw error;
  }
}

// Fetch repositories using GitHub App installation
export async function fetchAllRepositoriesApp(
  installationId: number,
): Promise<Repository[]> {
  logger.debug(MODULE_NAME, "fetchAllRepositoriesApp called", {
    installationId,
  });

  try {
    // Get an Octokit instance with the installation access token
    const octokit = await getInstallationOctokit(installationId);

    // Check rate limits
    try {
      const rateLimit = await octokit.rest.rateLimit.get();
      const core = rateLimit.data.resources.core;
      logger.info(MODULE_NAME, "GitHub API rate limit status (App auth)", {
        limit: core.limit,
        remaining: core.remaining,
        reset: new Date(core.reset * 1000).toISOString(),
        usedPercent:
          100 - Number(((core.remaining / core.limit) * 100).toFixed(1)),
      });
    } catch (rateLimitError) {
      logger.warn(
        MODULE_NAME,
        "Failed to check GitHub API rate limits (App auth)",
        {
          error: rateLimitError,
        },
      );
    }

    // List all repositories accessible to the installation
    logger.debug(
      MODULE_NAME,
      "Fetching repositories accessible to the installation",
    );

    // Use paginate to fetch all pages, not just the first 100 repos
    const repositories = await octokit.paginate(
      octokit.rest.apps.listReposAccessibleToInstallation,
      {
        per_page: 100,
      },
    );

    logger.info(
      MODULE_NAME,
      "Fetched repositories from GitHub App installation",
      {
        count: repositories.length,
        private: repositories.filter((repo) => repo.private).length,
        public: repositories.filter((repo) => !repo.private).length,
      },
    );

    return repositories;
  } catch (error) {
    logger.error(MODULE_NAME, "Error fetching repositories via GitHub App", {
      error,
    });
    throw error;
  }
}

// Unified function to fetch repositories via OAuth or GitHub App
export async function fetchAllRepositories(
  accessToken?: string,
  installationId?: number,
): Promise<Repository[]> {
  logger.debug(MODULE_NAME, "fetchAllRepositories called", {
    hasAccessToken: !!accessToken,
    hasInstallationId: !!installationId,
  });

  try {
    // Prefer GitHub App installation if available
    if (installationId) {
      logger.info(
        MODULE_NAME,
        "Using GitHub App installation for repository access",
        {
          installationId,
        },
      );
      return await fetchAllRepositoriesApp(installationId);
    } else if (accessToken) {
      logger.info(MODULE_NAME, "Using OAuth token for repository access");
      return await fetchAllRepositoriesOAuth(accessToken);
    } else {
      // Neither authentication method is available
      logger.error(
        MODULE_NAME,
        "No authentication method available for repository access",
      );
      throw new Error(
        "No GitHub authentication available. Please sign in again.",
      );
    }
  } catch (error) {
    logger.error(MODULE_NAME, "Error in unified fetchAllRepositories", {
      error,
    });
    throw error;
  }
}

// Fetch repository commits using OAuth token
export async function fetchRepositoryCommitsOAuth(
  accessToken: string,
  owner: string,
  repo: string,
  since: string,
  until: string,
  author?: string,
): Promise<Commit[]> {
  // This function returns GitHub commits cast to our interface
  logger.debug(
    MODULE_NAME,
    `fetchRepositoryCommitsOAuth called for ${owner}/${repo}`,
    {
      since,
      until,
      author: author || "not specified",
    },
  );

  const octokit = new Octokit({ auth: accessToken });

  try {
    logger.debug(
      MODULE_NAME,
      `Starting pagination for ${owner}/${repo} commits`,
    );
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
      lastCommitSha:
        commits.length > 0 ? commits[commits.length - 1].sha : null,
    });

    // attach repository info
    const commitsWithRepoInfo = commits.map((commit) => ({
      ...commit,
      repository: {
        full_name: `${owner}/${repo}`,
      },
    }));

    // Cast to ensure compatibility with our interface
    return commitsWithRepoInfo as any as Commit[];
  } catch (error) {
    logger.error(MODULE_NAME, `Error fetching commits for ${owner}/${repo}`, {
      error,
    });
    // return empty array if there's an access or other error
    return [];
  }
}

// Fetch repository commits using GitHub App installation
export async function fetchRepositoryCommitsApp(
  installationId: number,
  owner: string,
  repo: string,
  since: string,
  until: string,
  author?: string,
): Promise<Commit[]> {
  logger.debug(
    MODULE_NAME,
    `fetchRepositoryCommitsApp called for ${owner}/${repo}`,
    {
      installationId,
      since,
      until,
      author: author || "not specified",
    },
  );

  try {
    const octokit = await getInstallationOctokit(installationId);

    logger.debug(
      MODULE_NAME,
      `Starting pagination for ${owner}/${repo} commits via GitHub App`,
    );

    const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
      owner,
      repo,
      since,
      until,
      author,
      per_page: 100,
    });

    logger.info(
      MODULE_NAME,
      `Fetched commits for ${owner}/${repo} via GitHub App`,
      {
        count: commits.length,
        firstCommitSha: commits.length > 0 ? commits[0].sha : null,
        lastCommitSha:
          commits.length > 0 ? commits[commits.length - 1].sha : null,
      },
    );

    // attach repository info
    const commitsWithRepoInfo = commits.map((commit) => ({
      ...commit,
      repository: {
        full_name: `${owner}/${repo}`,
      },
    }));

    // Cast to ensure compatibility with our interface
    return commitsWithRepoInfo as any as Commit[];
  } catch (error) {
    logger.error(
      MODULE_NAME,
      `Error fetching commits for ${owner}/${repo} via GitHub App`,
      {
        error,
      },
    );
    // return empty array if there's an access or other error
    return [];
  }
}

// Unified function to fetch repository commits
export async function fetchRepositoryCommits(
  accessToken?: string,
  installationId?: number,
  owner: string = "",
  repo: string = "",
  since: string = "",
  until: string = "",
  author?: string,
): Promise<Commit[]> {
  logger.debug(
    MODULE_NAME,
    `fetchRepositoryCommits called for ${owner}/${repo}`,
    {
      hasAccessToken: !!accessToken,
      hasInstallationId: !!installationId,
      since,
      until,
      author: author || "not specified",
    },
  );

  try {
    // Prefer GitHub App installation if available
    if (installationId) {
      logger.info(
        MODULE_NAME,
        "Using GitHub App installation for commit access",
        {
          installationId,
        },
      );
      return await fetchRepositoryCommitsApp(
        installationId,
        owner,
        repo,
        since,
        until,
        author,
      );
    } else if (accessToken) {
      logger.info(MODULE_NAME, "Using OAuth token for commit access");
      return await fetchRepositoryCommitsOAuth(
        accessToken,
        owner,
        repo,
        since,
        until,
        author,
      );
    } else {
      // Neither authentication method is available
      logger.error(
        MODULE_NAME,
        "No authentication method available for commit access",
      );
      throw new Error(
        "No GitHub authentication available. Please sign in again.",
      );
    }
  } catch (error) {
    logger.error(
      MODULE_NAME,
      `Error in unified fetchRepositoryCommits for ${owner}/${repo}`,
      { error },
    );
    return [];
  }
}

export async function fetchCommitsForRepositories(
  accessToken?: string,
  installationId?: number,
  repositories: string[] = [],
  since: string = "",
  until: string = "",
  author?: string,
): Promise<Commit[]> {
  // The return value will be properly cast to our Commit interface
  logger.debug(MODULE_NAME, "fetchCommitsForRepositories called", {
    repositoriesCount: repositories.length,
    hasAccessToken: !!accessToken,
    hasInstallationId: !!installationId,
    since,
    until,
    author: author || "not specified",
  });

  if (!accessToken && !installationId) {
    logger.error(
      MODULE_NAME,
      "No authentication method provided for fetching commits",
    );
    throw new Error(
      "No GitHub authentication available. Please sign in again.",
    );
  }

  const allCommits: Commit[] = [];
  let githubUsername = author;
  const batchSize = 5;

  // first pass with "author" if provided
  for (let i = 0; i < repositories.length; i += batchSize) {
    const batch = repositories.slice(i, i + batchSize);
    logger.debug(
      MODULE_NAME,
      `processing batch ${Math.floor(i / batchSize) + 1}`,
      { batchRepos: batch },
    );

    const results = await Promise.all(
      batch.map((repoFullName) => {
        const [owner, repo] = repoFullName.split("/");
        return fetchRepositoryCommits(
          accessToken,
          installationId,
          owner,
          repo,
          since,
          until,
          githubUsername,
        );
      }),
    );
    results.forEach((commits) => allCommits.push(...commits));
  }

  // if we found no commits with that author, try with owner name or no author
  if (allCommits.length === 0 && author) {
    logger.info(
      MODULE_NAME,
      "No commits found with provided author name; retrying with the repo owner as author",
    );

    if (repositories.length > 0) {
      const [fallbackOwner] = repositories[0].split("/");
      githubUsername = fallbackOwner;
      for (let i = 0; i < repositories.length; i += batchSize) {
        const batch = repositories.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map((repoFullName) => {
            const [owner, repo] = repoFullName.split("/");
            return fetchRepositoryCommits(
              accessToken,
              installationId,
              owner,
              repo,
              since,
              until,
              githubUsername,
            );
          }),
        );
        results.forEach((commits) => allCommits.push(...commits));
      }
    }
  }

  if (allCommits.length === 0 && author) {
    logger.info(
      MODULE_NAME,
      "Still no commits found, retrying without author filter",
    );
    for (let i = 0; i < repositories.length; i += batchSize) {
      const batch = repositories.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((repoFullName) => {
          const [owner, repo] = repoFullName.split("/");
          return fetchRepositoryCommits(
            accessToken,
            installationId,
            owner,
            repo,
            since,
            until,
            undefined,
          );
        }),
      );
      results.forEach((commits) => allCommits.push(...commits));
    }
  }

  logger.info(MODULE_NAME, "All repository commits fetched", {
    totalRepositories: repositories.length,
    totalCommits: allCommits.length,
    finalAuthorFilter: githubUsername || "none",
    authMethod: installationId ? "GitHub App" : "OAuth",
  });

  // Cast to Commit[] to ensure proper type
  return allCommits as unknown as Commit[];
}
