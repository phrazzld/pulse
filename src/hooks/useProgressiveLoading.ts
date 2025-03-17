import { useState, useCallback, useRef, useEffect } from 'react';

export type ProgressiveLoadingOptions = {
  initialLimit?: number;
  additionalItemsPerPage?: number;
  infiniteScroll?: boolean;
};

export type ProgressiveLoadingState<T> = {
  items: T[];
  loading: boolean;
  initialLoading: boolean;
  incrementalLoading: boolean;
  hasMore: boolean;
  error: string | null;
};

type FetchFunction<T> = (
  cursor: string | null,
  limit: number
) => Promise<{
  data: T[];
  nextCursor?: string | null;
  hasMore: boolean;
}>;

/**
 * Custom hook for progressive data loading with pagination
 * 
 * @param fetchFn - Function that fetches paginated data
 * @param options - Configuration options
 * @returns - State and methods for progressive loading
 */
export function useProgressiveLoading<T>(
  fetchFn: FetchFunction<T>,
  options: ProgressiveLoadingOptions = {}
) {
  const {
    initialLimit = 25,
    additionalItemsPerPage = 25,
    infiniteScroll = false
  } = options;

  // State for loading data
  const [state, setState] = useState<ProgressiveLoadingState<T>>({
    items: [],
    loading: false,
    initialLoading: false,
    incrementalLoading: false,
    hasMore: true,
    error: null
  });

  // Refs to track cursors and prevent duplicate requests
  const nextCursorRef = useRef<string | null>(null);
  const loadingRef = useRef<boolean>(false);

  // Initial data loading
  const loadInitialData = useCallback(async () => {
    if (loadingRef.current) return;
    
    setState(prev => ({ 
      ...prev, 
      loading: true, 
      initialLoading: true, 
      incrementalLoading: false, 
      error: null 
    }));
    loadingRef.current = true;
    
    try {
      const { data, nextCursor, hasMore } = await fetchFn(null, initialLimit);
      
      setState({
        items: data,
        loading: false,
        initialLoading: false,
        incrementalLoading: false,
        hasMore,
        error: null
      });
      
      nextCursorRef.current = nextCursor || null;
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        initialLoading: false,
        incrementalLoading: false,
        error: error instanceof Error ? error.message : 'An error occurred'
      }));
    } finally {
      loadingRef.current = false;
    }
  }, [fetchFn, initialLimit]);

  // Load more data
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !state.hasMore) return;
    
    setState(prev => ({ 
      ...prev, 
      loading: true, 
      initialLoading: false,
      incrementalLoading: true,
      error: null 
    }));
    loadingRef.current = true;
    
    try {
      const { data, nextCursor, hasMore } = await fetchFn(
        nextCursorRef.current,
        additionalItemsPerPage
      );
      
      setState(prev => ({
        items: [...prev.items, ...data],
        loading: false,
        initialLoading: false,
        incrementalLoading: false,
        hasMore,
        error: null
      }));
      
      nextCursorRef.current = nextCursor || null;
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        initialLoading: false,
        incrementalLoading: false,
        error: error instanceof Error ? error.message : 'An error occurred'
      }));
    } finally {
      loadingRef.current = false;
    }
  }, [fetchFn, additionalItemsPerPage, state.hasMore]);

  // Reset all state
  const reset = useCallback(() => {
    setState({
      items: [],
      loading: false,
      initialLoading: false,
      incrementalLoading: false,
      hasMore: true,
      error: null
    });
    nextCursorRef.current = null;
    loadingRef.current = false;
  }, []);

  return {
    ...state,
    loadInitialData,
    loadMore,
    reset
  };
}