'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageLayout from '@/components/layout/PageLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button, Input, Select, Card, StatusBadge, Badge, Modal, Spinner } from '@/components/ui';
import {
  getStudents,
  StudentFilters,
  deleteStudent,
  importStudentsFromGoogleSheet,
} from '@/lib/api/students';
import { Student, PaginatedResponse } from '@/types';
import { useAuthStore } from '@/store/auth-store';
import { useViewingSemesterStore } from '@/store/viewing-semester-store';
import { formatDate, getStatusColor } from '@/lib/utils';
import { useIsAdmin } from '@/hooks/useAuth';
import ListPageCsvImportButton from '@/components/admin/ListPageCsvImportButton';

export default function StudentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdmin = useIsAdmin();
  const viewingSemester = useViewingSemesterStore((s) => s.viewingSemester);
  const setViewingSemester = useViewingSemesterStore((s) => s.setViewingSemester);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnce = useRef(false);
  const latestFetchRequestId = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [importingFromSheet, setImportingFromSheet] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    semester: string;
    created: number;
    updated: number;
    skipped: number;
  } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'single' | 'bulk'; id?: string; count?: number } | null>(null);
  const [pendingDeletions, setPendingDeletions] = useState<{ students: Student[]; timer: NodeJS.Timeout; startTime: number } | null>(null);
  const [undoTimeLeft, setUndoTimeLeft] = useState<number>(30);

  const missingInfoInUrl = searchParams?.get('missingInfo') === 'true';

  // Filters - cohort syncs with viewing semester
  const [filters, setFilters] = useState<StudentFilters>({
    search: '',
    campus: undefined,
    cohort: undefined,
    status: undefined,
    missingInfo: missingInfoInUrl,
    limit: 10000,
  });

  // Sync cohort filter with viewing semester (for UI display)
  useEffect(() => {
    if (viewingSemester) {
      setFilters((prev) => ({ ...prev, cohort: viewingSemester }));
    }
  }, [viewingSemester]);

  // Keep missing-info filter in sync with the URL (e.g. from dashboard "View →")
  useEffect(() => {
    setFilters((prev) =>
      prev.missingInfo === missingInfoInUrl ? prev : { ...prev, missingInfo: missingInfoInUrl }
    );
  }, [missingInfoInUrl]);

  // Fetch students — always use viewing semester for cohort so list is native to selected semester
  const fetchStudents = async () => {
    const requestId = ++latestFetchRequestId.current;
    setLoading(true);
    setError(null);
    try {
      const filtersToUse: StudentFilters = {
        ...filters,
        ...(missingInfoInUrl && { missingInfo: true }),
        // Always use viewing semester for cohort when set, so students list is per-semester
        ...(viewingSemester && { cohort: viewingSemester }),
      };
      const data: PaginatedResponse<Student> = await getStudents(filtersToUse);
      // Ignore stale responses (e.g., refresh race between unfiltered and semester-filtered loads).
      if (requestId !== latestFetchRequestId.current) return;
      const sortedStudents = (data.data || []).sort((a, b) =>
        a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' })
      );
      setStudents(sortedStudents);
    } catch (err: any) {
      if (requestId !== latestFetchRequestId.current) return;
      setError(err.message || 'Failed to load students');
      setStudents([]);
    } finally {
      if (requestId !== latestFetchRequestId.current) return;
      setLoading(false);
      hasLoadedOnce.current = true;
    }
  };

  // Refetch (debounced) when semester/filters/URL query change.
  // Keeping this in one effect avoids stale closures that can override semester-filtered results after refresh.
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents();
    }, 350);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingSemester, filters.search, filters.campus, filters.cohort, filters.status, filters.missingInfo, missingInfoInUrl]);

  // Countdown timer for undo
  useEffect(() => {
    if (!pendingDeletions) {
      setUndoTimeLeft(30);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - pendingDeletions.startTime) / 1000);
      const remaining = Math.max(0, 30 - elapsed);
      setUndoTimeLeft(remaining);

      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [pendingDeletions]);

  // Cleanup pending deletions on unmount
  useEffect(() => {
    return () => {
      if (pendingDeletions) {
        clearTimeout(pendingDeletions.timer);
      }
    };
  }, [pendingDeletions]);

  const handleFilterChange = (key: keyof StudentFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    if (key === 'cohort' && value && /^(Spring|Fall)\s+\d{4}$/.test(value)) {
      setViewingSemester(value);
    }
  };

  const handleCreateStudent = () => {
    router.push('/students/new');
  };

  const handleViewStudent = (id: string) => {
    if (editMode) return; // Don't navigate in edit mode
    router.push(`/students/${id}`);
  };

  const handleToggleSelect = (studentId: string) => {
    setSelectedStudents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedStudents.size === students.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(students.map(s => s.id)));
    }
  };

  const handleDeleteStudent = (studentId: string) => {
    setDeleteTarget({ type: 'single', id: studentId });
    setShowDeleteModal(true);
  };

  const handleBulkDeleteClick = () => {
    if (selectedStudents.size === 0) return;
    setDeleteTarget({ type: 'bulk', count: selectedStudents.size });
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    // Clear any existing pending deletions
    if (pendingDeletions) {
      clearTimeout(pendingDeletions.timer);
      setPendingDeletions(null);
    }

    if (deleteTarget.type === 'single' && deleteTarget.id) {
      const studentToDelete = students.find(s => s.id === deleteTarget.id);
      if (!studentToDelete) return;

      setDeleting(deleteTarget.id);
      try {
        // Remove from UI immediately but keep in pending state
        setStudents((prev) => prev.filter(s => s.id !== deleteTarget.id));
        setSelectedStudents((prev) => {
          const newSet = new Set(prev);
          newSet.delete(deleteTarget.id!);
          return newSet;
        });
        setShowDeleteModal(false);
        setDeleteTarget(null);

        // Set up undo with 30 second timer
        const startTime = Date.now();
        const timer = setTimeout(async () => {
          // Actually delete after 30 seconds
          try {
            await deleteStudent(deleteTarget.id!);
          } catch (err: any) {
            console.error('Failed to delete student:', err);
            // Restore on error
            setStudents((prev) => [...prev, studentToDelete].sort((a, b) => a.fullName.localeCompare(b.fullName)));
          }
          setPendingDeletions(null);
          setUndoTimeLeft(30);
        }, 30000);

        setPendingDeletions({ students: [studentToDelete], timer, startTime });
      } catch (err: any) {
        setError(err.message || 'Failed to delete student');
        setDeleting(null);
      } finally {
        setDeleting(null);
      }
    } else if (deleteTarget.type === 'bulk') {
      const studentsToDelete = students.filter(s => selectedStudents.has(s.id));
      if (studentsToDelete.length === 0) return;

      setBulkDeleting(true);
      try {
        // Remove from UI immediately but keep in pending state
        setStudents((prev) => prev.filter(s => !selectedStudents.has(s.id)));
        const selectedIds = Array.from(selectedStudents);
        setSelectedStudents(new Set());
        setEditMode(false);
        setShowDeleteModal(false);
        setDeleteTarget(null);

        // Set up undo with 30 second timer
        const startTime = Date.now();
        const timer = setTimeout(async () => {
          // Actually delete after 30 seconds
          try {
            const deletePromises = selectedIds.map(id => deleteStudent(id));
            await Promise.all(deletePromises);
          } catch (err: any) {
            console.error('Failed to delete students:', err);
            // Restore on error
            setStudents((prev) => [...prev, ...studentsToDelete].sort((a, b) => a.fullName.localeCompare(b.fullName)));
          }
          setPendingDeletions(null);
          setUndoTimeLeft(30);
        }, 30000);

        setPendingDeletions({ students: studentsToDelete, timer, startTime });
      } catch (err: any) {
        setError(err.message || 'Failed to delete students');
      } finally {
        setBulkDeleting(false);
      }
    }
  };

  const handleUndoDelete = async () => {
    if (!pendingDeletions) return;

    // Clear the timer
    clearTimeout(pendingDeletions.timer);

    // Restore students to the list
    setStudents((prev) => [...prev, ...pendingDeletions.students].sort((a, b) => a.fullName.localeCompare(b.fullName)));

    // Clear pending deletions
    setPendingDeletions(null);
    setUndoTimeLeft(30);
  };

  const handleToggleEditMode = () => {
    setEditMode(!editMode);
    if (editMode) {
      setSelectedStudents(new Set());
    }
  };

  const handleImportFromGoogleSheet = async () => {
    const semester = viewingSemester || filters.cohort;
    if (!semester) {
      setError('Select a semester first before importing from Google Sheet.');
      return;
    }

    setImportingFromSheet(true);
    setError(null);
    setImportSummary(null);
    try {
      const result = await importStudentsFromGoogleSheet(semester);
      await fetchStudents();
      setError(null);
      setImportSummary({
        semester,
        created: result.created || 0,
        updated: result.updated || 0,
        skipped: result.skipped || 0,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to import students from Google Sheet');
    } finally {
      setImportingFromSheet(false);
    }
  };

  if (loading && !hasLoadedOnce.current) {
    return (
      <ProtectedRoute>
        <PageLayout title="Students" noBottomPadding={true}>
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-[#57068c]" />
          </div>
        </PageLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <PageLayout
        title="Students"
        noBottomPadding={true}
        actions={
          isAdmin ? (
            <div className="flex items-center gap-2">
              {editMode && selectedStudents.size > 0 && (
                <Button 
                  onClick={handleBulkDeleteClick} 
                  variant="outline" 
                  size="sm" 
                  className="text-xs sm:text-sm text-red-600 border-red-300 hover:bg-red-50"
                  isLoading={bulkDeleting}
                >
                  Delete Selected ({selectedStudents.size})
                </Button>
              )}
              {!editMode && (
                <>
                  <Button
                    onClick={handleImportFromGoogleSheet}
                    variant="outline"
                    size="sm"
                    className="text-xs sm:text-sm border-[#57068c] text-[#57068c] hover:bg-purple-50"
                    isLoading={importingFromSheet}
                    title={`Import responses for ${viewingSemester || 'selected semester'}`}
                  >
                    Import from Sheet
                  </Button>
                  <ListPageCsvImportButton href="/students/import" />
                  <Button onClick={handleCreateStudent} variant="primary" size="sm" className="text-xs sm:text-sm">
                    Add Student
                  </Button>
                </>
              )}
              <Button 
                onClick={handleToggleEditMode} 
                variant={editMode ? "primary" : "outline"} 
                size="sm" 
                className="text-xs sm:text-sm"
              >
                {editMode ? 'Done' : 'Edit'}
              </Button>
            </div>
          ) : null
        }
      >
        {/* Active Filter Indicator */}
        {filters.missingInfo && (
          <div className="mb-2 sm:mb-3 p-2 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm text-blue-800 font-medium">
                📝 Showing only students missing contact information
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilters((prev) => ({ ...prev, missingInfo: false }));
                  router.push('/students');
                }}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Clear filter
              </Button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-2 sm:mb-3">
          {/* Mobile: Collapsible Filter Section */}
          <div className="lg:hidden">
            {/* Search Bar and Filter Toggle - Same Row */}
            <div className="flex gap-2 mb-2">
              {/* Search Bar */}
              <div className="flex-1">
                <Input
                  placeholder="Search by name or email..."
                  value={filters.search || ''}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="w-full px-3 py-2 text-sm"
                />
              </div>

              {/* Filter Toggle Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg flex-shrink-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Filters</span>
                  {(filters.campus || filters.status) && (
                    <div className="flex items-center gap-1">
                      {filters.campus && (
                        <span className="px-2 py-0.5 bg-[#57068c] text-white text-xs rounded-full">
                          {filters.campus}
                        </span>
                      )}
                      {filters.status && (
                        <span className="px-2 py-0.5 bg-[#57068c] text-white text-xs rounded-full">
                          {filters.status === 'clear' ? 'Clear' : filters.status === 'one_strike' ? '1 Strike' : 'Blocked'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform ${showFilters ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Collapsible Filter Content */}
            {showFilters && (
              <div className="space-y-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                {/* Campus Toggles */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Campus</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleFilterChange('campus', undefined)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        !filters.campus
                          ? 'bg-[#57068c] text-white'
                          : 'bg-white text-gray-700 border border-gray-300'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => handleFilterChange('campus', 'NYC')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        filters.campus === 'NYC'
                          ? 'bg-[#57068c] text-white'
                          : 'bg-white text-gray-700 border border-gray-300'
                      }`}
                    >
                      NYC
                    </button>
                    <button
                      onClick={() => handleFilterChange('campus', 'Shanghai')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        filters.campus === 'Shanghai'
                          ? 'bg-[#57068c] text-white'
                          : 'bg-white text-gray-700 border border-gray-300'
                      }`}
                    >
                      Shanghai
                    </button>
                  </div>
                </div>

                {/* Status Toggles */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Status</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleFilterChange('status', undefined)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        !filters.status
                          ? 'bg-[#57068c] text-white'
                          : 'bg-white text-gray-700 border border-gray-300'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => handleFilterChange('status', 'clear')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        filters.status === 'clear'
                          ? 'bg-[#57068c] text-white'
                          : 'bg-white text-gray-700 border border-gray-300'
                      }`}
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => handleFilterChange('status', 'one_strike')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        filters.status === 'one_strike'
                          ? 'bg-[#57068c] text-white'
                          : 'bg-white text-gray-700 border border-gray-300'
                      }`}
                    >
                      1 Strike
                    </button>
                    <button
                      onClick={() => handleFilterChange('status', 'blocked')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        filters.status === 'blocked'
                          ? 'bg-[#57068c] text-white'
                          : 'bg-white text-gray-700 border border-gray-300'
                      }`}
                    >
                      Blocked
                    </button>
                  </div>
                </div>

                {/* Cohort Input */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Cohort</label>
                  <Input
                    placeholder="Filter by cohort..."
                    value={filters.cohort || ''}
                    onChange={(e) => handleFilterChange('cohort', e.target.value || undefined)}
                    className="w-full px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Desktop: Original Grid Layout */}
          <div className="hidden lg:grid grid-cols-4 gap-2">
            <div className="w-full">
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Search</label>
              <Input
                placeholder="Search by name or email..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="px-2 py-1 text-[10px] h-7"
              />
            </div>

            <div className="w-full">
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Campus</label>
              <Select
                options={[
                  { value: '', label: 'All Campuses' },
                  { value: 'NYC', label: 'NYC' },
                  { value: 'Shanghai', label: 'Shanghai' },
                ]}
                value={filters.campus || ''}
                onChange={(e) =>
                  handleFilterChange('campus', e.target.value || undefined)
                }
                className="px-2 py-1 text-[10px] h-7"
              />
            </div>

            <div className="w-full">
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Status</label>
              <Select
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'clear', label: 'Clear' },
                  { value: 'one_strike', label: '1 Strike' },
                  { value: 'blocked', label: 'Blocked' },
                ]}
                value={filters.status || ''}
                onChange={(e) =>
                  handleFilterChange('status', e.target.value || undefined)
                }
                className="px-2 py-1 text-[10px] h-7"
              />
            </div>

            <div className="w-full">
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Cohort</label>
              <Input
                placeholder="Filter by cohort..."
                value={filters.cohort || ''}
                onChange={(e) => handleFilterChange('cohort', e.target.value || undefined)}
                className="px-2 py-1 text-[10px] h-7"
                title="Currently showing students from the active semester cohort. You can change this to view other cohorts."
              />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 sm:p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* In-app import result */}
        {importSummary && (
          <div className="mb-4 rounded-md bg-green-50 border border-green-200 p-3 sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-green-800">
                  Google Sheet import completed for {importSummary.semester}
                </p>
                <p className="text-sm text-green-700 mt-1">
                  Created: {importSummary.created} | Updated: {importSummary.updated} | Skipped: {importSummary.skipped}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportSummary(null)}
                className="text-xs sm:text-sm text-green-800 hover:text-green-900 underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Inline loading indicator for refetches */}
        {loading && hasLoadedOnce.current && (
          <div className="flex justify-center py-4">
            <Spinner size="sm" className="text-[#57068c]" />
          </div>
        )}

        {/* Students List */}
        {!loading && students.length === 0 ? (
              <Card>
                <div className="py-8 sm:py-12 text-center">
                  <p className="text-gray-600">No students found</p>
                  {isAdmin && (
                    <Button
                      onClick={handleCreateStudent}
                      variant="primary"
                      className="mt-4"
                    >
                      Add First Student
                    </Button>
                  )}
                </div>
              </Card>
            ) : !loading ? (
              <div className="max-h-[calc(100vh-180px)] sm:max-h-[calc(100vh-200px)] overflow-y-auto">
                {editMode && students.length > 0 && (
                  <div className="mb-2 p-2 bg-gray-50 border border-gray-200 rounded-md flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedStudents.size === students.length}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">
                        Select All ({selectedStudents.size} selected)
                      </span>
                    </label>
                  </div>
                )}
                <div className="space-y-1 sm:space-y-1.5 pb-2">
                  {students.map((student, index) => (
                    <Card
                      key={student.id}
                      className={`transition-shadow hover:shadow-lg active:shadow-md last:mb-0 py-2 sm:py-2 ${
                        editMode ? '' : 'cursor-pointer'
                      } ${selectedStudents.has(student.id) ? 'ring-2 ring-purple-500 bg-purple-50' : ''}`}
                      onClick={() => handleViewStudent(student.id)}
                    >
                      <div className="flex items-center justify-between space-x-2 sm:space-x-2.5">
                        <div className="flex items-center space-x-2 sm:space-x-2.5 flex-1 min-w-0">
                          {/* Checkbox (Edit Mode) */}
                          {editMode && (
                            <div className="flex-shrink-0">
                              <input
                                type="checkbox"
                                checked={selectedStudents.has(student.id)}
                                onChange={() => handleToggleSelect(student.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                              />
                            </div>
                          )}
                          {/* Number */}
                          <div className="flex-shrink-0 w-8 sm:w-10 text-center text-xs sm:text-sm font-semibold text-gray-500">
                            {index + 1}
                          </div>
                          
                          {/* Photo */}
                          <div className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 overflow-hidden rounded-full bg-gray-200">
                            {student.photoUrl ? (
                              <img
                                src={
                                  student.photoUrl.startsWith('http')
                                    ? student.photoUrl
                                    : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${student.photoUrl}`
                                }
                                alt={student.fullName}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    const fallback = document.createElement('div');
                                    fallback.className = 'flex h-full w-full items-center justify-center text-base sm:text-lg font-semibold text-gray-400';
                                    fallback.textContent = student.fullName.charAt(0).toUpperCase();
                                    parent.appendChild(fallback);
                                  }
                                }}
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-base sm:text-lg font-semibold text-gray-400">
                                {student.fullName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                                {student.fullName}
                                {student.preferredName && student.preferredName !== student.fullName && (
                                  <span className="text-gray-500 font-normal ml-1">({student.preferredName})</span>
                                )}
                              </h3>
                              <StatusBadge status={student.status} size="sm" />
                            </div>
                            <p className="text-[10px] sm:text-xs text-gray-600 truncate mt-0.5">{student.nyuEmail}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] sm:text-xs text-gray-500">
                              <span>{student.campus}</span>
                              <span>Strikes: {student.strikeCount}/2</span>
                            </div>
                          </div>
                        </div>

                        {/* Cohort Info and Delete Button - Right Side */}
                        <div className="flex-shrink-0 flex items-center gap-1.5">
                          {editMode ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteStudent(student.id);
                              }}
                              disabled={deleting === student.id}
                              className="p-1.5 rounded-md bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                              title="Delete Student"
                            >
                              {deleting === student.id ? (
                                <Spinner size="sm" />
                              ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          ) : (
                            <>
                              {student.cohort ? (
                                (() => {
                                  const cohorts = student.cohort.includes(',') 
                                    ? student.cohort.split(',').map(c => c.trim()).filter(c => c)
                                    : [student.cohort];
                                  return (
                                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                      {cohorts.map((cohort, idx) => (
                                        <span
                                          key={idx}
                                          className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-blue-100 text-blue-700"
                                        >
                                          {cohort}
                                        </span>
                                      ))}
                                    </div>
                                  );
                                })()
                              ) : viewingSemester ? (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-gray-100 text-gray-500">
                                  {viewingSemester}
                                </span>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ) : null}

        {/* Undo Delete Notification */}
        {pendingDeletions && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
            <div className="bg-white border border-gray-300 rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 min-w-[300px] max-w-md">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {pendingDeletions.students.length === 1 
                    ? `${pendingDeletions.students[0].fullName} deleted`
                    : `${pendingDeletions.students.length} students deleted`}
                </p>
                <p className="text-xs text-gray-500">
                  Undo available for {undoTimeLeft}s
                </p>
              </div>
              <Button
                onClick={handleUndoDelete}
                variant="primary"
                size="sm"
                className="text-xs"
              >
                Undo
              </Button>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setDeleteTarget(null);
          }}
          size="sm"
          footer={
            <div className="flex gap-2 justify-center items-center w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteTarget(null);
                }}
                disabled={deleting !== null || bulkDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={confirmDelete}
                isLoading={deleting !== null || bulkDeleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </Button>
            </div>
          }
        >
          <p className="text-gray-700 text-center">
            {deleteTarget?.type === 'bulk' 
              ? `Delete ${deleteTarget.count} student(s)?`
              : 'Delete this student?'}
          </p>
        </Modal>
      </PageLayout>
    </ProtectedRoute>
  );
}
