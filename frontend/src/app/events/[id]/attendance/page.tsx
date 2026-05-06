'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PageLayout from '@/components/layout/PageLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import FullScreenLoading from '@/components/FullScreenLoading';
import { Button, Card, Input, Spinner, Badge, Modal } from '@/components/ui';
import { getEventById } from '@/lib/api/events';
import { getEventAttendance, quickTapAttendance, markAttendance, markAllAbsent, updateAttendanceNotes, AttendanceWithDetails, AttendanceSummary } from '@/lib/api/attendance';
import { getEventAssignments } from '@/lib/api/event-assignments';
import { createAttendanceSheet, getEventAttendanceSheets, getActiveAttendanceSheet, setActiveAttendanceSheet, addBus, deleteBus, deleteSheet, AttendanceSheet } from '@/lib/api/attendance-sheets';
import { Event, Student } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate, formatTime } from '@/lib/utils';
import { Select } from '@/components/ui';

type AttendanceStatus = 'present' | 'absent' | 'not_marked';

interface StudentAttendanceItem {
  student: Student;
  attendance?: AttendanceWithDetails;
}

export default function AttendancePage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [students, setStudents] = useState<StudentAttendanceItem[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>({ total: 0, present: 0, absent: 0, notMarked: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | AttendanceStatus>('all');
  const [isHandOffMode, setIsHandOffMode] = useState(false);
  const [showConfirmAbsent, setShowConfirmAbsent] = useState(false);
  const [processingStudent, setProcessingStudent] = useState<string | null>(null);
  
  // Notes modal state
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentAttendanceItem | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Attendance sheets state
  const [attendanceSheets, setAttendanceSheets] = useState<AttendanceSheet[]>([]);
  const [activeSheet, setActiveSheet] = useState<AttendanceSheet | null>(null);
  const [showCreateSheetModal, setShowCreateSheetModal] = useState(false);
  const [newSheetName, setNewSheetName] = useState('');
  const [selectedBusForNewSheet, setSelectedBusForNewSheet] = useState('');
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [addingBus, setAddingBus] = useState(false);
  const [switchingSheet, setSwitchingSheet] = useState<string | null>(null);
  const [previousSheetAttendances, setPreviousSheetAttendances] = useState<
    Map<string, { busNumber: string; sheetName: string; status: AttendanceStatus }>
  >(new Map());
  const [showDeleteBusModal, setShowDeleteBusModal] = useState(false);
  const [busToDelete, setBusToDelete] = useState<string | null>(null);
  const [deletingBus, setDeletingBus] = useState(false);
  const [showDeleteSheetModal, setShowDeleteSheetModal] = useState(false);
  const [sheetToDelete, setSheetToDelete] = useState<AttendanceSheet | null>(null);
  const [deletingSheet, setDeletingSheet] = useState(false);

  // Mark absent with note modal
  const [showAbsentNoteModal, setShowAbsentNoteModal] = useState(false);
  const [absentNoteStudentId, setAbsentNoteStudentId] = useState<string | null>(null);
  const [absentNoteStudentName, setAbsentNoteStudentName] = useState('');
  const [absentNoteText, setAbsentNoteText] = useState('');
  const [markingAbsent, setMarkingAbsent] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [eventData, sheetsData, activeSheetData] = await Promise.all([
        getEventById(eventId),
        getEventAttendanceSheets(eventId).catch(() => []),
        getActiveAttendanceSheet(eventId).catch(() => null),
      ]);

      // Get attendance for active sheet (if exists) or all attendance
      const attendanceData = await getEventAttendance(
        eventId,
        undefined,
        activeSheetData?.id,
        true // Filter by sheet for attendance page
      );

      setEvent(eventData);
      setSummary(attendanceData.summary);
      setAttendanceSheets(sheetsData);
      setActiveSheet(activeSheetData);

      // Get all assigned students (not just those with attendance records)
      let assignmentsData;
      try {
        console.log('🔍 Calling getEventAssignments for event:', eventId);
        assignmentsData = await getEventAssignments(eventId, { limit: 10000 });
        console.log('✅ Fetched assignments response:', assignmentsData);
        console.log('✅ Assignments data array:', assignmentsData.data);
        console.log('✅ Number of assignments:', assignmentsData.data?.length || 0);
        if (!assignmentsData.data || assignmentsData.data.length === 0) {
          console.warn('⚠️ WARNING: getEventAssignments returned empty data array!');
        }
      } catch (err: any) {
        console.error('❌ Error fetching assignments:', err);
        console.error('❌ Error details:', err.message, err.stack);
        assignmentsData = { data: [], pagination: { total: 0 }, summary: { total: 0, present: 0, absent: 0, notMarked: 0 } };
      }

      // Build student list with attendance info
      const studentMap = new Map<string, StudentAttendanceItem>();

      // First, add all assigned students
      const assignmentsList = assignmentsData.data || [];
      console.log('📊 Assignments list length:', assignmentsList.length);
      assignmentsList.forEach((assignment) => {
        if (assignment.student) {
          studentMap.set(assignment.student.id, {
            student: assignment.student,
            attendance: undefined, // Will be updated if attendance exists for active sheet
          });
        }
      });
      console.log('📊 Students from assignments:', studentMap.size);

      // Then, update with attendance records for active sheet
      attendanceData.attendances.forEach((att) => {
        if (att.student) {
          studentMap.set(att.student.id, {
            student: att.student,
            attendance: att,
          });
        }
      });

      // Get all attendances from previous sheets to detect bus changes.
      // We also keep the *status* from the previous sheet so we can show
      // "Absent on Bus X" vs just a generic "Previously on Bus X" badge.
      const previousAttendancesMap = new Map<string, { busNumber: string; sheetName: string; status: AttendanceStatus }>();
      const statusPriority = (s: AttendanceStatus) => (s === 'absent' ? 3 : s === 'present' ? 2 : 1);
      if (activeSheetData && sheetsData.length > 1) {
        // Get all other sheets' attendances
        const otherSheets = sheetsData.filter(s => s.id !== activeSheetData.id);
        const allSheetsData = await Promise.all(
          otherSheets.map(sheet => getEventAttendance(eventId, undefined, sheet.id, true).catch(() => ({ attendances: [], summary: { total: 0, present: 0, absent: 0, notMarked: 0 } })))
        );

        allSheetsData.forEach((sheetData, index) => {
          const sheet = otherSheets[index];
          if (sheet) {
            sheetData.attendances.forEach((att: any) => {
              if (att.student && att.attendanceSheet) {
                const studentId = att.student.id;
                const newStatus = att.status as AttendanceStatus;
                const existing = previousAttendancesMap.get(studentId);

                // Prefer the "strongest" status from other buses (Absent > Present > Not Marked).
                if (!existing || statusPriority(newStatus) > statusPriority(existing.status)) {
                  previousAttendancesMap.set(studentId, {
                    busNumber: att.attendanceSheet.busNumber,
                    sheetName: att.attendanceSheet.name,
                    status: newStatus,
                  });
                }
              }
            });
          }
        });
      }
      setPreviousSheetAttendances(previousAttendancesMap);

      const finalStudentsList = Array.from(studentMap.values());
      setStudents(finalStudentsList);
      console.log('✅ Final students list set:', finalStudentsList.length, 'students');
      if (finalStudentsList.length === 0) {
        console.warn('⚠️ WARNING: No students found! Check:');
        console.warn('  - Are students assigned to this event?');
        console.warn('  - Did getEventAssignments return data?', assignmentsList.length);
        console.warn('  - Did attendanceData have students?', attendanceData.attendances?.length || 0);
      }
    } catch (err: any) {
      console.error('❌ Error in fetchData:', err);
      setError(err.message || 'Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Scroll to attendance section when active sheet changes
  useEffect(() => {
    if (activeSheet) {
      // Wait for DOM to update - use multiple attempts to ensure it works
      const attemptScroll = (attempts = 0) => {
        const attendanceSection = document.getElementById('attendance-section');
        if (attendanceSection) {
          attendanceSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (attempts < 5) {
          // Retry if element not found yet
          setTimeout(() => attemptScroll(attempts + 1), 100);
        }
      };
      
      const timer = setTimeout(() => attemptScroll(), 100);
      return () => clearTimeout(timer);
    }
  }, [activeSheet]);

  const handleTap = async (studentId: string) => {
    if (event?.isLocked) return;

    setProcessingStudent(studentId);
    try {
      const updated = await quickTapAttendance(eventId, studentId, isHandOffMode);

      // Update local state
      setStudents((prev) =>
        prev.map((item) =>
          item.student.id === studentId
            ? { ...item, attendance: updated }
            : item
        )
      );

      // Update summary
      const newStatus = updated.status;
      setSummary((prev) => {
        const oldItem = students.find((s) => s.student.id === studentId);
        const oldStatus = oldItem?.attendance?.status || 'not_marked';

        const decrement = (status: string) => (status === oldStatus ? 1 : 0);
        const increment = (status: string) => (status === newStatus ? 1 : 0);

        return {
          ...prev,
          present: prev.present - decrement('present') + increment('present'),
          absent: prev.absent - decrement('absent') + increment('absent'),
          notMarked: prev.notMarked - decrement('not_marked') + increment('not_marked'),
        };
      });
    } catch (err: any) {
      console.error('Failed to mark attendance:', err);
    } finally {
      setProcessingStudent(null);
    }
  };

  const handleMarkAbsent = (studentId: string) => {
    if (event?.isLocked) return;
    const item = students.find(s => s.student.id === studentId);
    setAbsentNoteStudentId(studentId);
    setAbsentNoteStudentName(item?.student.fullName || '');
    setAbsentNoteText('');
    setShowAbsentNoteModal(true);
  };

  const handleConfirmMarkAbsent = async () => {
    if (!absentNoteStudentId || event?.isLocked) return;
    const studentId = absentNoteStudentId;

    setMarkingAbsent(true);
    setProcessingStudent(studentId);
    try {
      const updated = await markAttendance(eventId, studentId, 'absent', {
        notes: absentNoteText.trim() || undefined,
      });

      setStudents((prev) =>
        prev.map((item) =>
          item.student.id === studentId
            ? { ...item, attendance: updated }
            : item
        )
      );

      setSummary((prev) => {
        const oldItem = students.find((s) => s.student.id === studentId);
        const oldStatus = oldItem?.attendance?.status || 'not_marked';

        return {
          ...prev,
          present: prev.present - (oldStatus === 'present' ? 1 : 0),
          absent: prev.absent + 1 - (oldStatus === 'absent' ? 1 : 0),
          notMarked: prev.notMarked - (oldStatus === 'not_marked' ? 1 : 0),
        };
      });

      setShowAbsentNoteModal(false);
    } catch (err: any) {
      console.error('Failed to mark absent:', err);
    } finally {
      setMarkingAbsent(false);
      setProcessingStudent(null);
    }
  };

  const handleMarkAllAbsent = async () => {
    if (event?.isLocked) return;

    try {
      const result = await markAllAbsent(eventId);
      setShowConfirmAbsent(false);
      fetchData(); // Refresh to get updated data
    } catch (err: any) {
      console.error('Failed to mark all absent:', err);
    }
  };

  const openNotesModal = (item: StudentAttendanceItem) => {
    setSelectedStudent(item);
    setNoteText(item.attendance?.notes || '');
    setShowNotesModal(true);
  };

  const handleCreateSheet = async () => {
    if (!newSheetName.trim() || !selectedBusForNewSheet.trim()) {
      setError('Please provide sheet name');
      return;
    }

    setCreatingSheet(true);
    setError(null);
    try {
      const sheet = await createAttendanceSheet(eventId, newSheetName.trim(), selectedBusForNewSheet.trim());
      await setActiveAttendanceSheet(sheet.id);
      setShowCreateSheetModal(false);
      setNewSheetName('');
      setSelectedBusForNewSheet('');
      await fetchData(); // Refresh data
    } catch (err: any) {
      setError(err.message || 'Failed to create attendance sheet');
    } finally {
      setCreatingSheet(false);
    }
  };

  const handleAddBus = async () => {
    setAddingBus(true);
    setError(null);
    try {
      await addBus(eventId);
      await fetchData(); // Refresh data
    } catch (err: any) {
      setError(err.message || 'Failed to add bus');
    } finally {
      setAddingBus(false);
    }
  };

  const handleDeleteBus = async () => {
    if (!busToDelete) return;
    
    setDeletingBus(true);
    try {
      await deleteBus(eventId, busToDelete);
      setShowDeleteBusModal(false);
      setBusToDelete(null);
      // If active sheet was on deleted bus, clear it
      if (activeSheet?.busNumber === busToDelete) {
        setActiveSheet(null);
      }
      await fetchData(); // Refresh data
    } catch (err: any) {
      setError(err.message || 'Failed to delete bus');
    } finally {
      setDeletingBus(false);
    }
  };

  const handleDeleteSheet = async () => {
    if (!sheetToDelete) return;
    
    setDeletingSheet(true);
    try {
      await deleteSheet(sheetToDelete.id);
      setShowDeleteSheetModal(false);
      // If active sheet was deleted, clear it
      if (activeSheet?.id === sheetToDelete.id) {
        setActiveSheet(null);
      }
      setSheetToDelete(null);
      await fetchData(); // Refresh data
    } catch (err: any) {
      setError(err.message || 'Failed to delete attendance sheet');
    } finally {
      setDeletingSheet(false);
    }
  };

  const openAddSheetModal = (busNumber: string) => {
    setSelectedBusForNewSheet(busNumber);
    setNewSheetName('');
    setShowCreateSheetModal(true);
  };

  const handleSwitchSheet = async (sheetId: string) => {
    // Don't switch if already active or already switching
    if (activeSheet?.id === sheetId) {
      // Already active, just scroll to it
      const attendanceSection = document.getElementById('attendance-section');
      if (attendanceSection) {
        attendanceSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    if (switchingSheet === sheetId) {
      return; // Already switching this sheet
    }

    try {
      setError(null);
      setSwitchingSheet(sheetId);
      console.log('Switching to sheet:', sheetId);
      
      const updatedSheet = await setActiveAttendanceSheet(sheetId);
      console.log('Sheet activated:', updatedSheet);
      
      // Update local state immediately so UI updates right away
      console.log('Setting activeSheet to:', updatedSheet);
      setActiveSheet(updatedSheet);
      
      // Also update the sheets list to reflect the active state
      setAttendanceSheets(prev => prev.map(s => ({
        ...s,
        isActive: s.id === sheetId
      })));
      
      // Get attendance data for the newly active sheet
      try {
        console.log('📊 Fetching data for sheet:', updatedSheet.id);
        
        // Fetch all necessary data in parallel
        const [attendanceData, assignmentsResponse, allSheets] = await Promise.all([
          getEventAttendance(eventId, undefined, updatedSheet.id, true),
          getEventAssignments(eventId, { limit: 10000 }).catch((err) => {
            console.error('Error fetching assignments:', err);
            return { data: [], pagination: { total: 0 }, summary: { total: 0, present: 0, absent: 0, notMarked: 0 } };
          }),
          getEventAttendanceSheets(eventId).catch(() => [])
        ]);
        
        console.log('📊 Attendance data:', attendanceData);
        console.log('📊 Assignments response:', assignmentsResponse);
        
        // Update summary
        setSummary(attendanceData.summary || { total: 0, present: 0, absent: 0, notMarked: 0 });
        
        // Extract assignments data correctly
        // getEventAssignments returns AssignmentsResponse with .data property
        const assignmentsList = assignmentsResponse.data || [];
        console.log('📊 Assignments list:', assignmentsList.length, 'assignments');
        console.log('📊 Assignments response structure:', assignmentsResponse);
        
        const studentMap = new Map<string, StudentAttendanceItem>();
        
        // First, add all assigned students
        assignmentsList.forEach((assignment: any) => {
          if (assignment && assignment.student) {
            studentMap.set(assignment.student.id, {
              student: assignment.student,
              attendance: undefined,
            });
          }
        });
        console.log('📊 Students from assignments:', studentMap.size);
        
        // Then, update with attendance records for active sheet
        if (attendanceData.attendances) {
          attendanceData.attendances.forEach((att) => {
            if (att.student) {
              studentMap.set(att.student.id, {
                student: att.student,
                attendance: att,
              });
            }
          });
        }
        console.log('📊 Total students after merging attendance:', studentMap.size);
        
        // Get all attendances from previous sheets to detect bus changes.
        // Store status too so the UI can show "Absent on Bus X" (from other buses)
        // without affecting the current bus' status badge.
        const previousAttendancesMap = new Map<string, { busNumber: string; sheetName: string; status: AttendanceStatus }>();
        const statusPriority = (s: AttendanceStatus) => (s === 'absent' ? 3 : s === 'present' ? 2 : 1);
        if (allSheets.length > 1) {
          // Get all other sheets' attendances
          const otherSheets = allSheets.filter(s => s.id !== updatedSheet.id);
          const allSheetsData = await Promise.all(
            otherSheets.map(sheet => getEventAttendance(eventId, undefined, sheet.id, true).catch(() => ({ attendances: [], summary: { total: 0, present: 0, absent: 0, notMarked: 0 } })))
          );

          allSheetsData.forEach((sheetData, index) => {
            const sheet = otherSheets[index];
            if (sheet && sheetData.attendances) {
              sheetData.attendances.forEach((att: any) => {
                if (att.student && att.attendanceSheet) {
                  const studentId = att.student.id;
                  const newStatus = att.status as AttendanceStatus;
                  const existing = previousAttendancesMap.get(studentId);

                  if (!existing || statusPriority(newStatus) > statusPriority(existing.status)) {
                    previousAttendancesMap.set(studentId, {
                      busNumber: att.attendanceSheet.busNumber,
                      sheetName: att.attendanceSheet.name,
                      status: newStatus,
                    });
                  }
                }
              });
            }
          });
        }
        setPreviousSheetAttendances(previousAttendancesMap);
        
        // Update students list
        const studentsList = Array.from(studentMap.values());
        setStudents(studentsList);
        console.log('✅ Updated students list:', studentsList.length, 'students');
        if (studentsList.length > 0) {
          console.log('✅ Sample students:', studentsList.slice(0, 3).map(s => s.student.fullName));
        } else {
          console.warn('⚠️ No students found! Check if students are assigned to this event.');
        }
        
        // Ensure event is still set (don't overwrite it)
        if (!event) {
          const eventData = await getEventById(eventId);
          setEvent(eventData);
        }
      } catch (err) {
        console.error('❌ Error fetching attendance data:', err);
        // If this fails, fall back to full fetchData
        await fetchData();
      }
      
      // Force scroll after state update and DOM render
      // Use multiple attempts to ensure the element is rendered
      let attempts = 0;
      const maxAttempts = 15;
      const scrollToAttendance = () => {
        attempts++;
        requestAnimationFrame(() => {
          setTimeout(() => {
            const attendanceSection = document.getElementById('attendance-section');
            if (attendanceSection) {
              console.log('Scrolling to attendance section');
              // Scroll with offset to account for header
              const elementPosition = attendanceSection.getBoundingClientRect().top;
              const offsetPosition = elementPosition + window.pageYOffset - 100; // 100px offset for header
              window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
              });
            } else if (attempts < maxAttempts) {
              // Retry if element not found
              setTimeout(scrollToAttendance, 150);
            } else {
              console.warn('Could not find attendance section after', maxAttempts, 'attempts');
            }
          }, 200);
        });
      };
      
      // Start scrolling after a short delay to allow React to render
      setTimeout(scrollToAttendance, 100);
    } catch (err: any) {
      console.error('Error switching sheet:', err);
      setError(err.message || 'Failed to switch attendance sheet');
    } finally {
      setSwitchingSheet(null);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedStudent || event?.isLocked) return;

    setSavingNote(true);
    try {
      const trimmedNotes = noteText.trim();

      // If there is already an attendance record on this active sheet, update notes only.
      if (selectedStudent.attendance?.id) {
        await updateAttendanceNotes(selectedStudent.attendance.id, trimmedNotes);
      } else {
        // If there's no attendance record yet on the active sheet, create one as `not_marked`
        // so we can attach the notes to the correct bus/sheet.
        if (!trimmedNotes) {
          // Nothing to save; avoid creating a pointless attendance record.
          setShowNotesModal(false);
          return;
        }

        const created = await markAttendance(eventId, selectedStudent.student.id, 'not_marked', {
          notes: trimmedNotes,
        });
      
        // Update local state (either add a new attendance record or update the existing one)
        setStudents((prev) =>
          prev.map((item) =>
            item.student.id === selectedStudent.student.id
              ? { ...item, attendance: created }
              : item
          )
        );

        setShowNotesModal(false);
        return;
      }

      // Update local state when updating an existing record
      setStudents((prev) =>
        prev.map((item) =>
          item.student.id === selectedStudent.student.id && item.attendance
            ? { ...item, attendance: { ...item.attendance, notes: trimmedNotes } }
            : item
        )
      );
      
      setShowNotesModal(false);
    } catch (err: any) {
      console.error('Failed to save notes:', err);
    } finally {
      setSavingNote(false);
    }
  };

  // Filter and search students
  const filteredStudents = students.filter((item) => {
    // Search filter
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      if (
        !item.student.fullName.toLowerCase().includes(searchLower) &&
        !item.student.nyuEmail.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }

    // Status filter
    if (filter !== 'all') {
      const status = item.attendance?.status || 'not_marked';
      if (status !== filter) return false;
    }

    return true;
  });

  // Compute summary from the actual students list (not API) - the API only counts
  // existing attendance records, but we display all assigned students. Students
  // without a record are "not_marked".
  const displaySummary = useMemo(() => {
    let present = 0;
    let absent = 0;
    let notMarked = 0;
    students.forEach((item) => {
      const status = item.attendance?.status || 'not_marked';
      if (status === 'present') present++;
      else if (status === 'absent') absent++;
      else notMarked++;
    });
    return {
      total: students.length,
      present,
      absent,
      notMarked,
    };
  }, [students]);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-500';
      case 'absent':
        return 'bg-red-500';
      default:
        return 'bg-gray-300';
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'present':
        return <Badge variant="success">Present</Badge>;
      case 'absent':
        return <Badge variant="danger">Absent</Badge>;
      default:
        return <Badge variant="default">Not Marked</Badge>;
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
        <PageLayout>
          <div className="text-center py-12">
            <p className="text-red-600">{error || 'Event not found'}</p>
            <Button onClick={() => router.back()} className="mt-4">
              Go Back
            </Button>
          </div>
        </PageLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <PageLayout>
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{event.name}</h1>
                <p className="text-gray-600">
                  {formatDate(event.startDate)} {event.startTime && `at ${formatTime(event.startTime)}`}
                </p>
              </div>
              <Link 
                href={`/events/${eventId}`} 
                className="flex items-center gap-1 text-[#57068c] hover:text-[#57068c]/80 transition-colors text-sm font-medium flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Event
              </Link>
            </div>

            {event.isLocked && (
              <div className="mt-2 p-2 bg-yellow-100 border border-yellow-400 rounded text-yellow-800 text-sm">
                🔒 This event is locked. Attendance cannot be modified.
              </div>
            )}

            {/* Bus Management Section */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">Buses & Attendance Sheets</h2>
                <Button
                  onClick={handleAddBus}
                  variant="primary"
                  size="sm"
                  className="flex-shrink-0"
                  style={{ backgroundColor: '#57068c' }}
                  disabled={addingBus}
                  isLoading={addingBus}
                >
                  + Add Bus
                </Button>
              </div>

              {(() => {
                // Group sheets by bus number
                const busesSorted = Array.from(new Set(attendanceSheets.map(s => s.busNumber))).sort((a, b) => {
                  const numA = parseInt(a.replace('Bus ', ''), 10) || 0;
                  const numB = parseInt(b.replace('Bus ', ''), 10) || 0;
                  return numA - numB;
                });

                if (busesSorted.length === 0) {
                  return (
                    <Card className="p-6 text-center">
                      <p className="text-gray-500 mb-4">No buses added yet. Click &ldquo;+ Add Bus&rdquo; to start.</p>
                      <p className="text-xs text-gray-400">
                        Each bus will get &ldquo;Before Departure&rdquo; and &ldquo;Before Return&rdquo; sheets automatically.
                      </p>
                    </Card>
                  );
                }

                return (
                  <div className="space-y-4">
                    {busesSorted.map((busNumber) => {
                      const busSheets = attendanceSheets
                        .filter(s => s.busNumber === busNumber)
                        .sort((a, b) => {
                          // Sort: Before Departure first, Before Return second, then others by creation date
                          if (a.name === 'Before Departure') return -1;
                          if (b.name === 'Before Departure') return 1;
                          if (a.name === 'Before Return') return -1;
                          if (b.name === 'Before Return') return 1;
                          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                        });

                      return (
                        <Card key={busNumber} className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">🚌</span>
                              <h3 className="font-bold text-lg text-[#57068c]">{busNumber}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                onClick={() => openAddSheetModal(busNumber)}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                + Add Sheet
                              </Button>
                              <Button
                                onClick={() => {
                                  setBusToDelete(busNumber);
                                  setShowDeleteBusModal(true);
                                }}
                                variant="ghost"
                                size="sm"
                                className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                🗑️
                              </Button>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {busSheets.map((sheet) => {
                              const isDefault = sheet.name === 'Before Departure' || sheet.name === 'Before Return';
                              
                              return (
                                <div
                                  key={sheet.id}
                                  className={`p-3 rounded-lg border transition-all hover:shadow-sm cursor-pointer ${
                                    sheet.isActive
                                      ? 'border-2 border-[#57068c] bg-purple-50'
                                      : 'border-gray-200 hover:border-purple-300 bg-white'
                                  }`}
                                  onClick={async () => {
                                    if (!sheet.isActive) {
                                      await handleSwitchSheet(sheet.id);
                                    } else {
                                      const attendanceSection = document.getElementById('attendance-section');
                                      if (attendanceSection) {
                                        attendanceSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                      }
                                    }
                                  }}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm">
                                        {sheet.name === 'Before Departure' ? '🚀' : 
                                         sheet.name === 'Before Return' ? '🏠' : '📋'}
                                      </span>
                                      <span className={`font-medium text-sm ${sheet.isActive ? 'text-[#57068c]' : 'text-gray-700'}`}>
                                        {sheet.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {sheet.isActive && (
                                        <Badge variant="success" className="text-[10px] px-1.5 py-0.5">
                                          Active
                                        </Badge>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSheetToDelete(sheet);
                                          setShowDeleteSheetModal(true);
                                        }}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded p-1 transition-colors"
                                        title="Delete sheet"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                  <div className="mt-2">
                                    <Button
                                      variant={sheet.isActive ? 'primary' : 'outline'}
                                      size="sm"
                                      className="w-full text-xs py-1"
                                      style={sheet.isActive ? { backgroundColor: '#57068c' } : {}}
                                      disabled={switchingSheet === sheet.id}
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (!sheet.isActive) {
                                          await handleSwitchSheet(sheet.id);
                                        } else {
                                          const attendanceSection = document.getElementById('attendance-section');
                                          if (attendanceSection) {
                                            attendanceSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                          }
                                        }
                                      }}
                                    >
                                      {switchingSheet === sheet.id ? (
                                        <Spinner size="sm" className="text-current" />
                                      ) : sheet.isActive ? (
                                        '✓ Taking Attendance'
                                      ) : (
                                        'Take Attendance'
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {activeSheet && (
              <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold text-[#57068c]">Active:</span> {activeSheet.busNumber} - {activeSheet.name}
                </p>
              </div>
            )}
          </div>

          {/* Attendance Interface - Only show when a sheet is active */}
          {activeSheet ? (
            <div id="attendance-section" className="mt-6 scroll-mt-20 border-t-2 border-purple-200 pt-6">
              <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm font-semibold text-[#57068c]">
                  📋 Taking Attendance: {activeSheet.busNumber} - {activeSheet.name}
                </p>
              </div>
              {/* Summary Cards - computed from displayed students list */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                <Card className="p-1 text-center">
                  <div className="text-xl font-bold text-gray-900">{displaySummary.total}</div>
                  <div className="text-xs text-gray-600">Total</div>
                </Card>
                <Card className="p-1 text-center bg-green-50 border-green-200">
                  <div className="text-xl font-bold text-green-600">{displaySummary.present}</div>
                  <div className="text-xs text-green-700">Present</div>
                </Card>
                <Card className="p-1 text-center bg-red-50 border-red-200">
                  <div className="text-xl font-bold text-red-600">{displaySummary.absent}</div>
                  <div className="text-xs text-red-700">Absent</div>
                </Card>
                <Card className="p-1 text-center bg-gray-50 border-gray-200">
                  <div className="text-xl font-bold text-gray-600">{displaySummary.notMarked}</div>
                  <div className="text-xs text-gray-600">Not Marked</div>
                </Card>
              </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[150px] max-w-[300px]">
              <Input
                placeholder="Search students..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="px-2 py-1.5 text-sm border rounded-md h-8"
            >
              <option value="all">All Students</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="not_marked">Not Marked</option>
            </select>

            <label className="flex items-center gap-1.5 px-2 py-1.5 bg-purple-50 border border-purple-200 rounded-md cursor-pointer h-8">
              <input
                type="checkbox"
                checked={isHandOffMode}
                onChange={(e) => setIsHandOffMode(e.target.checked)}
                className="rounded w-3 h-3"
              />
              <span className="text-xs text-purple-800">📱 Hand-Off Mode</span>
            </label>

            {!event.isLocked && displaySummary.notMarked > 0 && (
              <Button
                variant="danger"
                onClick={() => setShowConfirmAbsent(true)}
                size="sm"
                className="h-8 text-xs px-3"
              >
                Mark All Absent ({displaySummary.notMarked})
              </Button>
            )}
          </div>

          {/* Hand-Off Mode Info */}
          {isHandOffMode && (
            <div className="mb-4 p-3 bg-purple-100 border border-purple-300 rounded-lg">
              <p className="text-purple-800 text-sm">
                <strong>📱 Hand-Off Mode Active:</strong> Students can tap their own name to mark themselves present.
                Pass the device to each student.
              </p>
            </div>
          )}

          {/* Student List */}
          <div className="space-y-2">
            {filteredStudents.length === 0 ? (
              <Card className="p-8 text-center text-gray-500">
                {students.length === 0
                  ? 'No students assigned to this event. Go to event details to assign students.'
                  : 'No students match your search criteria.'}
              </Card>
            ) : (
              filteredStudents.map((item) => {
                const status = item.attendance?.status || 'not_marked';
                const isProcessing = processingStudent === item.student.id;

                return (
                  <Card
                    key={item.student.id}
                    className={`p-4 transition-all cursor-pointer hover:shadow-md ${
                      event.isLocked ? 'cursor-not-allowed opacity-75' : ''
                    } ${
                      status === 'present'
                        ? 'bg-green-50 border-green-300'
                        : status === 'absent'
                        ? 'bg-red-50 border-red-300'
                        : 'bg-white hover:bg-gray-50'
                    }`}
                    onClick={() => !event.isLocked && !isProcessing && handleTap(item.student.id)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Status Indicator */}
                      <div
                        className={`w-4 h-4 rounded-full ${getStatusColor(status)} ${
                          isProcessing ? 'animate-pulse' : ''
                        }`}
                      />

                      {/* Photo */}
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
                        {item.student.photoUrl ? (
                          <img
                            src={item.student.photoUrl}
                            alt={item.student.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-500 text-lg font-semibold">
                            {item.student.fullName.charAt(0)}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-gray-900 truncate">
                            {item.student.fullName}
                          </div>
                          {activeSheet && previousSheetAttendances.has(item.student.id) && (
                            (() => {
                              const prev = previousSheetAttendances.get(item.student.id)!;
                              if (prev.busNumber !== activeSheet.busNumber) {
                                if (prev.status === 'absent') {
                                  return (
                                    <Badge variant="danger" className="text-xs">
                                      Absent on {prev.busNumber}
                                    </Badge>
                                  );
                                }
                                if (prev.status === 'present') {
                                  return (
                                    <Badge variant="success" className="text-xs">
                                      Present on {prev.busNumber}
                                    </Badge>
                                  );
                                }
                                return (
                                  <Badge variant="warning" className="text-xs">
                                    ⚠️ Previously on {prev.busNumber}
                                  </Badge>
                                );
                              }
                              return null;
                            })()
                          )}
                        </div>
                        <div className="text-sm text-gray-500 truncate">
                          {item.student.nyuEmail} • {item.student.campus}
                        </div>
                      </div>

                      {/* Strike Warning */}
                      {item.student.strikeCount > 0 && (
                        <Badge variant={item.student.strikeCount >= 2 ? 'danger' : 'warning'}>
                          {item.student.strikeCount} Strike{item.student.strikeCount !== 1 ? 's' : ''}
                        </Badge>
                      )}

                      {/* Notes Indicator */}
                      {item.attendance?.notes && (
                        <span className="text-[#57068c]" title={item.attendance.notes} aria-label="Has notes">
                          <svg
                            className="w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                          </svg>
                        </span>
                      )}

                      {/* Status Badge */}
                      {getStatusBadge(status)}

                      {/* Notes Button (always visible; create record on save if needed) */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          openNotesModal(item);
                        }}
                        className="text-[#57068c] hover:bg-[#57068c]/10"
                        title="Add/Edit Notes"
                        disabled={event.isLocked || savingNote}
                      >
                        <span className="inline-flex items-center gap-1">
                          <svg
                            className="w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                          </svg>
                          <span className="text-xs font-medium">Notes</span>
                        </span>
                      </Button>

                      {/* Mark Absent Button */}
                      {!event.isLocked && status !== 'absent' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAbsent(item.student.id);
                          }}
                          disabled={isProcessing}
                          className="text-red-600 hover:bg-red-100"
                        >
                          ✕
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
            </div>
          ) : (
            <Card className="p-8 text-center mt-6">
              <p className="text-gray-500 mb-4">Select an attendance sheet above to start taking attendance.</p>
            </Card>
          )}
        </div>

        {/* Confirm Mark All Absent Modal */}
        <Modal
          isOpen={showConfirmAbsent}
          onClose={() => setShowConfirmAbsent(false)}
          title="Mark All as Absent?"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              This will mark all {displaySummary.notMarked} unmarked students as <strong>absent</strong>.
              This action cannot be easily undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowConfirmAbsent(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleMarkAllAbsent}>
                Mark All Absent
              </Button>
            </div>
          </div>
        </Modal>

        {/* Notes Modal */}
        <Modal
          isOpen={showNotesModal}
          onClose={() => setShowNotesModal(false)}
          title={`Notes for ${selectedStudent?.student.fullName || 'Student'}`}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Attendance Notes
              </label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                rows={4}
                placeholder="Add notes about this student's attendance (e.g., arrived late, left early, medical issue...)"
                disabled={event?.isLocked}
              />
            </div>
            {selectedStudent?.attendance && (
              <div className="text-sm text-gray-500">
                Status: {selectedStudent.attendance.status} • 
                Last updated: {new Date(selectedStudent.attendance.markedAt).toLocaleString()}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowNotesModal(false)}>
                Cancel
              </Button>
              <Button 
                variant="primary" 
                onClick={handleSaveNotes}
                disabled={savingNote || event?.isLocked}
                isLoading={savingNote}
              >
                Save Notes
              </Button>
            </div>
          </div>
        </Modal>

        {/* Mark Absent with Note Modal */}
        <Modal
          isOpen={showAbsentNoteModal}
          onClose={() => setShowAbsentNoteModal(false)}
          title={`Mark ${absentNoteStudentName} as Absent`}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              You can add an optional note to track the reason for this absence.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Absence Note (optional)</label>
              <textarea
                value={absentNoteText}
                onChange={(e) => setAbsentNoteText(e.target.value)}
                placeholder="e.g., Student is sick, excused by professor, family emergency..."
                className="w-full p-3 rounded-lg border border-gray-300 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-[#57068c]/20 focus:border-[#57068c]/40"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowAbsentNoteModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmMarkAbsent}
                isLoading={markingAbsent}
                className="bg-red-600 hover:bg-red-700"
              >
                Mark Absent
              </Button>
            </div>
          </div>
        </Modal>

        {/* Create Sheet Modal (for adding custom sheets to a bus) */}
        <Modal
          isOpen={showCreateSheetModal}
          onClose={() => {
            setShowCreateSheetModal(false);
            setNewSheetName('');
            setSelectedBusForNewSheet('');
            setError(null);
          }}
          title={`Add Sheet to ${selectedBusForNewSheet}`}
          size="md"
        >
          <div className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 border-l-4 border-red-500">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sheet Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={newSheetName}
                onChange={(e) => setNewSheetName(e.target.value)}
                placeholder="e.g., After lunch, At museum, Before hiking"
                disabled={creatingSheet}
              />
              <p className="mt-1 text-xs text-gray-500">Give this attendance sheet a descriptive name</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateSheetModal(false);
                  setNewSheetName('');
                  setSelectedBusForNewSheet('');
                  setError(null);
                }}
                disabled={creatingSheet}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateSheet}
                disabled={creatingSheet || !newSheetName.trim()}
                isLoading={creatingSheet}
                style={{ backgroundColor: '#57068c' }}
              >
                Add Sheet
              </Button>
            </div>
          </div>
        </Modal>

        {/* Delete Bus Confirmation Modal */}
        <Modal
          isOpen={showDeleteBusModal}
          onClose={() => {
            setShowDeleteBusModal(false);
            setBusToDelete(null);
          }}
          title=""
          size="sm"
          showCloseButton={false}
        >
          <div className="text-center py-2">
            <p className="text-base font-medium text-gray-900 mb-4">
              Delete {busToDelete} and all its sheets?
            </p>
            <p className="text-sm text-gray-500 mb-6">
              This will remove all attendance data for this bus.
            </p>
            <div className="flex justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowDeleteBusModal(false);
                  setBusToDelete(null);
                }}
                disabled={deletingBus}
                className="px-4 py-1.5 text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteBus}
                disabled={deletingBus}
                isLoading={deletingBus}
                className="px-4 py-1.5 text-xs"
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>

        {/* Delete Sheet Confirmation Modal */}
        <Modal
          isOpen={showDeleteSheetModal}
          onClose={() => {
            setShowDeleteSheetModal(false);
            setSheetToDelete(null);
          }}
          title=""
          size="sm"
          showCloseButton={false}
        >
          <div className="text-center py-2">
            <p className="text-base font-medium text-gray-900 mb-4">
              Delete &ldquo;{sheetToDelete?.name}&rdquo; sheet?
            </p>
            <p className="text-sm text-gray-500 mb-6">
              This will remove all attendance data for this sheet.
            </p>
            <div className="flex justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowDeleteSheetModal(false);
                  setSheetToDelete(null);
                }}
                disabled={deletingSheet}
                className="px-4 py-1.5 text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteSheet}
                disabled={deletingSheet}
                isLoading={deletingSheet}
                className="px-4 py-1.5 text-xs"
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      </PageLayout>
    </ProtectedRoute>
  );
}

