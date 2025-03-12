'use client';

import { useState, useEffect, useCallback } from 'react';
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
  private: boolean;
  language?: string | null;
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
  authMethod?: string;
  installationId?: number | null;
};

type InstallationAccount = {
  login: string;
  type: string;
  avatarUrl?: string;
};

type Installation = {
  id: number;
  account: InstallationAccount;
  appSlug: string;
  appId: number;
  repositorySelection: string;
  targetType: string;
};

type ReposResponse = {
  repositories: Repository[];
  authMethod?: string;
  installationId?: number | null;
  installations?: Installation[];
  currentInstallation?: Installation | null;
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

// Helper function to get GitHub App installation URL
function getGitHubAppInstallUrl() {
  // Use the provided app name or a generic message if not configured
  const appName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME;
  
  if (!appName) {
    // If no app name is configured, we'll create a more informative error
    console.error("GitHub App name not configured. Please set NEXT_PUBLIC_GITHUB_APP_NAME environment variable.");
    return "#github-app-not-configured";
  }
  
  return `https://github.com/apps/${appName}/installations/new`;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    since: getLastWeekDate(),
    until: getTodayDate(),
  });
  const [summary, setSummary] = useState<CommitSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRepoList, setShowRepoList] = useState(true);
  const [authMethod, setAuthMethod] = useState<string | null>(null);
  const [needsInstallation, setNeedsInstallation] = useState(false);
  const [installationId, setInstallationId] = useState<number | null>(null);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [currentInstallation, setCurrentInstallation] = useState<Installation | null>(null);
  const [showInstallationsDropdown, setShowInstallationsDropdown] = useState(false);
  
  // Handle repository fetch errors - set descriptive error message
  const handleAuthError = useCallback(() => {
    console.log('GitHub authentication issue detected.');
    setError('GitHub authentication issue detected. Your token may be invalid, expired, or missing required permissions. Please sign out and sign in again to grant all necessary permissions.');
  }, [setError]);
  
  const handleAppInstallationNeeded = useCallback(() => {
    console.log('GitHub App installation needed.');
    setNeedsInstallation(true);
    setError('GitHub App installation required. Please install the GitHub App to access all your repositories, including private ones.');
  }, [setError, setNeedsInstallation]);
  
  const fetchRepositories = useCallback(async (selectedInstallationId?: number) => {
    try {
      setLoading(true);
      
      // Add installation_id query parameter if it was provided
      const url = selectedInstallationId 
        ? `/api/repos?installation_id=${selectedInstallationId}` 
        : '/api/repos';
      
      const response = await fetch(url);
      
      if (!response.ok) {
        // Parse the error response
        const errorData = await response.json();
        
        if (errorData.needsInstallation) {
          // GitHub App not installed
          handleAppInstallationNeeded();
          return;
        }
        
        if (response.status === 401 || 
            response.status === 403 ||
            (errorData.code === 'GITHUB_AUTH_ERROR') ||
            (errorData.code === 'GITHUB_SCOPE_ERROR') ||
            (errorData.code === 'GITHUB_APP_CONFIG_ERROR') ||
            (errorData.error && (errorData.error.includes('authentication') || 
                               errorData.error.includes('scope') || 
                               errorData.error.includes('permissions')))) {
          // Auth error - token expired, invalid, or missing required scopes
          handleAuthError();
          return;
        }
        
        throw new Error(errorData.error || 'Failed to fetch repositories');
      }
      
      const data: ReposResponse = await response.json();
      setRepositories(data.repositories);
      
      // Update auth method and installation ID if available
      if (data.authMethod) {
        setAuthMethod(data.authMethod);
        console.log('Using auth method:', data.authMethod);
      }
      
      if (data.installationId) {
        setInstallationId(data.installationId);
        console.log('Using GitHub App installation ID:', data.installationId);
        setNeedsInstallation(false); // Clear the installation needed flag
      }
      
      // Update installations list
      if (data.installations && data.installations.length > 0) {
        setInstallations(data.installations);
        console.log('Available installations:', data.installations.length);
      }
      
      // Update current installation
      if (data.currentInstallation) {
        setCurrentInstallation(data.currentInstallation);
        console.log('Current installation:', data.currentInstallation.account.login);
      }
      
      setError(null); // Clear any previous errors
    } catch (error) {
      console.error('Error fetching repositories:', error);
      setError('Failed to fetch repositories. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, handleAppInstallationNeeded, setRepositories, setError, setLoading, setAuthMethod, setInstallationId, setInstallations, setCurrentInstallation]);
  
  // Function to handle switching installations
  const switchInstallation = useCallback((installId: number) => {
    if (installId !== installationId) {
      console.log('Switching to installation ID:', installId);
      fetchRepositories(installId);
    }
    setShowInstallationsDropdown(false);
  }, [installationId, fetchRepositories]);
  
  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Fetch repositories when session is available
  useEffect(() => {
    if (session) {
      fetchRepositories();
    }
  }, [session, fetchRepositories]);

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
      
      // Add installation ID if available
      if (installationId) {
        params.append('installation_id', installationId.toString());
      }

      const response = await fetch(`/api/summary?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        
        // Check for installation needed error
        if (errorData.needsInstallation) {
          handleAppInstallationNeeded();
          return;
        }
        
        // Check for auth errors
        if (response.status === 401 || 
            response.status === 403 ||
            errorData.code === 'GITHUB_AUTH_ERROR' ||
            errorData.code === 'GITHUB_APP_CONFIG_ERROR') {
          handleAuthError();
          return;
        }
        
        throw new Error(errorData.error || 'Failed to generate summary');
      }

      const data = await response.json();
      setSummary(data);
      
      // Update auth method and installation ID if available
      if (data.authMethod) {
        setAuthMethod(data.authMethod);
      }
      
      if (data.installationId) {
        setInstallationId(data.installationId);
        setNeedsInstallation(false); // Clear the installation needed flag
      }
      
      // Update installations list
      if (data.installations && data.installations.length > 0) {
        setInstallations(data.installations);
      }
      
      // Update current installation
      if (data.currentInstallation) {
        setCurrentInstallation(data.currentInstallation);
      }
    } catch (error: any) {
      console.error('Error generating summary:', error);
      setError(error.message || 'Failed to generate summary. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Repository selection has been removed - we always use all repositories

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
              <div className="mb-1">{`> Loading session data...`}</div>
              <div className="mb-1">{`> Establishing secure connection...`}</div>
              <div className="mb-1">{`> Authenticating GitHub credentials...`}</div>
              <div className="animate-pulse" style={{ color: 'var(--electric-blue)' }}>
                {`> Preparing dashboard interface...`}
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
                <div className="md:ml-auto mt-3 md:mt-0 flex space-x-3">
                  {needsInstallation && (
                    <>
                      {getGitHubAppInstallUrl() === "#github-app-not-configured" ? (
                        <div className="px-4 py-1 text-sm rounded-md" style={{ 
                          backgroundColor: 'rgba(255, 59, 48, 0.1)',
                          color: 'var(--crimson-red)',
                          border: '1px solid var(--crimson-red)'
                        }}>
                          APP NOT CONFIGURED
                        </div>
                      ) : (
                        <a
                          href={getGitHubAppInstallUrl()}
                          className="px-4 py-1 text-sm rounded-md transition-all duration-200"
                          style={{ 
                            backgroundColor: 'var(--dark-slate)',
                            color: 'var(--neon-green)',
                            border: '1px solid var(--neon-green)'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--neon-green)';
                            e.currentTarget.style.color = 'var(--dark-slate)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--dark-slate)';
                            e.currentTarget.style.color = 'var(--neon-green)';
                          }}
                        >
                          INSTALL GITHUB APP
                        </a>
                      )}
                    </>
                  )}
                  {error.includes('authentication') && (
                    <button
                      className="px-4 py-1 text-sm rounded-md transition-all duration-200"
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
              </div>
            )}
            
            {/* GitHub App authentication status banner */}
            {authMethod && (
              <div className="mb-6 p-3 rounded-md border" style={{
                backgroundColor: authMethod === 'github_app' 
                  ? 'rgba(0, 255, 135, 0.1)' 
                  : 'rgba(59, 142, 234, 0.1)',
                borderColor: authMethod === 'github_app' 
                  ? 'var(--neon-green)' 
                  : 'var(--electric-blue)',
                color: authMethod === 'github_app' 
                  ? 'var(--neon-green)' 
                  : 'var(--electric-blue)'
              }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <div>
                      {authMethod === 'github_app' 
                        ? 'GITHUB APP INTEGRATION ACTIVE' 
                        : 'USING OAUTH AUTHENTICATION'}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    {/* Installation selector dropdown */}
                    {authMethod === 'github_app' && installations.length > 0 && (
                      <div className="relative">
                        <button
                          onClick={() => setShowInstallationsDropdown(!showInstallationsDropdown)}
                          className="text-xs px-2 py-1 rounded-md transition-all duration-200 flex items-center"
                          style={{ 
                            backgroundColor: 'var(--dark-slate)',
                            color: 'var(--neon-green)',
                            border: '1px solid var(--neon-green)'
                          }}
                        >
                          {currentInstallation?.account?.login || "SELECT ACCOUNT"}
                          <svg className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {showInstallationsDropdown && (
                          <div className="absolute right-0 mt-1 w-48 rounded-md shadow-lg z-10" style={{ backgroundColor: 'var(--dark-slate)' }}>
                            <div className="py-1 rounded-md border" style={{ borderColor: 'var(--neon-green)' }}>
                              {installations.map(installation => (
                                <button
                                  key={installation.id}
                                  onClick={() => switchInstallation(installation.id)}
                                  className="block w-full text-left px-3 py-2 text-xs transition-colors duration-150"
                                  style={{ 
                                    backgroundColor: installation.id === installationId 
                                      ? 'rgba(0, 255, 135, 0.1)' 
                                      : 'transparent',
                                    color: 'var(--neon-green)'
                                  }}
                                >
                                  {installation.account.login}
                                  {installation.account.type === 'Organization' && ' (Org)'}
                                </button>
                              ))}
                              
                              {/* Add option to install on more accounts */}
                              <div className="border-t my-1" style={{ borderColor: 'rgba(0, 255, 135, 0.2)' }}></div>
                              <a
                                href={getGitHubAppInstallUrl()}
                                className="block w-full text-left px-3 py-2 text-xs"
                                style={{ color: 'var(--electric-blue)' }}
                              >
                                + Install on another account
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Install button for OAuth users */}
                    {authMethod !== 'github_app' && !installationId && !needsInstallation && (
                      <>
                        {getGitHubAppInstallUrl() === "#github-app-not-configured" ? (
                          <div className="text-xs px-2 py-1 rounded-md" style={{ 
                            backgroundColor: 'rgba(255, 59, 48, 0.1)',
                            color: 'var(--crimson-red)',
                            border: '1px solid var(--crimson-red)'
                          }}>
                            APP NEEDS SETUP
                          </div>
                        ) : (
                          <a
                            href={getGitHubAppInstallUrl()}
                            className="text-xs px-2 py-1 rounded-md transition-all duration-200"
                            style={{ 
                              backgroundColor: 'var(--dark-slate)',
                              color: 'var(--neon-green)',
                              border: '1px solid var(--neon-green)'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--neon-green)';
                              e.currentTarget.style.color = 'var(--dark-slate)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--dark-slate)';
                              e.currentTarget.style.color = 'var(--neon-green)';
                            }}
                          >
                            UPGRADE TO APP
                          </a>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Installation list panel for multiple accounts */}
            {authMethod === 'github_app' && installations.length > 0 && (
              <div className="mb-6 p-3 rounded-md border" style={{
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                borderColor: 'var(--electric-blue)',
              }}>
                <div className="flex items-center mb-2">
                  <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20" style={{ color: 'var(--electric-blue)' }}>
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm" style={{ color: 'var(--electric-blue)' }}>GITHUB APP INSTALLATIONS</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {installations.map(installation => (
                    <div 
                      key={installation.id}
                      className="p-2 rounded-md border flex items-center cursor-pointer"
                      style={{ 
                        backgroundColor: installation.id === installationId 
                          ? 'rgba(0, 255, 135, 0.1)' 
                          : 'rgba(0, 0, 0, 0.3)',
                        borderColor: installation.id === installationId 
                          ? 'var(--neon-green)' 
                          : 'var(--electric-blue)',
                      }}
                      onClick={() => switchInstallation(installation.id)}
                    >
                      <div className="flex-grow">
                        <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                          {installation.account.login}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--electric-blue)' }}>
                          {installation.account.type}
                        </div>
                      </div>
                      {installation.id === installationId && (
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--neon-green)' }}></div>
                      )}
                    </div>
                  ))}
                  
                  {/* Button to install on more accounts */}
                  <a
                    href={getGitHubAppInstallUrl()}
                    className="p-2 rounded-md border flex items-center justify-center"
                    style={{ 
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      borderColor: 'var(--electric-blue)',
                      color: 'var(--electric-blue)',
                    }}
                  >
                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span className="text-sm">Install on Another Account</span>
                  </a>
                </div>
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

              {/* Repository information panel with cyber styling */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <label className="text-sm" style={{ color: 'var(--electric-blue)' }}>
                      TARGET REPOSITORIES
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowRepoList(!showRepoList)}
                      className="ml-2 text-xs px-2 py-0.5 rounded transition-all duration-200"
                      style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        color: 'var(--electric-blue)',
                        border: '1px solid var(--electric-blue)'
                      }}
                    >
                      {showRepoList ? 'HIDE' : 'SHOW'} LIST
                    </button>
                  </div>
                  <div className="text-xs px-2 py-1 rounded flex items-center" style={{ 
                    backgroundColor: 'rgba(0, 0, 0, 0.3)', 
                    border: '1px solid var(--neon-green)',
                    color: 'var(--neon-green)'
                  }}>
                    DETECTED: {repositories.length}
                  </div>
                </div>
                
                {/* Repository info with cyber styling */}
                <div className="border rounded-md p-3" 
                  style={{ 
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    borderColor: 'var(--electric-blue)',
                    boxShadow: 'inset 0 0 10px rgba(59, 142, 234, 0.1)'
                  }}>
                  {loading && repositories.length === 0 ? (
                    <div className="flex items-center justify-center p-3" style={{ color: 'var(--foreground)' }}>
                      <span className="inline-block w-4 h-4 border-2 border-t-transparent rounded-full animate-spin mr-2" 
                        style={{ borderColor: 'var(--neon-green)', borderTopColor: 'transparent' }}></span>
                      <span>SCANNING REPOSITORIES...</span>
                    </div>
                  ) : (
                    <div>
                      <div className="p-3 mb-3 border-b" 
                        style={{ color: 'var(--foreground)', borderColor: 'rgba(59, 142, 234, 0.2)' }}>
                        <div className="flex items-center justify-center mb-2">
                          <span className="inline-block w-3 h-3 rounded-full mr-2" 
                            style={{ backgroundColor: 'var(--neon-green)' }}></span>
                          <span>ANALYZING ALL ACCESSIBLE REPOSITORIES</span>
                        </div>
                        
                        {/* Repository stats summary */}
                        {repositories.length > 0 && (
                          <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                            <div className="border rounded px-2 py-1 flex flex-col items-center justify-center"
                              style={{ borderColor: 'rgba(59, 142, 234, 0.3)' }}>
                              <div className="font-bold" style={{ color: 'var(--electric-blue)' }}>REPOS</div>
                              <div>{repositories.length}</div>
                            </div>
                            <div className="border rounded px-2 py-1 flex flex-col items-center justify-center"
                              style={{ borderColor: 'rgba(59, 142, 234, 0.3)' }}>
                              <div className="font-bold" style={{ color: 'var(--electric-blue)' }}>ORGS</div>
                              <div>{new Set(repositories.map(repo => repo.full_name.split('/')[0])).size}</div>
                            </div>
                            <div className="border rounded px-2 py-1 flex flex-col items-center justify-center"
                              style={{ borderColor: 'rgba(59, 142, 234, 0.3)' }}>
                              <div className="font-bold" style={{ color: 'var(--electric-blue)' }}>PRIVATE</div>
                              <div>{repositories.filter(repo => repo.private).length}</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Repository list with organization grouping */}
                      {showRepoList && (
                        <div className="max-h-60 overflow-y-auto" style={{ color: 'var(--foreground)' }}>
                          {repositories.length > 0 ? (
                            (() => {
                              // Group repositories by organization/owner
                              const reposByOrg = repositories.reduce((groups, repo) => {
                                const orgName = repo.full_name.split('/')[0];
                                if (!groups[orgName]) {
                                  groups[orgName] = [];
                                }
                                groups[orgName].push(repo);
                                return groups;
                              }, {} as Record<string, Repository[]>);
                              
                              // Sort organizations by repo count (descending)
                              const sortedOrgs = Object.entries(reposByOrg)
                                .sort(([, reposA], [, reposB]) => reposB.length - reposA.length);
                              
                              return sortedOrgs.map(([org, repos]) => (
                                <div key={org} className="mb-3">
                                  <div className="flex items-center px-2 py-1 mb-1" style={{ 
                                    backgroundColor: 'rgba(59, 142, 234, 0.1)',
                                    color: 'var(--electric-blue)'
                                  }}>
                                    <span className="font-bold">{org}</span>
                                    <span className="ml-2 text-xs px-1 rounded" style={{ 
                                      backgroundColor: 'rgba(0, 0, 0, 0.3)'
                                    }}>
                                      {repos.length}
                                    </span>
                                  </div>
                                  
                                  <ul className="pl-3">
                                    {repos.map(repo => (
                                      <li key={repo.id} className="text-xs py-1 flex items-center justify-between">
                                        <div className="flex items-center">
                                          <span className="inline-block w-2 h-2 mr-2" style={{ 
                                            backgroundColor: repo.private ? 'var(--crimson-red)' : 'var(--neon-green)'
                                          }}></span>
                                          <span>{repo.name}</span>
                                        </div>
                                        <div className="flex items-center">
                                          {repo.private && (
                                            <span className="ml-2 text-xs px-1 rounded" style={{ 
                                              color: 'var(--crimson-red)',
                                              backgroundColor: 'rgba(255, 59, 48, 0.1)'
                                            }}>
                                              PRIVATE
                                            </span>
                                          )}
                                          {repo.language && (
                                            <span className="ml-2 text-xs px-1 rounded" style={{ 
                                              color: 'var(--luminous-yellow)',
                                              backgroundColor: 'rgba(255, 200, 87, 0.1)'
                                            }}>
                                              {repo.language}
                                            </span>
                                          )}
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ));
                            })()
                          ) : repositories.length === 0 && !loading ? (
                            <div className="p-3 text-center" style={{ color: 'var(--crimson-red)' }}>
                              NO REPOSITORIES DETECTED
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
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