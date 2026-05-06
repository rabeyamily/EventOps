'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useViewingSemesterStore } from '@/store/viewing-semester-store';
import Button from '../ui/Button';
import { Spinner } from '@/components/ui';
import { globalSearch, SearchResult } from '@/lib/api/search';
import { Student, Event, Staff } from '@/types';
import { getCurrentSemester, getAvailableSemesters } from '@/lib/api/system-settings';
import NotificationBell from '../notifications/NotificationBell';

interface HeaderProps {
  onMenuClick?: () => void;
  onDesktopSidebarToggle?: () => void;
  desktopSidebarOpen?: boolean;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, onDesktopSidebarToggle, desktopSidebarOpen = false }) => {
  const router = useRouter();
  const { user } = useAuthStore();
  const { viewingSemester, setViewingSemester } = useViewingSemesterStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult>({ students: [], events: [], staff: [] });
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
  const [showSemesterDropdown, setShowSemesterDropdown] = useState(false);
  const semesterDropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hydrate viewing semester from API if not set, and fetch available semesters
  useEffect(() => {
    const init = async () => {
      const [current, available] = await Promise.all([
        getCurrentSemester().catch(() => null),
        getAvailableSemesters(),
      ]);
      setAvailableSemesters(available);
      // Only set default if store is still null (avoid overwriting rehydrated value)
      if (current && useViewingSemesterStore.getState().viewingSemester === null) {
        setViewingSemester(current.semesterString);
      }
    };
    init();
  }, [setViewingSemester]);

  // Refetch available semesters when opening dropdown (so list is current after admin adds one)
  const openSemesterDropdown = () => {
    setShowSemesterDropdown((open) => {
      if (!open) {
        getAvailableSemesters().then(setAvailableSemesters);
      }
      return !open;
    });
  };
  // Close semester dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (semesterDropdownRef.current && !semesterDropdownRef.current.contains(e.target as Node)) {
        setShowSemesterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length === 0) {
      setSearchResults({ students: [], events: [], staff: [] });
      setShowSearchResults(false);
      return;
    }

    if (searchQuery.trim().length < 2) {
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await globalSearch(searchQuery.trim(), 5);
        setSearchResults(results);
        setShowSearchResults(true);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults({ students: [], events: [], staff: [] });
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearchClick = (type: 'student' | 'event' | 'staff', id: string) => {
    setShowSearchResults(false);
    setSearchQuery('');
    if (type === 'student') {
      router.push(`/students/${id}`);
    } else if (type === 'event') {
      router.push(`/events/${id}`);
    } else if (type === 'staff') {
      router.push(`/staff`);
    }
  };

  const totalResults = searchResults.students.length + searchResults.events.length + searchResults.staff.length;

  return (
    <header className="sticky top-0 z-40 shadow-sm" style={{ backgroundColor: '#57068c' }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 sm:h-16 items-center justify-between">
          {/* Mobile: Left side - Menu button + Notification bell */}
          <div className="lg:hidden flex items-center -ml-2">
            <button
              type="button"
              className="p-2 rounded-md text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
              onClick={onMenuClick}
              aria-label="Open menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <NotificationBell />
          </div>

          {/* Mobile: Home icon - positioned near app name */}
          <div className="lg:hidden flex items-center space-x-1">
            <Link
              href="/dashboard"
              onClick={(e) => e.stopPropagation()}
              className="text-white hover:text-white/80 p-2 rounded-md transition-colors"
              aria-label="Home"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </Link>
            <Link href="/dashboard" className="flex items-center pr-2">
              <h1 className="text-lg sm:text-xl font-bold text-white whitespace-nowrap">VSP EventOps</h1>
            </Link>
          </div>

          {/* Desktop Sidebar Toggle + Notification bell */}
          <div className="hidden lg:flex items-center gap-1">
            {onDesktopSidebarToggle && (
              <button
                type="button"
                className="-ml-2 p-2 rounded-md text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
                onClick={onDesktopSidebarToggle}
                aria-label={desktopSidebarOpen ? "Close sidebar" : "Open sidebar"}
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {desktopSidebarOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            )}
            <NotificationBell />
          </div>

          {/* Desktop Navigation - Centered */}
          <nav className="hidden lg:flex items-center space-x-4 absolute left-1/2 transform -translate-x-1/2">
            <Link
              href="/dashboard"
              onClick={(e) => e.stopPropagation()}
              className="text-white hover:text-white/80 p-2 rounded-md transition-colors"
              title="Home"
              aria-label="Home"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </Link>
            <Link
              href="/students"
              onClick={(e) => e.stopPropagation()}
              className="text-white hover:text-white/80 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Students
            </Link>
            <Link
              href="/events"
              onClick={(e) => e.stopPropagation()}
              className="text-white hover:text-white/80 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Events
            </Link>
            {/* Search Bar */}
            <div ref={searchRef} className="relative">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (totalResults > 0) {
                      setShowSearchResults(true);
                    }
                  }}
                  className="w-48 px-3 py-1.5 pl-8 text-sm text-gray-900 bg-white rounded-md border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/40 placeholder:text-gray-400"
                />
                <svg
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {isSearching && (
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    <Spinner size="sm" className="text-gray-500" />
                  </div>
                )}
              </div>
              {/* Search Results Dropdown */}
              {showSearchResults && totalResults > 0 && (
                <div className="absolute top-full left-0 mt-1 w-96 bg-white rounded-md shadow-lg border border-gray-200 max-h-96 overflow-y-auto z-50">
                  {searchResults.students.length > 0 && (
                    <div className="p-2">
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">Students</div>
                      {searchResults.students.map((student) => (
                        <button
                          key={student.id}
                          onClick={() => handleSearchClick('student', student.id)}
                          className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 transition-colors"
                        >
                          <div className="text-sm font-medium text-gray-900">{student.fullName}</div>
                          <div className="text-xs text-gray-500">{student.nyuEmail}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.events.length > 0 && (
                    <div className="p-2 border-t border-gray-100">
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">Events</div>
                      {searchResults.events.map((event) => (
                        <button
                          key={event.id}
                          onClick={() => handleSearchClick('event', event.id)}
                          className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 transition-colors"
                        >
                          <div className="text-sm font-medium text-gray-900">{event.name}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(event.startDate).toLocaleDateString()}
                            {event.location && ` • ${event.location}`}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.staff.length > 0 && (
                    <div className="p-2 border-t border-gray-100">
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">Staff</div>
                      {searchResults.staff.map((staff) => (
                        <button
                          key={staff.id}
                          onClick={() => handleSearchClick('staff', staff.id)}
                          className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 transition-colors"
                        >
                          <div className="text-sm font-medium text-gray-900">{staff.fullName}</div>
                          <div className="text-xs text-gray-500">{staff.email}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {showSearchResults && searchQuery.trim().length >= 2 && totalResults === 0 && !isSearching && (
                <div className="absolute top-full left-0 mt-1 w-96 bg-white rounded-md shadow-lg border border-gray-200 p-4 z-50">
                  <div className="text-sm text-gray-500 text-center">No results found</div>
                </div>
              )}
            </div>
          </nav>


          {/* Action Buttons - Hidden on mobile, shown on desktop */}
          <div className="hidden lg:flex items-center space-x-4 sm:space-x-6">
            <div ref={semesterDropdownRef} className="relative">
              <button
                type="button"
                onClick={openSemesterDropdown}
                className="text-xs sm:text-sm text-white font-medium px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-1.5"
                title="Change viewing semester"
                aria-expanded={showSemesterDropdown}
                aria-haspopup="listbox"
              >
                <span>{viewingSemester || '…'}</span>
                <svg className="w-4 h-4 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showSemesterDropdown && (
                <div
                  className="absolute right-0 top-full mt-1 py-1 w-48 max-h-72 overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-200 z-50"
                  role="listbox"
                >
                  {availableSemesters.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">No semesters</div>
                  ) : (
                    availableSemesters.map((sem) => (
                      <button
                        key={sem}
                        type="button"
                        role="option"
                        aria-selected={viewingSemester === sem}
                        onClick={() => {
                          setViewingSemester(sem);
                          setShowSemesterDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          viewingSemester === sem
                            ? 'bg-primary-100 text-primary-800 font-medium'
                            : 'text-gray-800 hover:bg-gray-100'
                        }`}
                      >
                        {sem}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <Link href="/dashboard" className="flex items-center">
              <h1 className="text-lg sm:text-xl font-bold text-white">VSP EventOps</h1>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
