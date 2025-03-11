'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type Repository = {
  id: number;
  full_name: string;
  name: string;
  owner: {
    login: string;
  };
};

interface AISummary {
  keyThemes: string[];
  technicalAreas: {
    name: string;
    count: number;
  }[];
  accomplishments: string[];
  commitsByType: {
    type: string;
    count: number;
    description: string;
  }[];
  timelineHighlights: {
    date: string;
    description: string;
  }[];
  overallSummary: string;
}

type CommitSummary = {
  user?: string;
  commits: any[];
  stats: {
    totalCommits: number;
    repositories: string[];
    dates: string[];
  };
  aiSummary?: AISummary;
};

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({
    since: getLastWeekDate(),
    until: getTodayDate(),
  });
  const [summary, setSummary] = useState<CommitSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Fetch repositories when session is available
  useEffect(() => {
    if (session?.accessToken) {
      fetchRepositories();
    }
  }, [session]);

  // Helper functions for date formatting
  function getTodayDate() {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  function getLastWeekDate() {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    return lastWeek.toISOString().split('T')[0];
  }

  async function fetchRepositories() {
    try {
      setLoading(true);
      const response = await fetch('/api/repos');
      if (!response.ok) {
        throw new Error('Failed to fetch repositories');
      }
      const data = await response.json();
      setRepositories(data);
    } catch (error) {
      console.error('Error fetching repositories:', error);
      setError('Failed to fetch repositories. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function generateSummary(e: React.FormEvent) {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setSummary(null);

      // Construct query parameters
      const params = new URLSearchParams({
        since: dateRange.since,
        until: dateRange.until,
      });

      if (selectedRepos.length > 0) {
        params.append('repos', selectedRepos.join(','));
      }

      const response = await fetch(`/api/summary?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate summary');
      }

      const data = await response.json();
      setSummary(data);
    } catch (error: any) {
      console.error('Error generating summary:', error);
      setError(error.message || 'Failed to generate summary. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleRepoToggle(repoName: string) {
    setSelectedRepos((prevSelected) =>
      prevSelected.includes(repoName)
        ? prevSelected.filter((name) => name !== repoName)
        : [...prevSelected, repoName]
    );
  }

  function handleSelectAllRepos() {
    if (selectedRepos.length === repositories.length) {
      setSelectedRepos([]);
    } else {
      setSelectedRepos(repositories.map((repo) => repo.full_name));
    }
  }

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pulse Dashboard</h1>
          {session?.user?.image && (
            <div className="flex items-center">
              <span className="mr-2 text-sm text-gray-600 dark:text-gray-300">
                {session.user.name}
              </span>
              <Image
                src={session.user.image}
                alt={session.user.name || 'User'}
                width={32}
                height={32}
                className="rounded-full"
              />
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Generate Commit Summary
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            <form onSubmit={generateSummary} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="since"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Since Date
                  </label>
                  <input
                    type="date"
                    id="since"
                    value={dateRange.since}
                    onChange={(e) =>
                      setDateRange((prev) => ({ ...prev, since: e.target.value }))
                    }
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="until"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Until Date
                  </label>
                  <input
                    type="date"
                    id="until"
                    value={dateRange.until}
                    onChange={(e) =>
                      setDateRange((prev) => ({ ...prev, until: e.target.value }))
                    }
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Select Repositories
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllRepos}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {selectedRepos.length === repositories.length
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                </div>
                <div className="overflow-y-auto max-h-60 border border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-700">
                  {repositories.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 p-2">
                      {loading ? 'Loading repositories...' : 'No repositories found.'}
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {repositories.map((repo) => (
                        <li key={repo.id} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`repo-${repo.id}`}
                            checked={selectedRepos.includes(repo.full_name)}
                            onChange={() => handleRepoToggle(repo.full_name)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label
                            htmlFor={`repo-${repo.id}`}
                            className="ml-2 block text-sm text-gray-900 dark:text-white cursor-pointer"
                          >
                            {repo.full_name}
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                    loading && 'opacity-75 cursor-not-allowed'
                  }`}
                >
                  {loading ? 'Generating...' : 'Generate Summary'}
                </button>
              </div>
            </form>
          </div>

          {summary && (
            <div className="mt-8 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800">
              <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
                Commit Summary for {summary.user}
              </h2>

              <div className="mb-6">
                <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">
                  Basic Statistics
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
                    <p className="text-sm text-blue-600 dark:text-blue-300">Total Commits</p>
                    <p className="text-2xl font-bold text-blue-800 dark:text-blue-100">
                      {summary.stats.totalCommits}
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 dark:bg-purple-900 rounded-lg">
                    <p className="text-sm text-purple-600 dark:text-purple-300">Repositories</p>
                    <p className="text-2xl font-bold text-purple-800 dark:text-purple-100">
                      {summary.stats.repositories.length}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900 rounded-lg">
                    <p className="text-sm text-green-600 dark:text-green-300">Active Days</p>
                    <p className="text-2xl font-bold text-green-800 dark:text-green-100">
                      {summary.stats.dates.length}
                    </p>
                  </div>
                </div>
              </div>

              {summary.aiSummary && (
                <>
                  <div className="mb-6">
                    <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">
                      Key Themes
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {summary.aiSummary.keyThemes.map((theme, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 rounded-full text-sm"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">
                      Technical Areas
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {summary.aiSummary.technicalAreas.map((area, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        >
                          <span className="text-gray-800 dark:text-gray-200">{area.name}</span>
                          <span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded text-xs">
                            {area.count} commits
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">
                      Accomplishments
                    </h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
                      {summary.aiSummary.accomplishments.map((accomplishment, index) => (
                        <li key={index}>{accomplishment}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">
                      Commit Types
                    </h3>
                    <div className="space-y-4">
                      {summary.aiSummary.commitsByType.map((type, index) => (
                        <div key={index} className="border-l-4 border-indigo-500 pl-4 py-1">
                          <div className="flex justify-between">
                            <h4 className="font-medium text-gray-800 dark:text-gray-200">
                              {type.type}
                            </h4>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {type.count} commits
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {type.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">
                      Timeline Highlights
                    </h3>
                    <div className="space-y-4">
                      {summary.aiSummary.timelineHighlights.map((highlight, index) => (
                        <div key={index} className="flex">
                          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center text-indigo-800 dark:text-indigo-100">
                            {index + 1}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              {new Date(highlight.date).toLocaleDateString()}
                            </div>
                            <div className="mt-1 text-gray-900 dark:text-white">
                              {highlight.description}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">
                      Overall Summary
                    </h3>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-800 dark:text-gray-200">
                      {summary.aiSummary.overallSummary}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}