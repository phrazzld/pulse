import React from 'react';

interface LoadMoreButtonProps {
  onClick: () => void;
  loading: boolean;
  hasMore: boolean;
  className?: string;
}

/**
 * Button component for loading more items in a paginated list
 */
export default function LoadMoreButton({
  onClick,
  loading,
  hasMore,
  className = ''
}: LoadMoreButtonProps) {
  // Don't render if there's nothing more to load
  if (!hasMore) return null;

  return (
    <div className={`flex justify-center py-4 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="px-5 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center"
        style={{ 
          backgroundColor: loading ? 'rgba(0, 0, 0, 0.3)' : 'var(--dark-slate)',
          color: 'var(--electric-blue)',
          border: '1px solid var(--electric-blue)',
          boxShadow: loading ? 'none' : '0 0 10px rgba(59, 142, 234, 0.2)',
          opacity: loading ? 0.7 : 1,
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
        onMouseOver={(e) => {
          if (!loading) {
            e.currentTarget.style.backgroundColor = 'var(--electric-blue)';
            e.currentTarget.style.color = 'var(--dark-slate)';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(59, 142, 234, 0.4)';
          }
        }}
        onMouseOut={(e) => {
          if (!loading) {
            e.currentTarget.style.backgroundColor = 'var(--dark-slate)';
            e.currentTarget.style.color = 'var(--electric-blue)';
            e.currentTarget.style.boxShadow = '0 0 10px rgba(59, 142, 234, 0.2)';
          }
        }}
      >
        {loading ? (
          <>
            <span className="mr-2 inline-block w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" 
              style={{ borderColor: 'var(--electric-blue)', borderTopColor: 'transparent' }}></span>
            <span className="relative">
              LOADING
              <span className="absolute -right-4 top-0">
                <span className="animate-pulse">.</span>
                <span className="animate-pulse" style={{ animationDelay: '0.3s' }}>.</span>
                <span className="animate-pulse" style={{ animationDelay: '0.6s' }}>.</span>
              </span>
            </span>
          </>
        ) : (
          <>
            LOAD MORE
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
            </svg>
          </>
        )}
      </button>
    </div>
  );
}