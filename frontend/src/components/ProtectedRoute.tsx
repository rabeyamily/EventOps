'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import FullScreenLoading from '@/components/FullScreenLoading';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

/**
 * Component to protect routes that require authentication
 */
export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, hasHydrated, fetchUser } = useAuthStore();
  const hasCheckedAuth = useRef(false);
  const userRole = user?.role;

  // Check authentication status - only fetch once if not authenticated
  useEffect(() => {
    if (!hasHydrated || isLoading) return; // Wait for persisted auth + initial fetch
    
    if (!isAuthenticated) {
      if (!hasCheckedAuth.current) {
        hasCheckedAuth.current = true;
        fetchUser()
          .catch(() => {
            router.push('/');
          });
      } else {
        // Already checked and still not authenticated, redirect
        router.push('/');
      }
    } else {
      // User is authenticated, reset the check flag for future use
      hasCheckedAuth.current = false;
    }
  }, [hasHydrated, isLoading, isAuthenticated, fetchUser, router]);

  // Handle admin requirement separately
  useEffect(() => {
    if (hasHydrated && !isLoading && isAuthenticated && requireAdmin && userRole !== 'admin') {
      router.push('/dashboard');
    }
  }, [hasHydrated, isLoading, isAuthenticated, requireAdmin, userRole, router]);

  if (!hasHydrated || isLoading) {
    return <FullScreenLoading />;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requireAdmin && user?.role !== 'admin') {
    return null;
  }

  return <>{children}</>;
}

