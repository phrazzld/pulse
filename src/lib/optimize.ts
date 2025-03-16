/**
 * Utilities for optimizing API response payloads
 */
import { Repository, Commit } from './github';

/**
 * Optimized minimal repository data
 */
export interface MinimalRepository {
  id: number;
  name: string;
  full_name: string;
  owner_login: string;
  private: boolean;
  language: string | null;
  html_url?: string;
}

/**
 * Optimized minimal commit data
 */
export interface MinimalCommit {
  sha: string;
  message: string;
  author_name: string;
  author_date: string;
  author_login?: string;
  author_avatar?: string;
  repo_name?: string;
  html_url?: string;
}

/**
 * Optimized minimal contributor data
 */
export interface MinimalContributor {
  username: string;
  display_name: string;
  avatar_url: string | null;
  commit_count?: number;
}

/**
 * Optimize repository data by removing unnecessary fields
 * 
 * @param repo - Full repository object from GitHub
 * @returns - Minimized repository data
 */
export function optimizeRepository(repo: Repository): MinimalRepository {
  return {
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    owner_login: repo.owner.login,
    private: repo.private,
    language: repo.language || null,
    html_url: repo.html_url, // Keep URL for clickable references
  };
}

/**
 * Optimize commit data by removing unnecessary fields
 * 
 * @param commit - Full commit object from GitHub
 * @returns - Minimized commit data
 */
export function optimizeCommit(commit: Commit): MinimalCommit {
  return {
    sha: commit.sha,
    message: commit.commit.message,
    author_name: commit.commit.author?.name || 'Unknown',
    author_date: commit.commit.author?.date || new Date().toISOString(),
    author_login: commit.author?.login,
    author_avatar: commit.author?.avatar_url,
    repo_name: commit.repository?.full_name,
    html_url: commit.html_url,
  };
}

/**
 * Optimize contributor data
 * 
 * @param contributor - Contributor object with potential extra fields
 * @returns - Minimized contributor data
 */
export function optimizeContributor(contributor: any): MinimalContributor {
  return {
    username: contributor.username || contributor.login,
    display_name: contributor.displayName || contributor.name || contributor.username || contributor.login,
    avatar_url: contributor.avatarUrl || contributor.avatar_url || null,
    commit_count: contributor.commitCount || contributor.commit_count
  };
}

/**
 * Optimize an array of items using a provided optimization function
 * 
 * @param items - Array of items to optimize
 * @param optimizerFn - Function to apply to each item
 * @returns - Array of optimized items
 */
export function optimizeArray<T, R>(items: T[], optimizerFn: (item: T) => R): R[] {
  if (!Array.isArray(items)) return [];
  return items.map(optimizerFn);
}

/**
 * Remove null or undefined values from an object
 * 
 * @param obj - Object to clean
 * @returns - Object without null or undefined values
 */
export function removeNullValues<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.entries(obj).reduce((acc: any, [key, value]) => {
    if (value !== null && value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

/**
 * Custom JSON serializer for optimized string representation
 * 
 * @param data - Data to serialize
 * @returns - Serialized JSON string
 */
export function optimizedJSONStringify(data: any): string {
  // Handle arrays separately for better optimization opportunities
  if (Array.isArray(data)) {
    return `[${data.map(item => 
      typeof item === 'object' && item !== null 
        ? optimizedJSONStringify(item)
        : JSON.stringify(item)
    ).join(',')}]`;
  }
  
  // Regular JSON stringify for other data
  return JSON.stringify(data);
}