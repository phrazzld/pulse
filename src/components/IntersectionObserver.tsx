import { useRef, useEffect } from 'react';

interface IntersectionObserverProps {
  onIntersect: () => void;
  rootMargin?: string;
  threshold?: number;
  enabled?: boolean;
  children?: React.ReactNode;
}

/**
 * Component that detects when it becomes visible in the viewport
 * and triggers the onIntersect callback
 */
export default function IntersectionObserver({
  onIntersect,
  rootMargin = '0px',
  threshold = 0.1,
  enabled = true,
  children
}: IntersectionObserverProps) {
  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // If disabled, don't set up the observer
    if (!enabled) return;

    const observer = new window.IntersectionObserver(
      (entries) => {
        // Check if the target element is intersecting with the viewport
        if (entries[0]?.isIntersecting) {
          onIntersect();
        }
      },
      {
        rootMargin,
        threshold
      }
    );

    // Start observing the target element
    const currentTarget = targetRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    // Clean up the observer when the component unmounts
    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
      observer.disconnect();
    };
  }, [onIntersect, rootMargin, threshold, enabled]);

  return (
    <div ref={targetRef} data-testid="intersection-observer">
      {children}
    </div>
  );
}