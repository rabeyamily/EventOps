'use client';

import { useState, useEffect, useCallback, startTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PageLayout from '@/components/layout/PageLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import FullScreenLoading from '@/components/FullScreenLoading';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Spinner, Input, Select, Modal } from '@/components/ui';
import { getEventById, updateEvent, deleteEvent, lockEvent, unlockEvent } from '@/lib/api/events';
import {
  getEventAssignments,
  assignStudent,
  removeAssignment,
  clearAssignments,
  AssignmentWithStudent,
  AssignmentSummary,
} from '@/lib/api/event-assignments';
import { getEventAttendance, AttendanceWithDetails } from '@/lib/api/attendance';
import { getStudents } from '@/lib/api/students';
import { Event, Student } from '@/types';
import { useIsAdmin } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/lib/utils';
import { formatEventTeamLeadNames } from '@/lib/event-team-leaders';

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const isAdmin = useIsAdmin();

  // Event state
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Assignments state
  const [assignments, setAssignments] = useState<AssignmentWithStudent[]>([]);
  const [summary, setSummary] = useState<AssignmentSummary | null>(null);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const debouncedAssignmentSearch = useDebounce(assignmentSearch, 500);

  // Add student modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [filterCampus, setFilterCampus] = useState('');
  const debouncedStudentSearch = useDebounce(studentSearch, 500);

  // Lock modal state
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockReason, setLockReason] = useState('');
  const [lockLoading, setLockLoading] = useState(false);

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [unlockConfirmationModal, setUnlockConfirmationModal] = useState(false);
  
  // Remove student confirmation modal state
  const [showRemoveStudentModal, setShowRemoveStudentModal] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState<{ id: string; name: string } | null>(null);
  
  // Clear all confirmation modal state
  const [showClearAllModal, setShowClearAllModal] = useState(false);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch event details
  const fetchEvent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEventById(eventId);
      setEvent(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch event');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  // Fetch assignments
  const fetchAssignments = useCallback(async (forceRefresh: boolean = false) => {
    setAssignmentsLoading(true);
    try {
      console.log('Fetching assignments...', { eventId, forceRefresh });
      
      // Get all attendance records (not filtered by sheet) to show all assigned students
      const attendanceData = await getEventAttendance(eventId, undefined, undefined, false);
      console.log('Fetched attendance data:', { 
        attendancesCount: attendanceData.attendances?.length,
        summary: attendanceData.summary,
      });
      
      // Convert attendance records to assignment format
      const assignmentsList: AssignmentWithStudent[] = attendanceData.attendances.map((att: AttendanceWithDetails) => ({
        id: att.id,
        eventId: att.eventId,
        studentId: att.studentId,
        status: att.status,
        markedByStaffId: att.markedByStaffId,
        markedAt: att.markedAt,
        notes: att.notes,
        isHandOffMode: (att as any).isHandOffMode || false,
        createdAt: (att as any).createdAt || att.markedAt,
        updatedAt: (att as any).updatedAt || att.markedAt,
        student: att.student,
      } as AssignmentWithStudent));
      
      // Filter by search if provided
      const filteredAssignments = debouncedAssignmentSearch
        ? assignmentsList.filter(a => 
            a.student?.fullName?.toLowerCase().includes(debouncedAssignmentSearch.toLowerCase()) ||
            a.student?.nyuEmail?.toLowerCase().includes(debouncedAssignmentSearch.toLowerCase())
          )
        : assignmentsList;
      
      setAssignments(filteredAssignments);
      setSummary({
        total: attendanceData.summary.total,
        present: attendanceData.summary.present,
        absent: attendanceData.summary.absent,
        notMarked: attendanceData.summary.notMarked,
      });
      console.log('Set assignments state:', { count: filteredAssignments.length });
    } catch (err: any) {
      console.error('Failed to fetch assignments:', err);
      setAssignments([]);
      setSummary(null);
    } finally {
      setAssignmentsLoading(false);
    }
  }, [eventId, debouncedAssignmentSearch]);

  // Fetch all students
  const fetchAllStudents = useCallback(async () => {
    setStudentsLoading(true);
    try {
      const data = await getStudents({
        search: debouncedStudentSearch || undefined,
        campus: (filterCampus as 'NYC' | 'Shanghai') || undefined,
        limit: 1000, // Get all students
      });
      setAllStudents(data?.data || []);
    } catch (err: any) {
      console.error('Failed to fetch students:', err);
      setAllStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  }, [debouncedStudentSearch, filterCampus]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  useEffect(() => {
    if (event) {
      fetchAssignments();
    }
  }, [event, fetchAssignments]);

  useEffect(() => {
    if (showAddModal) {
      // Fetch both students and assignments when modal opens to ensure accurate state
      fetchAllStudents();
      fetchAssignments(true); // Force refresh
    }
    // Don't refresh when modal closes - let the handleAssignStudent handle it
  }, [showAddModal, fetchAllStudents, fetchAssignments]);

  // Event actions
  const handleLock = async () => {
    if (!event) return;
    setLockLoading(true);
    try {
      await lockEvent(event.id, lockReason || undefined);
      await fetchEvent();
      setShowLockModal(false);
      setLockReason('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLockLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!event) return;
    setActionLoading(true);
    try {
      await unlockEvent(event.id);
      await fetchEvent();
      setUnlockConfirmationModal(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    setActionLoading(true);
    try {
      await deleteEvent(event.id);
      router.push('/events');
    } catch (err: any) {
      setError(err.message);
      setActionLoading(false);
    }
  };

  // Assignment actions
  const handleAssignStudent = async (studentId: string) => {
    try {
      // Check if already assigned using current assignments state
      const isAssigned = assignments.some(a => a.student?.id === studentId);
      
      // Store original state for rollback
      const originalAssignments = [...assignments];
      
      // Optimistically update UI immediately
      if (isAssigned) {
        // Optimistically remove from assignments
        setAssignments(prev => prev.filter(a => a.student?.id !== studentId));
        await removeAssignment(eventId, studentId);
      } else {
        // Find the student in allStudents to add optimistically
        const studentToAdd = allStudents.find(s => s.id === studentId);
        if (studentToAdd) {
          // Optimistically add to assignments
          const tempId = `temp-${Date.now()}-${Math.random()}`;
          const newAssignment: AssignmentWithStudent = {
            id: tempId,
            eventId,
            studentId,
            status: 'not_marked',
            markedByStaffId: '',
            markedAt: new Date().toISOString(),
            isHandOffMode: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            student: studentToAdd,
          };
          setAssignments(prev => [...prev, newAssignment]);
        }
        await assignStudent(eventId, studentId);
      }
      
      // Refresh in background using startTransition to mark as non-urgent
      // This prevents the "shake" by not blocking the UI update
      startTransition(() => {
        fetchAssignments(true).catch(() => {
          // If refresh fails, revert to original state
          setAssignments(originalAssignments);
        });
      });
      
    } catch (err: any) {
      // Revert optimistic update on error
      await fetchAssignments(true);
      
      // Extract error message from various possible formats
      let errorMessage = 'Failed to assign student';
      if (err?.message) {
        errorMessage = err.message;
      } else if (err?.response?.data?.error?.message) {
        errorMessage = err.response.data.error.message;
      } else if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err?.response?.data?.error) {
        errorMessage = err.response.data.error;
      }
      alert(errorMessage);
      console.error('Error assigning student:', err);
    }
  };

  const handleRemoveAssignment = async (studentId: string, skipConfirm: boolean = false) => {
    if (skipConfirm) {
      // Direct removal (from toggle button)
      try {
        await removeAssignment(eventId, studentId);
        await fetchAssignments();
        await fetchAllStudents(); // Refresh the list
      } catch (err: any) {
        alert(err.message || 'Failed to remove student');
      }
    } else {
      // Show confirmation modal
      const student = assignments.find(a => a.student?.id === studentId)?.student;
      if (student) {
        setStudentToRemove({ id: studentId, name: student.fullName });
        setShowRemoveStudentModal(true);
      }
    }
  };

  const confirmRemoveStudent = async () => {
    if (!studentToRemove) return;
    try {
      await removeAssignment(eventId, studentToRemove.id);
      await fetchAssignments();
      await fetchAllStudents(); // Refresh the list
      setShowRemoveStudentModal(false);
      setStudentToRemove(null);
    } catch (err: any) {
      alert(err.message || 'Failed to remove student');
    }
  };


  const handleClearAssignments = () => {
    // Open confirmation modal instead of browser confirm
    setShowClearAllModal(true);
  };

  const confirmClearAll = async () => {
    try {
      const result = await clearAssignments(eventId);
      alert(`Removed ${result.removed} assignments`);
      await fetchAssignments();
      await fetchAllStudents(); // Refresh student list in modal
      setShowClearAllModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to clear assignments');
    }
  };


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge variant="success" size="sm">Present</Badge>;
      case 'absent':
        return <Badge variant="danger" size="sm">Absent</Badge>;
      default:
        return <Badge variant="default" size="sm">Not Marked</Badge>;
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <FullScreenLoading />
      </ProtectedRoute>
    );
  }

  if (error || !event) {
    return (
      <ProtectedRoute>
        <PageLayout title="Error">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-red-600 mb-4">{error || 'Event not found'}</p>
              <Button onClick={() => router.push('/events')}>Back to Events</Button>
            </CardContent>
          </Card>
        </PageLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <PageLayout
        title={event.name}
        actions={
          <div className="flex items-center space-x-2">
            <button
              onClick={() => router.push('/events')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to Events"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 18L9 12L15 6" stroke="#57068c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <Link href={`/events/${event.id}/attendance`}>
              <Button variant="primary" size="sm">
                📋 Take Attendance
              </Button>
            </Link>
            <Link href={`/events/${event.id}/summary`}>
              <Button variant="outline" size="sm">
                📊 Event Summary
              </Button>
            </Link>
            {isAdmin && (
              <>
                {event.isLocked ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setUnlockConfirmationModal(true)}
                    disabled={actionLoading}
                  >
                    🔓 Unlock
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLockModal(true)}
                    disabled={actionLoading}
                  >
                    🔒 Lock
                  </Button>
                )}
                <Link href={`/events/${event.id}/edit`}>
                  <Button variant="outline" size="sm" disabled={event.isLocked}>Edit</Button>
                </Link>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowDeleteModal(true)}
                  disabled={actionLoading || event.isLocked}
                >
                  Delete
                </Button>
              </>
            )}
          </div>
        }
      >
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Event Details */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Event Details</CardTitle>
                  <div className="flex space-x-2">
                    {event.isLocked && <Badge variant="warning">Locked</Badge>}
                    {event.departedAt && <Badge variant="success">Departed</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Date</label>
                  <p className="text-gray-900">{formatDate(event.startDate)}</p>
                </div>
                {event.startTime && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Time</label>
                    <p className="text-gray-900">
                      {event.startTime}
                      {event.endTime && ` - ${event.endTime}`}
                    </p>
                  </div>
                )}
                {event.location && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Location</label>
                    <p className="text-gray-900">{event.location}</p>
                  </div>
                )}
                {formatEventTeamLeadNames(event) && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Team leaders</label>
                    <p className="text-gray-900">{formatEventTeamLeadNames(event)}</p>
                  </div>
                )}
                {event.notes && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Notes</label>
                    <p className="text-gray-900 whitespace-pre-wrap">{event.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lock Status Card */}
            {event.isLocked && (
              <Card className="border-yellow-300 bg-yellow-50">
                <CardHeader>
                  <CardTitle className="text-yellow-800 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Event Locked
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {event.lockedBy && (
                    <p className="text-yellow-700">
                      <span className="font-medium">Locked by:</span> {event.lockedBy.fullName}
                    </p>
                  )}
                  {event.lockedAt && (
                    <p className="text-yellow-700">
                      <span className="font-medium">Locked at:</span> {formatDate(event.lockedAt)}
                    </p>
                  )}
                  {event.lockReason && (
                    <p className="text-yellow-700">
                      <span className="font-medium">Reason:</span> {event.lockReason}
                    </p>
                  )}
                  <p className="text-yellow-600 text-xs mt-2">
                    This event is locked. Assignments and attendance cannot be modified.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Attendance Summary */}
            {summary && (
              <Card>
                <CardHeader>
                  <CardTitle>Attendance Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
                      <p className="text-sm text-gray-500">Total</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{summary.present}</p>
                      <p className="text-sm text-gray-500">Present</p>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <p className="text-2xl font-bold text-red-600">{summary.absent}</p>
                      <p className="text-sm text-gray-500">Absent</p>
                    </div>
                    <div className="text-center p-3 bg-yellow-50 rounded-lg">
                      <p className="text-2xl font-bold text-yellow-600">{summary.notMarked}</p>
                      <p className="text-sm text-gray-500">Not Marked</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Assigned Students */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Assigned Students ({summary?.total || 0})</CardTitle>
                  {isAdmin && !event.isLocked && (
                    <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
                      Add Student
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Search */}
                <div className="mb-4">
                  <Input
                    placeholder="Search assigned students..."
                    value={assignmentSearch}
                    onChange={(e) => setAssignmentSearch(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                {/* Students list */}
                {assignmentsLoading ? (
                  <div className="flex justify-center py-8">
                    <Spinner />
                  </div>
                ) : !assignments || assignments.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No students assigned yet.
                    {isAdmin && !event.isLocked && ' Click "Add Student" to add students.'}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            {assignment.student.photoUrl ? (
                              <img
                                src={assignment.student.photoUrl}
                                alt=""
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-sm font-medium text-gray-500">
                                {assignment.student.fullName.charAt(0)}
                              </span>
                            )}
                          </div>
                          <div>
                            <Link href={`/students/${assignment.student.id}`}>
                              <p className="font-medium text-gray-900 hover:text-primary-600">
                                {assignment.student.fullName}
                              </p>
                            </Link>
                            <p className="text-sm text-gray-500">
                              {assignment.student.campus} • {assignment.student.nyuEmail}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          {getStatusBadge(assignment.status)}
                          {isAdmin && !event.isLocked && assignment.status === 'not_marked' && (
                            <button
                              onClick={() => handleRemoveAssignment(assignment.student.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Remove"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Clear all assignments button */}
                {isAdmin && !event.isLocked && assignments.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearAssignments}
                      className="text-red-600 hover:text-red-700"
                    >
                      Clear All
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Add Student Modal */}
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add Student to Event"
        >
          <div className="space-y-4">
            <div className="flex space-x-2">
              <Input
                placeholder="Search students..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="flex-1 h-8 text-sm"
              />
              <Select
                value={filterCampus}
                onChange={(e) => setFilterCampus(e.target.value)}
                options={[
                  { value: '', label: 'All Campuses' },
                  { value: 'NYC', label: 'NYC' },
                  { value: 'Shanghai', label: 'Shanghai' },
                ]}
              />
            </div>

            {studentsLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : !allStudents || allStudents.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No students found.
              </p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {allStudents.map((student) => {
                  // Check if student is already assigned - use optional chaining for safety
                  const isAssigned = assignments.some(a => a.student?.id === student.id);
                  return (
                  <div
                    key={student.id}
                    className="flex items-center justify-between py-1.5 px-2 border border-gray-200 rounded hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <div className="text-sm">
                        <p className="font-medium text-gray-900 truncate">{student.fullName}</p>
                        <p className="text-xs text-gray-500 truncate">{student.nyuEmail}</p>
                      </div>
                    </div>
                    <Button
                      variant={isAssigned ? "primary" : "outline"}
                      size="sm"
                      onClick={() => handleAssignStudent(student.id)}
                      disabled={studentsLoading || assignmentsLoading}
                      className={isAssigned ? "bg-[#57068c] hover:bg-[#4a0570] text-white border-[#57068c] min-w-[70px]" : "min-w-[70px]"}
                    >
                      {isAssigned ? 'Added' : 'Add'}
                    </Button>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>

        {/* Lock Event Modal */}
        <Modal
          isOpen={showLockModal}
          onClose={() => setShowLockModal(false)}
          title="Lock Event"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Locking this event will prevent any modifications to:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>Event details</li>
              <li>Student assignments</li>
              <li>Attendance records (already marked will remain)</li>
            </ul>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for locking (optional)
              </label>
              <Input
                placeholder="e.g., Event completed, Attendance finalized..."
                value={lockReason}
                onChange={(e) => setLockReason(e.target.value)}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowLockModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleLock}
                disabled={lockLoading}
                isLoading={lockLoading}
              >
                🔒 Lock Event
              </Button>
            </div>
          </div>
        </Modal>

        {/* Remove Student Confirmation Modal */}
        <Modal
          isOpen={showRemoveStudentModal}
          onClose={() => {
            setShowRemoveStudentModal(false);
            setStudentToRemove(null);
          }}
          title=""
          size="sm"
          showCloseButton={false}
        >
          <div className="space-y-4 py-2 px-1">
            <p className="text-base text-gray-700 text-center">
              Remove <span className="font-semibold text-gray-900">{studentToRemove?.name}</span> from this event?
            </p>
            <div className="flex justify-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setShowRemoveStudentModal(false);
                  setStudentToRemove(null);
                }}
                className="px-4 py-1.5 text-xs"
              >
                Cancel
              </Button>
              <Button 
                variant="primary" 
                size="sm"
                onClick={confirmRemoveStudent}
                className="px-4 py-1.5 text-xs bg-[#57068c] hover:bg-[#4a0570] text-white border-[#57068c]"
              >
                Remove
              </Button>
            </div>
          </div>
        </Modal>

        {/* Clear All Confirmation Modal */}
        <Modal
          isOpen={showClearAllModal}
          onClose={() => setShowClearAllModal(false)}
          title=""
          size="sm"
          showCloseButton={false}
        >
          <div className="space-y-4 py-2 px-1">
            <p className="text-base text-gray-700 text-center">
              Remove all students from this event?
            </p>
            <div className="flex justify-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowClearAllModal(false)}
                className="px-4 py-1.5 text-xs"
              >
                Cancel
              </Button>
              <Button 
                variant="danger" 
                size="sm"
                onClick={confirmClearAll}
                className="px-4 py-1.5 text-xs"
              >
                Clear All
              </Button>
            </div>
          </div>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Delete Event"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to delete this event? This action cannot be undone.
            </p>
            {event && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">{event.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDate(event.startDate)}
                </p>
              </div>
            )}
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={actionLoading}
                isLoading={actionLoading}
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>

        {/* Unlock Confirmation Modal */}
        <Modal
          isOpen={unlockConfirmationModal}
          onClose={() => setUnlockConfirmationModal(false)}
          title="Unlock Event"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to unlock this event? This will allow modifications.
            </p>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setUnlockConfirmationModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleUnlock}
                disabled={actionLoading}
                isLoading={actionLoading}
              >
                Unlock
              </Button>
            </div>
          </div>
        </Modal>
      </PageLayout>
    </ProtectedRoute>
  );
}

