'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

interface NavItem {
  name: string;
  href?: string;
  icon?: React.ReactNode;
  adminOnly?: boolean;
  onClick?: () => void;
  isLogout?: boolean;
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  desktopOpen?: boolean;
  onDesktopToggle?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose, desktopOpen = false, onDesktopToggle }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);

  const handleLogout = async () => {
    await logout();
    setShowLogoutModal(false);
    router.push('/');
  };

  const navigation: NavItem[] = [
    { 
      name: 'Home', 
      href: '/dashboard',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    { 
      name: 'Students', 
      href: '/students',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    },
    { 
      name: 'Events', 
      href: '/events',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    { 
      name: 'Documents', 
      href: '/documents',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    { 
      name: 'Attendance', 
      href: '/attendance/history',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    },
    { 
      name: 'Strikes', 
      href: '/strikes', 
      adminOnly: false,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    },
    { 
      name: 'GEO Directory', 
      href: '/staff?role=staff', 
      adminOnly: false, // All staff can view the GEO directory
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    { 
      name: 'Admin Directory', 
      href: '/staff?role=admin', 
      adminOnly: true,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    },
    { 
      name: 'Reports', 
      href: '/reports', 
      adminOnly: true,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    { 
      name: 'Settings', 
      href: '/settings',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    { 
      name: 'Logout', 
      onClick: () => setShowLogoutModal(true),
      isLogout: true,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      )
    },
  ];

  const filteredNavigation = navigation.filter(
    (item) => !item.adminOnly || user?.role === 'admin'
  );

  // Navigation content
  const navigationContent = (
    <nav className="p-4 space-y-1">
      {filteredNavigation.map((item) => {
        // Handle logout button
        if (item.isLogout && item.onClick) {
          return (
            <button
              key={item.name}
              onClick={() => {
                item.onClick?.();
              }}
              className={cn(
                'group w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
                'text-gray-700 hover:text-[#57068c]'
              )}
            >
              {item.icon && (
                <span className={cn(
                  'mr-3 flex-shrink-0 transition-colors',
                  'text-gray-700 group-hover:text-[#57068c]'
                )}>
                  {item.icon}
                </span>
              )}
              <span className="truncate">{item.name}</span>
            </button>
          );
        }
        
        // Handle regular navigation items
        if (!item.href) return null;
        
        // Handle query parameters in href
        const hrefPath = item.href.split('?')[0];
        const isActive = pathname === hrefPath || pathname === item.href || pathname?.startsWith(hrefPath + '/');
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
              isActive
                ? 'text-[#57068c]'
                : 'text-gray-700 hover:text-[#57068c]'
            )}
          >
            {item.icon && (
              <span className={cn(
                'mr-3 flex-shrink-0 transition-colors',
                isActive ? 'text-[#57068c]' : 'text-gray-700 group-hover:text-[#57068c]'
              )}>
                {item.icon}
              </span>
            )}
            <span className="truncate">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600/75 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar (Drawer) */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-purple-50 shadow-xl transform transition-transform duration-300 ease-in-out lg:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-14 items-center justify-between px-4 border-b border-gray-200">
          <span className="text-lg font-bold text-gray-900">Menu</span>
          <button
            type="button"
            className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            onClick={onClose}
            aria-label="Close menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {navigationContent}
          </div>
        </div>
      </aside>

      {/* Desktop Sidebar — sticky so it stays in view when the page is scrolled (header is h-16 from sm+) */}
      <aside
        className={cn(
          'hidden lg:block shrink-0 bg-purple-50 border-r border-purple-100 transition-all duration-300 ease-in-out',
          'lg:sticky lg:top-16 lg:z-30 lg:self-start',
          'lg:min-h-[calc(100vh-4rem)] lg:max-h-[calc(100vh-4rem)]',
          desktopOpen ? 'w-64' : 'w-0 overflow-hidden border-0'
        )}
      >
        {desktopOpen && (
          <div className="h-full max-h-[calc(100vh-4rem)] overflow-y-auto">
            {navigationContent}
          </div>
        )}
      </aside>

      <Modal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="Confirm Logout"
        size="sm"
        centerTitle
      >
        <p className="text-sm text-gray-700">
          Are you sure you want to log out?
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button size="sm" variant="outline" onClick={() => setShowLogoutModal(false)}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={handleLogout}>
            Log Out
          </Button>
        </div>
      </Modal>
    </>
  );
};

export default Sidebar;
