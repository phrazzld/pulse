'use client';

import useProtectedRoute from '@/hooks/useProtectedRoute';
import AuthLoadingScreen from '@/components/AuthLoadingScreen';

// Protected route layout for dashboard and other authenticated pages
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Use our custom hook to protect this route
  const { isLoading, isAuthenticated } = useProtectedRoute({
    redirectTo: '/',
    loadingDelay: 250
  });
  
  // Show loading screen while checking authentication
  if (isLoading || !isAuthenticated) {
    return <AuthLoadingScreen message="Accessing Dashboard" subMessage="Verifying security credentials..." />;
  }
  
  // Render children only when authenticated
  return children;
}