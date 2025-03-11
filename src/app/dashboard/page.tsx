'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
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
  
  // Handle repository fetch errors - set descriptive error message
  const handleAuthError = () => {
    console.log('GitHub access token appears to be invalid or expired.');
    setError('GitHub authentication failed. Your access token is invalid or expired. Please sign out and sign in again.');
  };

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
        // Parse the error response
        const errorData = await response.json();
        
        if (response.status === 401 || 
            response.status === 403 ||
            (errorData.code === 'GITHUB_AUTH_ERROR') ||
            (errorData.error && errorData.error.includes('authentication'))) {
          // Auth error - token expired or invalid
          handleAuthError();
          return;
        }
        
        throw new Error(errorData.error || 'Failed to fetch repositories');
      }
      
      const data = await response.json();
      setRepositories(data);
      setError(null); // Clear any previous errors
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
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: 'var(--gradient-bg)' }}>
        <div className="flex flex-col items-center max-w-md w-full p-8 rounded-lg border" style={{ 
          backgroundColor: 'rgba(27, 43, 52, 0.7)',
          backdropFilter: 'blur(5px)',
          borderColor: 'var(--neon-green)',
          boxShadow: '0 0 20px rgba(0, 255, 135, 0.2)'
        }}>
          <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mb-6" style={{ 
            borderColor: 'var(--neon-green)', 
            borderTopColor: 'transparent' 
          }}></div>
          
          <div className="space-y-3 w-full">
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--neon-green)' }}>SYSTEM STARTUP</span>
              <span className="text-xs px-2 py-1 rounded-sm" style={{ 
                backgroundColor: 'rgba(59, 142, 234, 0.2)',
                color: 'var(--electric-blue)'
              }}>
                INITIALIZING
              </span>
            </div>
            
            <div className="w-full bg-black bg-opacity-30 h-2 rounded-full overflow-hidden">
              <div className="h-full animate-pulse" style={{ backgroundColor: 'var(--neon-green)', width: '60%' }}></div>
            </div>
            
            <div className="text-xs" style={{ color: 'var(--foreground)' }}>
              <div className="mb-1">> Loading session data...</div>
              <div className="mb-1">> Establishing secure connection...</div>
              <div className="mb-1">> Authenticating GitHub credentials...</div>
              <div className="animate-pulse" style={{ color: 'var(--electric-blue)' }}>
                > Preparing dashboard interface...
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--gradient-bg)' }}>
      <header className="border-b shadow-lg" style={{ 
        borderColor: 'var(--neon-green)',
        backgroundColor: 'rgba(27, 43, 52, 0.9)',
        boxShadow: '0 4px 6px -1px rgba(0, 255, 135, 0.1), 0 2px 4px -1px rgba(0, 255, 135, 0.06)'
      }}>
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full mr-3 animate-pulse" style={{ backgroundColor: 'var(--neon-green)' }}></div>
            <h1 className="text-2xl font-bold" style={{ 
              color: 'var(--neon-green)',
              textShadow: '0 0 5px rgba(0, 255, 135, 0.3)'
            }}>PULSE</h1>
            <div className="ml-4 px-2 py-1 text-xs rounded flex items-center" style={{ 
              backgroundColor: 'rgba(0, 0, 0, 0.3)', 
              border: '1px solid var(--electric-blue)',
              color: 'var(--electric-blue)'
            }}>
              <span>COMMAND TERMINAL</span>
            </div>
          </div>
          
          {session?.user?.image && (
            <div className="flex items-center">
              <div className="mr-3 px-3 py-1 text-xs rounded" style={{ 
                backgroundColor: 'rgba(0, 0, 0, 0.3)', 
                border: '1px solid var(--neon-green)',
                color: 'var(--neon-green)'
              }}>
                USER: {session.user.name?.toUpperCase()}
              </div>
              <div className="relative">
                <div className="absolute inset-0 rounded-full" style={{ 
                  border: '2px solid var(--neon-green)',
                  boxShadow: '0 0 5px rgba(0, 255, 135, 0.5)',
                  transform: 'scale(1.1)'
                }}></div>
                <Image
                  src={session.user.image}
                  alt={session.user.name || 'User'}
                  width={36}
                  height={36}
                  className="rounded-full"
                />
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="ml-4 px-3 py-1 text-sm transition-all duration-200 rounded"
                style={{ 
                  backgroundColor: 'rgba(255, 59, 48, 0.1)',
                  color: 'var(--crimson-red)',
                  border: '1px solid var(--crimson-red)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--crimson-red)';
                  e.currentTarget.style.color = 'var(--dark-slate)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 59, 48, 0.1)';
                  e.currentTarget.style.color = 'var(--crimson-red)';
                }}
              >
                DISCONNECT
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Operations Panel */}
          <div className="border rounded-lg p-6 mb-8" style={{ 
            backgroundColor: 'rgba(27, 43, 52, 0.7)',
            backdropFilter: 'blur(5px)',
            borderColor: 'var(--neon-green)',
            boxShadow: '0 0 15px rgba(0, 255, 135, 0.15)'
          }}>
            {/* Terminal-like header */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 'var(--neon-green)' }}></div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--neon-green)' }}>
                  COMMIT ANALYSIS MODULE
                </h2>
              </div>
              <div className="px-2 py-1 text-xs rounded" style={{ 
                backgroundColor: 'rgba(0, 0, 0, 0.3)', 
                border: '1px solid var(--electric-blue)',
                color: 'var(--electric-blue)'
              }}>
                OPERATIONAL STATUS: ACTIVE
              </div>
            </div>

            {/* Error display with cyberpunk style */}
            {error && (
              <div className="mb-6 p-4 rounded-md border flex flex-col md:flex-row md:items-center" style={{
                backgroundColor: 'rgba(255, 59, 48, 0.1)',
                borderColor: 'var(--crimson-red)',
                color: 'var(--crimson-red)'
              }}>
                <div className="flex items-start">
                  <svg className="h-5 w-5 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>SYSTEM ALERT: {error}</div>
                </div>
                {error.includes('authentication') && (
                  <button
                    className="mt-3 md:mt-0 md:ml-4 px-4 py-1 text-sm rounded-md transition-all duration-200"
                    style={{ 
                      backgroundColor: 'var(--dark-slate)',
                      color: 'var(--electric-blue)',
                      border: '1px solid var(--electric-blue)'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--electric-blue)';
                      e.currentTarget.style.color = 'var(--dark-slate)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--dark-slate)';
                      e.currentTarget.style.color = 'var(--electric-blue)';
                    }}
                    onClick={() => signOut({ callbackUrl: '/' })}
                  >
                    REINITIALIZE SESSION
                  </button>
                )}
              </div>
            )}

            <form onSubmit={generateSummary} className="space-y-8">
              {/* Date range controls with cyberpunk styling */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="since"
                    className="block text-sm mb-2"
                    style={{ color: 'var(--electric-blue)' }}
                  >
                    DATA RANGE: START DATE
                  </label>
                  <div className="relative">
                    <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
                    <input
                      type="date"
                      id="since"
                      value={dateRange.since}
                      onChange={(e) =>
                        setDateRange((prev) => ({ ...prev, since: e.target.value }))
                      }
                      className="block w-full pl-3 py-2 pr-3 rounded-md focus:outline-none"
                      style={{ 
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        borderLeft: 'none',
                        borderTop: '1px solid var(--electric-blue)',
                        borderRight: '1px solid var(--electric-blue)',
                        borderBottom: '1px solid var(--electric-blue)',
                        color: 'var(--foreground)',
                        paddingLeft: '12px'
                      }}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="until"
                    className="block text-sm mb-2"
                    style={{ color: 'var(--electric-blue)' }}
                  >
                    DATA RANGE: END DATE
                  </label>
                  <div className="relative">
                    <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
                    <input
                      type="date"
                      id="until"
                      value={dateRange.until}
                      onChange={(e) =>
                        setDateRange((prev) => ({ ...prev, until: e.target.value }))
                      }
                      className="block w-full pl-3 py-2 pr-3 rounded-md focus:outline-none"
                      style={{ 
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        borderLeft: 'none',
                        borderTop: '1px solid var(--electric-blue)',
                        borderRight: '1px solid var(--electric-blue)',
                        borderBottom: '1px solid var(--electric-blue)',
                        color: 'var(--foreground)',
                        paddingLeft: '12px'
                      }}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Repository selection panel with cyber styling */}
              <div className="mt-6">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm" style={{ color: 'var(--electric-blue)' }}>
                    TARGET REPOSITORIES
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllRepos}
                    className="text-xs px-3 py-1 rounded transition-all duration-200"
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      color: 'var(--neon-green)',
                      border: '1px solid var(--neon-green)'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--neon-green)';
                      e.currentTarget.style.color = 'var(--dark-slate)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
                      e.currentTarget.style.color = 'var(--neon-green)';
                    }}
                  >
                    {selectedRepos.length === repositories.length
                      ? 'DESELECT ALL'
                      : 'SELECT ALL'}
                  </button>
                </div>
                
                {/* Repository list with cyber styling */}
                <div className="overflow-y-auto max-h-60 border rounded-md p-3" 
                  style={{ 
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    borderColor: 'var(--electric-blue)',
                    boxShadow: 'inset 0 0 10px rgba(59, 142, 234, 0.1)'
                  }}>
                  {repositories.length === 0 ? (
                    <div className="p-3 text-center" style={{ color: 'var(--foreground)' }}>
                      {loading ? (
                        <div className="flex items-center justify-center">
                          <span className="inline-block w-4 h-4 border-2 border-t-transparent rounded-full animate-spin mr-2" 
                            style={{ borderColor: 'var(--neon-green)', borderTopColor: 'transparent' }}></span>
                          <span>SCANNING REPOSITORIES...</span>
                        </div>
                      ) : (
                        <span>NO REPOSITORIES DETECTED</span>
                      )}
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {repositories.map((repo) => (
                        <li key={repo.id} className="flex items-center rounded p-1.5 hover:bg-opacity-30 transition-colors duration-150"
                          style={{ 
                            backgroundColor: selectedRepos.includes(repo.full_name) ? 'rgba(0, 255, 135, 0.1)' : 'transparent',
                            borderLeft: selectedRepos.includes(repo.full_name) ? '2px solid var(--neon-green)' : '2px solid transparent'
                          }}>
                          <input
                            type="checkbox"
                            id={`repo-${repo.id}`}
                            checked={selectedRepos.includes(repo.full_name)}
                            onChange={() => handleRepoToggle(repo.full_name)}
                            className="h-4 w-4 rounded"
                            style={{ 
                              accentColor: 'var(--neon-green)',
                              borderColor: 'var(--neon-green)'
                            }}
                          />
                          <label
                            htmlFor={`repo-${repo.id}`}
                            className="ml-2 block text-sm cursor-pointer"
                            style={{ color: 'var(--foreground)' }}
                          >
                            {repo.full_name}
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Command buttons area */}
              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center"
                  style={{ 
                    backgroundColor: loading ? 'rgba(0, 0, 0, 0.3)' : 'var(--dark-slate)',
                    color: 'var(--neon-green)',
                    border: '2px solid var(--neon-green)',
                    boxShadow: loading ? 'none' : '0 0 10px rgba(0, 255, 135, 0.2)',
                    opacity: loading ? 0.7 : 1,
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                  onMouseOver={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = 'var(--neon-green)';
                      e.currentTarget.style.color = 'var(--dark-slate)';
                      e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 255, 135, 0.4)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = 'var(--dark-slate)';
                      e.currentTarget.style.color = 'var(--neon-green)';
                      e.currentTarget.style.boxShadow = '0 0 10px rgba(0, 255, 135, 0.2)';
                    }
                  }}
                >
                  {loading ? (
                    <>
                      <span className="mr-2 inline-block w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" 
                        style={{ borderColor: 'var(--neon-green)', borderTopColor: 'transparent' }}></span>
                      ANALYZING DATA...
                    </>
                  ) : (
                    <>
                      GENERATE SUMMARY
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {summary && (
            <div className="mt-8 border rounded-lg p-6" style={{ 
              backgroundColor: 'rgba(27, 43, 52, 0.7)',
              backdropFilter: 'blur(5px)',
              borderColor: 'var(--electric-blue)',
              boxShadow: '0 0 20px rgba(59, 142, 234, 0.15)'
            }}>
              {/* Terminal-like header */}
              <div className="flex items-center justify-between mb-6 border-b pb-3" style={{ borderColor: 'var(--electric-blue)' }}>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--electric-blue)' }}>
                    COMMIT ANALYSIS: {summary.user?.toUpperCase()}
                  </h2>
                </div>
                <div className="px-2 py-1 text-xs rounded flex items-center" style={{ 
                  backgroundColor: 'rgba(0, 0, 0, 0.3)', 
                  border: '1px solid var(--neon-green)',
                  color: 'var(--neon-green)'
                }}>
                  <span className="inline-block w-2 h-2 rounded-full mr-2 animate-pulse" style={{ backgroundColor: 'var(--neon-green)' }}></span>
                  <span>ANALYSIS COMPLETE</span>
                </div>
              </div>

              {/* Stats dashboard with cyber styling */}
              <div className="mb-8">
                <h3 className="text-sm uppercase mb-3" style={{ color: 'var(--neon-green)' }}>
                  METRICS OVERVIEW
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-md border relative" style={{ 
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    borderColor: 'var(--neon-green)',
                    boxShadow: '0 0 10px rgba(0, 255, 135, 0.1)'
                  }}>
                    <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: 'var(--neon-green)' }}></div>
                    <p className="text-xs uppercase mb-1" style={{ color: 'var(--neon-green)' }}>COMMIT COUNT</p>
                    <p className="text-3xl font-mono" style={{ color: 'var(--foreground)' }}>
                      {summary.stats.totalCommits}
                    </p>
                  </div>
                  <div className="p-4 rounded-md border relative" style={{ 
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    borderColor: 'var(--electric-blue)',
                    boxShadow: '0 0 10px rgba(59, 142, 234, 0.1)'
                  }}>
                    <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
                    <p className="text-xs uppercase mb-1" style={{ color: 'var(--electric-blue)' }}>REPOSITORIES</p>
                    <p className="text-3xl font-mono" style={{ color: 'var(--foreground)' }}>
                      {summary.stats.repositories.length}
                    </p>
                  </div>
                  <div className="p-4 rounded-md border relative" style={{ 
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    borderColor: 'var(--luminous-yellow)',
                    boxShadow: '0 0 10px rgba(255, 200, 87, 0.1)'
                  }}>
                    <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: 'var(--luminous-yellow)' }}></div>
                    <p className="text-xs uppercase mb-1" style={{ color: 'var(--luminous-yellow)' }}>ACTIVE DAYS</p>
                    <p className="text-3xl font-mono" style={{ color: 'var(--foreground)' }}>
                      {summary.stats.dates.length}
                    </p>
                  </div>
                </div>
              </div>

              {summary.aiSummary && (
                <>
                  {/* Key Themes */}
                  <div className="mb-8">
                    <div className="flex items-center mb-3">
                      <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
                      <h3 className="text-sm uppercase" style={{ color: 'var(--electric-blue)' }}>
                        IDENTIFIED PATTERNS
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {summary.aiSummary.keyThemes.map((theme, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 rounded-md text-sm"
                          style={{ 
                            backgroundColor: 'rgba(0, 255, 135, 0.1)',
                            border: '1px solid var(--neon-green)',
                            color: 'var(--neon-green)'
                          }}
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Technical Areas */}
                  <div className="mb-8">
                    <div className="flex items-center mb-3">
                      <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
                      <h3 className="text-sm uppercase" style={{ color: 'var(--electric-blue)' }}>
                        TECHNICAL FOCUS AREAS
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {summary.aiSummary.technicalAreas.map((area, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center p-3 rounded-md"
                          style={{ 
                            backgroundColor: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid var(--electric-blue)'
                          }}
                        >
                          <span style={{ color: 'var(--foreground)' }}>{area.name}</span>
                          <span className="px-2 py-1 rounded text-xs" style={{ 
                            backgroundColor: 'rgba(59, 142, 234, 0.2)',
                            color: 'var(--electric-blue)'
                          }}>
                            {area.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Accomplishments */}
                  <div className="mb-8">
                    <div className="flex items-center mb-3">
                      <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
                      <h3 className="text-sm uppercase" style={{ color: 'var(--electric-blue)' }}>
                        KEY ACHIEVEMENTS
                      </h3>
                    </div>
                    <div className="border rounded-md p-4" style={{ 
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      borderColor: 'var(--neon-green)'
                    }}>
                      <ul className="space-y-3" style={{ color: 'var(--foreground)' }}>
                        {summary.aiSummary.accomplishments.map((accomplishment, index) => (
                          <li key={index} className="flex items-start">
                            <span className="inline-block w-5 flex-shrink-0 mr-2" style={{ color: 'var(--neon-green)' }}>→</span>
                            <span>{accomplishment}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Commit Types */}
                  <div className="mb-8">
                    <div className="flex items-center mb-3">
                      <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
                      <h3 className="text-sm uppercase" style={{ color: 'var(--electric-blue)' }}>
                        COMMIT CLASSIFICATION
                      </h3>
                    </div>
                    <div className="space-y-4">
                      {summary.aiSummary.commitsByType.map((type, index) => (
                        <div key={index} className="border-l-2 pl-4 py-1" style={{ borderColor: 'var(--neon-green)' }}>
                          <div className="flex justify-between items-center">
                            <h4 className="font-medium" style={{ color: 'var(--neon-green)' }}>
                              {type.type}
                            </h4>
                            <span className="text-xs px-2 py-1 rounded" style={{ 
                              backgroundColor: 'rgba(0, 255, 135, 0.1)',
                              color: 'var(--neon-green)'
                            }}>
                              {type.count}
                            </span>
                          </div>
                          <p className="text-sm mt-1" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                            {type.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="mb-8">
                    <div className="flex items-center mb-3">
                      <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
                      <h3 className="text-sm uppercase" style={{ color: 'var(--electric-blue)' }}>
                        TEMPORAL ANALYSIS
                      </h3>
                    </div>
                    <div className="space-y-4">
                      {summary.aiSummary.timelineHighlights.map((highlight, index) => (
                        <div key={index} className="flex border-b pb-3" style={{ borderColor: 'rgba(59, 142, 234, 0.2)' }}>
                          <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center mr-3" style={{ 
                            backgroundColor: 'rgba(59, 142, 234, 0.1)',
                            border: '1px solid var(--electric-blue)',
                            color: 'var(--electric-blue)'
                          }}>
                            {index + 1}
                          </div>
                          <div>
                            <div className="text-xs font-mono mb-1" style={{ color: 'var(--electric-blue)' }}>
                              {new Date(highlight.date).toLocaleDateString()}
                            </div>
                            <div style={{ color: 'var(--foreground)' }}>
                              {highlight.description}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Overall Summary */}
                  <div>
                    <div className="flex items-center mb-3">
                      <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
                      <h3 className="text-sm uppercase" style={{ color: 'var(--electric-blue)' }}>
                        COMPREHENSIVE ANALYSIS
                      </h3>
                    </div>
                    <div className="p-4 rounded-md border" style={{ 
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      borderColor: 'var(--neon-green)',
                      color: 'var(--foreground)'
                    }}>
                      <div className="text-xs mb-2 font-mono" style={{ color: 'var(--neon-green)' }}>
                        $ AI_ANALYSIS --detailed-output
                      </div>
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