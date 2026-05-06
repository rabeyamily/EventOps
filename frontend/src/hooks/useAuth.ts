import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';

/**
 * Custom hook for authentication
 * Automatically redirects to login if not authenticated
 */
export const useAuth = (redirectToLogin: boolean = true) => {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, fetchUser } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && redirectToLogin) {
      fetchUser().catch(() => {
        router.push('/');
      });
    }
  }, [isAuthenticated, isLoading, redirectToLogin, router, fetchUser]);

  return {
    user,
    isAuthenticated,
    isLoading,
    isAdmin: user?.role === 'admin',
    isStaff: user?.role === 'staff' || user?.role === 'admin',
  };
};

/**
 * Hook to check if user has admin role
 */
export const useIsAdmin = () => {
  const { user } = useAuthStore();
  return user?.role === 'admin';
};

