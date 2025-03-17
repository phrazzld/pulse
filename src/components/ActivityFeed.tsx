import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useProgressiveLoading } from '@/hooks/useProgressiveLoading';
import { FixedSizeList as List } from 'react-window';
import IntersectionObserver from './IntersectionObserver';
import LoadMoreButton from './LoadMoreButton';

// Define the structure of a commit for the activity feed
export type ActivityCommit = {
  sha: string;
  html_url?: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  repository?: {
    name: string;
    full_name: string;
    html_url?: string;
  };
  contributor?: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

// Props for the activity feed component
interface ActivityFeedProps {
  loadCommits: (cursor: string | null, limit: number) => Promise<{
    data: ActivityCommit[];
    nextCursor?: string | null;
    hasMore: boolean;
  }>;
  initialLoad?: boolean;
  emptyMessage?: string;
  errorMessage?: string;
  useInfiniteScroll?: boolean;
  initialLimit?: number;
  additionalItemsPerPage?: number;
  showRepository?: boolean;
  showContributor?: boolean;
  itemHeight?: number;
  maxHeight?: number | string;
}

// Component to render an individual commit item
const CommitItem = React.memo(({ 
  commit, 
  showRepository, 
  showContributor,
  style,
  isNew = false
}: { 
  commit: ActivityCommit; 
  showRepository: boolean; 
  showContributor: boolean;
  style?: React.CSSProperties;
  isNew?: boolean;
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Extract first line of commit message for the title
  const commitTitle = commit.commit.message.split('\n')[0];

  return (
    <div 
      className={`pl-12 relative ${isNew ? 'animate-fadeIn' : ''}`}
      style={{
        ...style,
        // Adding some left padding for the timeline element
        paddingLeft: '3.5rem',
      }}
    >
      {/* Timeline dot */}
      <div className="absolute left-4 top-3 w-3 h-3 rounded-full border-2" style={{ 
        backgroundColor: 'var(--dark-slate)',
        borderColor: 'var(--electric-blue)',
        zIndex: 1
      }}></div>
      
      {/* Vertical timeline line */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5" style={{ 
        backgroundColor: 'var(--electric-blue)',
        opacity: 0.4
      }}></div>
      
      {/* Commit card with simplified design */}
      <div className={`border rounded-md p-3 mb-3 ${isNew ? 'animate-pulse-highlight animate-border-pulse' : ''}`} style={{ 
        backgroundColor: 'rgba(27, 43, 52, 0.7)',
        backdropFilter: 'blur(5px)',
        borderColor: 'var(--electric-blue)',
        boxShadow: '0 0 10px rgba(59, 142, 234, 0.1)'
      }}>
        {/* Commit header with author and date */}
        <div className="flex justify-between items-start mb-2 flex-wrap">
          <div className="flex items-center mr-2">
            {showContributor && commit.contributor && (
              <div className="flex items-center">
                {commit.contributor.avatarUrl ? (
                  <Image 
                    src={commit.contributor.avatarUrl}
                    alt={commit.contributor.displayName}
                    width={20}
                    height={20}
                    className="rounded-full mr-2"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full mr-2 flex items-center justify-center" style={{ 
                    backgroundColor: 'var(--electric-blue)',
                    color: 'var(--dark-slate)',
                    fontSize: '0.75rem'
                  }}>
                    {commit.contributor.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="font-bold text-sm truncate max-w-48" style={{ color: 'var(--electric-blue)' }}>
                  {commit.contributor.displayName}
                </span>
              </div>
            )}
            
            {!showContributor && (
              <div className="flex items-center">
                <span className="font-bold text-sm truncate max-w-48" style={{ color: 'var(--electric-blue)' }}>
                  {commit.commit.author.name}
                </span>
              </div>
            )}
          </div>
          
          <div className="text-xs" style={{ color: 'var(--foreground)', opacity: 0.7 }}>
            {formatDate(commit.commit.author.date)}
          </div>
        </div>
        
        {/* Repository info if needed - condensed */}
        {showRepository && commit.repository && (
          <div className="mb-2">
            <a 
              href={commit.repository.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-1.5 py-0.5 rounded inline-flex items-center"
              style={{ 
                backgroundColor: 'rgba(0, 255, 135, 0.1)',
                color: 'var(--neon-green)',
                border: '1px solid var(--neon-green)',
                textDecoration: 'none'
              }}
            >
              <svg className="h-2.5 w-2.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z" clipRule="evenodd" />
              </svg>
              {commit.repository.full_name}
            </a>
          </div>
        )}
        
        {/* Commit message */}
        <div className="text-sm" style={{ color: 'var(--foreground)' }}>
          <a 
            href={commit.html_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit', textDecoration: 'none' }}
            className="hover:underline"
          >
            {commitTitle}
          </a>
        </div>
      </div>
    </div>
  );
});

CommitItem.displayName = 'CommitItem';

export default function ActivityFeed({
  loadCommits,
  initialLoad = true,
  emptyMessage = 'No activity data available for the selected filters.',
  errorMessage = 'Failed to load activity data. Please try again.',
  useInfiniteScroll = true,
  initialLimit = 25,
  additionalItemsPerPage = 25,
  showRepository = true,
  showContributor = true,
  itemHeight = 120, // Default item height
  maxHeight = '70vh' // Default max height for the list
}: ActivityFeedProps) {
  // Set up progressive loading with our custom hook
  const {
    items: commits,
    loading,
    initialLoading,
    incrementalLoading,
    hasMore,
    error,
    loadInitialData,
    loadMore,
    reset
  } = useProgressiveLoading<ActivityCommit>(loadCommits, {
    initialLimit,
    additionalItemsPerPage,
    infiniteScroll: useInfiniteScroll
  });

  // Track if we can trigger infinite scrolling (prevents multiple triggers)
  const [canTriggerInfiniteScroll, setCanTriggerInfiniteScroll] = useState(true);
  
  // Track newly loaded items for animations
  const [newItemsCount, setNewItemsCount] = useState(0);
  const prevCommitsLength = useRef(0);
  
  // Track window width to adjust List width
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 0);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [listWidth, setListWidth] = useState(0);
  
  // On window resize, update the width
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      if (listContainerRef.current) {
        setListWidth(listContainerRef.current.offsetWidth);
      }
    };
    
    // Initial width measurement
    if (listContainerRef.current) {
      setListWidth(listContainerRef.current.offsetWidth);
    }
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load initial data when component mounts
  useEffect(() => {
    if (initialLoad) {
      loadInitialData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoad]);
  
  // Track new items for animations
  useEffect(() => {
    if (commits.length > prevCommitsLength.current) {
      setNewItemsCount(commits.length - prevCommitsLength.current);
      prevCommitsLength.current = commits.length;
      
      // Reset the new items counter after animation completes
      const timer = setTimeout(() => {
        setNewItemsCount(0);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [commits.length]);

  // Handler for intersection observer callback
  const handleIntersect = useCallback(() => {
    if (canTriggerInfiniteScroll && hasMore && !loading) {
      setCanTriggerInfiniteScroll(false);
      loadMore().finally(() => {
        // Re-enable infinite scroll trigger after loading completes
        setTimeout(() => setCanTriggerInfiniteScroll(true), 300);
      });
    }
  }, [canTriggerInfiniteScroll, hasMore, loading, loadMore]);

  // Reset component when filters change
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);
  
  // Calculate appropriate list height
  const calculateListHeight = () => {
    if (typeof maxHeight === 'number') {
      return Math.min(maxHeight, commits.length * itemHeight);
    }
    // If maxHeight is a string (like 70vh), use that directly
    return maxHeight;
  };

  // Handle error states
  if (error) {
    return (
      <div className="p-4 rounded-md border" style={{
        backgroundColor: 'rgba(255, 59, 48, 0.1)',
        borderColor: 'var(--crimson-red)',
        color: 'var(--crimson-red)'
      }}>
        <div className="flex items-start">
          <svg className="h-5 w-5 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>{errorMessage}: {error}</div>
        </div>
      </div>
    );
  }

  // Handle empty states
  if (!loading && commits.length === 0) {
    return (
      <div className="py-8 text-center" style={{ color: 'var(--foreground)' }}>
        <div className="inline-block p-3 rounded-md border mb-3" style={{
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          borderColor: 'var(--electric-blue)'
        }}>
          <svg className="h-6 w-6 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20" style={{ color: 'var(--electric-blue)' }}>
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
          <div className="text-sm">{emptyMessage}</div>
        </div>
      </div>
    );
  }

  // Initial loading state
  if (initialLoading && commits.length === 0) {
    return (
      <div className="py-8 flex justify-center">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mb-3" style={{ 
            borderColor: 'var(--electric-blue)', 
            borderTopColor: 'transparent' 
          }}></div>
          <div style={{ color: 'var(--electric-blue)' }}>Loading activity data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Incremental loading indicator at the top */}
      {incrementalLoading && commits.length > 0 && (
        <div className="relative w-full">
          <div 
            className="absolute top-0 left-0 right-0 animate-incremental-loading" 
            style={{ 
              backgroundColor: 'var(--neon-green)',
              zIndex: 10
            }}
          ></div>
          <div className="flex justify-center p-2">
            <div className="text-xs flex items-center" style={{ color: 'var(--neon-green)' }}>
              <span className="inline-block w-3 h-3 mr-2 border-2 border-t-transparent rounded-full animate-spin" 
                style={{ borderColor: 'var(--neon-green)', borderTopColor: 'transparent' }}></span>
              Loading more activity data...
            </div>
          </div>
        </div>
      )}
      
      {/* Activity Timeline with virtualized list */}
      {commits.length > 0 && (
        <div className="relative" ref={listContainerRef}>
          {/* List Container - used to measure width */}
          <div className="relative" style={{ 
            width: '100%',
            height: calculateListHeight()
          }}>
            {/* Global vertical timeline line - just for visual effect */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 z-0" style={{ 
              backgroundColor: 'var(--electric-blue)',
              opacity: 0.2
            }}></div>
            
            {/* Virtualized List */}
            {listWidth > 0 && (
              <List
                height={typeof calculateListHeight() === 'string' ? windowWidth * 0.7 : calculateListHeight() as number}
                width={listWidth}
                itemCount={commits.length}
                itemSize={itemHeight}
                overscanCount={5}
                className="scrollbar-custom" 
              >
                {({ index, style }) => (
                  <CommitItem
                    key={commits[index].sha}
                    commit={commits[index]}
                    showRepository={showRepository}
                    showContributor={showContributor}
                    style={style}
                    isNew={index >= commits.length - newItemsCount}
                  />
                )}
              </List>
            )}
          </div>
          
          {/* Load more section - either infinite scroll or button */}
          {hasMore && (
            <>
              {useInfiniteScroll ? (
                <IntersectionObserver 
                  onIntersect={handleIntersect}
                  rootMargin="200px"
                  enabled={canTriggerInfiniteScroll && hasMore && !loading}
                >
                  <div className="h-16 flex items-center justify-center mt-2">
                    {incrementalLoading && (
                      <div className="text-xs flex items-center" style={{ color: 'var(--neon-green)' }}>
                        <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin mr-2" 
                          style={{ borderColor: 'var(--neon-green)', borderTopColor: 'transparent' }}></div>
                        <div>
                          Loading
                          <span className="inline-block animate-pulse">.</span>
                          <span className="inline-block animate-pulse" style={{ animationDelay: '0.3s' }}>.</span>
                          <span className="inline-block animate-pulse" style={{ animationDelay: '0.6s' }}>.</span>
                        </div>
                      </div>
                    )}
                  </div>
                </IntersectionObserver>
              ) : (
                <LoadMoreButton
                  onClick={loadMore}
                  loading={incrementalLoading}
                  hasMore={hasMore}
                  className="mt-3"
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}