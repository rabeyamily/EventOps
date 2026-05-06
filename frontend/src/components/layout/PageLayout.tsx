'use client';

import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import Container from './Container';
import { useAuthStore } from '@/store/auth-store';

export interface PageLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
  title?: string;
  actions?: React.ReactNode;
  noBottomPadding?: boolean;
}

const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  showSidebar = true,
  title,
  actions,
  noBottomPadding = false,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(false);
  const { user } = useAuthStore();

  const modeText = user?.role === 'admin' ? 'Admin mode' : 'GEO mode';

  const setMobileSidebar = (open: boolean) => {
    setSidebarOpen(open);
  };

  const setDesktopSidebar = (open: boolean) => {
    setDesktopSidebarOpen(open);
  };

  return (
    <div className="min-h-screen bg-gray-50 mb-0 pb-0">
      <Header 
        onMenuClick={() => setMobileSidebar(true)}
        onDesktopSidebarToggle={() => setDesktopSidebar(!desktopSidebarOpen)}
        desktopSidebarOpen={desktopSidebarOpen}
      />
      <div className="flex">
        {showSidebar && (
          <Sidebar 
            isOpen={sidebarOpen} 
            onClose={() => setMobileSidebar(false)}
            desktopOpen={desktopSidebarOpen}
            onDesktopToggle={() => setDesktopSidebar(!desktopSidebarOpen)}
          />
        )}
        <main className="flex-1 min-w-0 mb-0 pb-0">
          {(title || actions) && (
            <div className="bg-purple-50 border-b border-purple-100">
              <Container>
                <div className="flex items-center justify-between py-2 sm:py-3 gap-2 sm:gap-3">
                  {title && (
                    <h1 
                      className={`font-bold text-gray-900 flex-1 min-w-0 ${
                        title.length > 60 
                          ? 'text-sm sm:text-base' 
                          : title.length > 40 
                          ? 'text-base sm:text-lg' 
                          : 'text-lg sm:text-xl'
                      }`}
                      style={{ 
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        wordBreak: 'break-word',
                      }}
                    >
                      {title}
                    </h1>
                  )}
                  {actions && (
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap flex-shrink-0">
                      {actions}
                    </div>
                  )}
                </div>
              </Container>
            </div>
          )}
          <Container className={noBottomPadding ? "pt-2 sm:pt-3 lg:pt-4 pb-0 mb-0" : "py-4 sm:py-6 lg:py-8 mb-0"}>{children}</Container>
        </main>
      </div>
      
      {/* Floating mode indicator button */}
      {user && (
        <div className="fixed bottom-4 right-4 z-50">
          <button className="bg-[#57068c] hover:bg-[#45056a] text-white px-4 py-2 rounded-full shadow-lg text-xs font-medium transition-colors duration-200">
            {modeText}
          </button>
        </div>
      )}
    </div>
  );
};

export default PageLayout;
