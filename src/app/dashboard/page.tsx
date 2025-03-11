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
  team?: string[];
  commits: any[];
  stats: {
    totalCommits: number;
    repositories: string[];
    dates: string[];
  };
  aiSummary?: AISummary;
  members?: {
    user: string;
    commits: any[];
    stats: {
      totalCommits: number;
      repositories: string[];
      dates: string[];
    };
  }[];
  teamStats?: {
    totalCommits: number;
    repositories: string[];
    dates: string[];
    memberCount: number;
  };
};

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(false);
  const [summaryType, setSummaryType] = useState<'individual' | 'team'>('individual');
  const [teamMembers, setTeamMembers] = useState<string>('');
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
        type: summaryType,
      });

      if (summaryType === 'team' && teamMembers) {
        params.append('teamMembers', teamMembers);
      }

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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Summary Type
                  </label>
                  <div className="flex space-x-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        value="individual"
                        checked={summaryType === 'individual'}
                        onChange={() => setSummaryType('individual')}
                        className="form-radio h-4 w-4 text-blue-600"
                      />
                      <span className="ml-2 text-gray-700 dark:text-gray-300">Individual</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        value="team"
                        checked={summaryType === 'team'}
                        onChange={() => setSummaryType('team')}
                        className="form-radio h-4 w-4 text-blue-600"
                      />
                      <span className="ml-2 text-gray-700 dark:text-gray-300">Team</span>
                    </label>
                  </div>
                </div>

                {summaryType === 'team' && (
                  <div>
                    <label
                      htmlFor="teamMembers"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Team Members (comma-separated GitHub usernames)
                    </label>
                    <input
                      type="text"
                      id="teamMembers"
                      value={teamMembers}
                      onChange={(e) => setTeamMembers(e.target.value)}
                      placeholder="user1,user2,user3"
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required={summaryType === 'team'}
                    />
                  </div>
                )}

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
                    Repositories
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
                <div className="max-h-60 overflow-y-auto p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700">
                  {repositories.length === 0 ? (
                    <div className="text-gray-500 dark:text-gray-400 text-sm">
                      {loading ? 'Loading repositories...' : 'No repositories found'}
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {repositories.map((repo) => (
                        <li key={repo.id} className="flex items-start">
                          <input
                            type="checkbox"
                            id={`repo-${repo.id}`}
                            checked={selectedRepos.includes(repo.full_name)}
                            onChange={() => handleRepoToggle(repo.full_name)}
                            className="h-4 w-4 mt-1 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label
                            htmlFor={`repo-${repo.id}`}
                            className="ml-2 block text-sm text-gray-900 dark:text-white"
                          >
                            {repo.full_name}
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Leave empty to include all accessible repositories
                </p>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed"
                >
                  {loading ? 'Generating...' : 'Generate Summary'}
                </button>
              </div>
            </form>

            {summary && (
              <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                  {summaryType === 'individual'
                    ? `Summary for ${summary.user}`
                    : 'Team Summary'}
                </h3>

                {/* Basic stats display */}
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-8">
                  {summaryType === 'individual' ? (
                    <div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Total Commits
                          </h4>
                          <p className="text-3xl font-bold text-gray-900 dark:text-white">
                            {summary.stats.totalCommits}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Repositories
                          </h4>
                          <p className="text-3xl font-bold text-gray-900 dark:text-white">
                            {summary.stats.repositories.length}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Active Days
                          </h4>
                          <p className="text-3xl font-bold text-gray-900 dark:text-white">
                            {summary.stats.dates.length}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Team summary stats */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Team Members
                          </h4>
                          <p className="text-3xl font-bold text-gray-900 dark:text-white">
                            {summary.teamStats?.memberCount}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Total Commits
                          </h4>
                          <p className="text-3xl font-bold text-gray-900 dark:text-white">
                            {summary.teamStats?.totalCommits}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Repositories
                          </h4>
                          <p className="text-3xl font-bold text-gray-900 dark:text-white">
                            {summary.teamStats?.repositories.length}
                          </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Active Days
                          </h4>
                          <p className="text-3xl font-bold text-gray-900 dark:text-white">
                            {summary.teamStats?.dates.length}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* AI Summary Section */}
                {summary.aiSummary && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                      AI-Generated Summary
                    </h3>
                    
                    {/* Overall Summary */}
                    <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                      <h4 className="text-md font-semibold text-blue-800 dark:text-blue-300 mb-2">
                        Overview
                      </h4>
                      <p className="text-gray-800 dark:text-gray-200">
                        {summary.aiSummary.overallSummary}
                      </p>
                    </div>
                    
                    {/* Key Themes */}
                    <div className="mb-6">
                      <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-2">
                        Key Themes
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {summary.aiSummary.keyThemes.map((theme, index) => (
                          <span 
                            key={index}
                            className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 rounded-full text-sm"
                          >
                            {theme}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    {/* Technical Areas */}
                    <div className="mb-6">
                      <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-2">
                        Technical Areas
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {summary.aiSummary.technicalAreas.map((area, index) => (
                          <div 
                            key={index}
                            className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded"
                          >
                            <span className="text-gray-800 dark:text-gray-200">{area.name}</span>
                            <span className="bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded text-sm">
                              {area.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Accomplishments */}
                    <div className="mb-6">
                      <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-2">
                        Key Accomplishments
                      </h4>
                      <ul className="list-disc list-inside space-y-2 text-gray-800 dark:text-gray-200">
                        {summary.aiSummary.accomplishments.map((accomplishment, index) => (
                          <li key={index}>{accomplishment}</li>
                        ))}
                      </ul>
                    </div>
                    
                    {/* Commits by Type */}
                    <div className="mb-6">
                      <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-2">
                        Commits by Type
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
                          <thead className="bg-gray-100 dark:bg-gray-700">
                            <tr>
                              <th className="py-2 px-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Type</th>
                              <th className="py-2 px-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Count</th>
                              <th className="py-2 px-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Description</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {summary.aiSummary.commitsByType.map((item, index) => (
                              <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                                <td className="py-2 px-4 text-sm text-gray-800 dark:text-gray-200">{item.type}</td>
                                <td className="py-2 px-4 text-sm text-gray-800 dark:text-gray-200">{item.count}</td>
                                <td className="py-2 px-4 text-sm text-gray-800 dark:text-gray-200">{item.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    
                    {/* Timeline Highlights */}
                    <div>
                      <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-2">
                        Timeline Highlights
                      </h4>
                      <div className="relative pl-8 space-y-6 before:absolute before:left-4 before:top-0 before:h-full before:w-0.5 before:bg-blue-200 dark:before:bg-blue-800">
                        {summary.aiSummary.timelineHighlights.map((highlight, index) => (
                          <div key={index} className="relative">
                            <div className="absolute left-[-30px] top-0 flex items-center justify-center w-6 h-6 bg-blue-500 rounded-full">
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            </div>
                            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                              <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                                {new Date(highlight.date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </p>
                              <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">
                                {highlight.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Team Member Breakdown (for team summaries) */}
                {summaryType === 'team' && summary.members && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
                    <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
                      Team Member Breakdown
                    </h4>
                    <div className="space-y-4">
                      {summary.members.map((member) => (
                        <div
                          key={member.user}
                          className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg"
                        >
                          <h5 className="font-medium text-gray-900 dark:text-white mb-2">
                            {member.user}
                          </h5>
                          <div className="grid grid-cols-3 gap-4 mb-3">
                            <div>
                              <span className="text-sm text-gray-500 dark:text-gray-400 block">
                                Commits
                              </span>
                              <span className="text-xl font-semibold text-gray-900 dark:text-white">
                                {member.stats.totalCommits}
                              </span>
                            </div>
                            <div>
                              <span className="text-sm text-gray-500 dark:text-gray-400 block">
                                Repositories
                              </span>
                              <span className="text-xl font-semibold text-gray-900 dark:text-white">
                                {member.stats.repositories.length}
                              </span>
                            </div>
                            <div>
                              <span className="text-sm text-gray-500 dark:text-gray-400 block">
                                Days Active
                              </span>
                              <span className="text-xl font-semibold text-gray-900 dark:text-white">
                                {member.stats.dates.length}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Commits List */}
                {summary.commits && summary.commits.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
                      Recent Commits
                    </h4>
                    <ul className="space-y-2 max-h-80 overflow-y-auto">
                      {summary.commits.slice(0, 10).map((commit) => (
                        <li
                          key={commit.sha}
                          className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md"
                        >
                          <a
                            href={commit.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline block mb-1"
                          >
                            {commit.commit.message.split('\n')[0]}
                          </a>
                          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>
                              {new Date(commit.commit.author.date).toLocaleDateString()}
                            </span>
                            <span>{commit.repository?.full_name || commit.html_url.split('/').slice(3, 5).join('/')}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}