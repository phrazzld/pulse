import { useState, useEffect, useRef, useCallback } from 'react';

// Debounce hook for values
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Update debounced value after delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cancel the timeout if value changes or unmounts
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Type for the debounced callback hook
type DebounceCallbackResult<T extends (...args: any[]) => any> = {
  callback: (...args: Parameters<T>) => void;
  pending: boolean;
  flush: () => void;
  cancel: () => void;
};

// Debounce hook for callbacks
export function useDebounceCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): DebounceCallbackResult<T> {
  const [pending, setPending] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef<T>(callback);
  const lastArgsRef = useRef<Parameters<T> | null>(null);

  // Update the callback ref when the callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Clear any pending timeouts when unmounting
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // The debounced callback
  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    lastArgsRef.current = args;
    setPending(true);

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set a new timeout
    timeoutRef.current = setTimeout(() => {
      if (lastArgsRef.current) {
        callbackRef.current(...lastArgsRef.current);
      }
      timeoutRef.current = null;
      setPending(false);
    }, delay);
  }, [delay]);

  // Function to immediately execute the callback with the last args
  const flush = useCallback(() => {
    if (timeoutRef.current && lastArgsRef.current) {
      clearTimeout(timeoutRef.current);
      callbackRef.current(...lastArgsRef.current);
      timeoutRef.current = null;
      setPending(false);
    }
  }, []);

  // Function to cancel the debounced callback
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      setPending(false);
    }
  }, []);

  return {
    callback: debouncedCallback,
    pending,
    flush,
    cancel,
  };
}