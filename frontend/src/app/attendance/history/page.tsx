'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import PageLayout from '@/components/layout/PageLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button, Card, Input, Spinner, Badge, Select } from '@/components/ui';
import { getStudents, StudentFilters } from '@/lib/api/students';
import { getEvents, EventFilters } from '@/lib/api/events';
import { getStudentAttendanceHistory, getEventAttendance, AttendanceWithDetails } from '@/lib/api/attendance';
import { Student, Event } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate, formatTime } from '@/lib/utils';

type ViewMode = 'by-student' | 'by-event';

export default function AttendanceHistoryPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('by-student');
  const [loading, setLoading] = useState(false);
  
  // Student view state
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentAttendance, setStudentAttendance] = useState<AttendanceWithDetails[]>([]);
  const [studentStats, setStudentStats] = useState({ total: 0, present: 0, absent: 0, attendanceRate: 0 });
  
  // Event view state
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventSearch, setEventSearch] = useState('');
  const [eventAttendance, setEventAttendance] = useState<AttendanceWithDetails[]>([]);
  const [eventSummary, setEventSummary] = useState({ total: 0, present: 0, absent: 0, notMarked: 0 });
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const debouncedStudentSearch = useDebounce(studentSearch, 300);
  const debouncedEventSearch = useDebounce(eventSearch, 300);

  // Fetch students for selection
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const response = await getStudents({ search: debouncedStudentSearch, limit: 50 });
        setStudents(response.data || []);
      } catch (err) {
        console.error('Failed to fetch students:', err);
      }
    };
    
    if (viewMode === 'by-student') {
      fetchStudents();
    }
  }, [debouncedStudentSearch, viewMode]);

  // Fetch events for selection
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await getEvents({ search: debouncedEventSearch, limit: 50 });
        setEvents(response.data || []);
      } catch (err) {
        console.error('Failed to fetch events:', err);
      }
    };
    
    if (viewMode === 'by-event') {
      fetchEvents();
    }
  }, [debouncedEventSearch, viewMode]);

  // Fetch attendance when student is selected
  useEffect(() => {
    const fetchStudentAttendance = async () => {
      if (!selectedStudent) return;
      
      setLoading(true);
      try {
        const response = await getStudentAttendanceHistory(selectedStudent.id);
        setStudentAttendance(response.attendances || []);
        setStudentStats(response.stats);
      } catch (err) {
        console.error('Failed to fetch student attendance:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStudentAttendance();
  }, [selectedStudent]);

  // Fetch attendance when event is selected
  useEffect(() => {
    const fetchEventAttendance = async () => {
      if (!selectedEvent) return;
      
      setLoading(true);
      try {
        const response = await getEventAttendance(selectedEvent.id);
        setEventAttendance(response.attendances || []);
        setEventSummary(response.summary);
      } catch (err) {
        console.error('Failed to fetch event attendance:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchEventAttendance();
  }, [selectedEvent]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge variant="success">Present</Badge>;
      case 'absent':
        return <Badge variant="danger">Absent</Badge>;
      default:
        return <Badge variant="default">Not Marked</Badge>;
    }
  };

  // Filter attendance records
  const filteredStudentAttendance = studentAttendance.filter(att => 
    statusFilter === 'all' || att.status === statusFilter
  );

  const filteredEventAttendance = eventAttendance.filter(att =>
    statusFilter === 'all' || att.status === statusFilter
  );

  const formatMarkedTime = (markedAt?: string) => {
    if (!markedAt) return 'Not marked';
    return new Date(markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <ProtectedRoute>
      <PageLayout
        title="Attendance History"
        actions={
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'by-student' ? 'primary' : 'outline'}
              onClick={() => setViewMode('by-student')}
            >
              By Student
            </Button>
            <Button
              variant={viewMode === 'by-event' ? 'primary' : 'outline'}
              onClick={() => setViewMode('by-event')}
            >
              By Event
            </Button>
          </div>
        }
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Selection Panel */}
            <div className="lg:col-span-1">
              <Card className="p-4">
                <h3 className="font-semibold mb-4">
                  {viewMode === 'by-student' ? 'Select Student' : 'Select Event'}
                </h3>

                {viewMode === 'by-student' ? (
                  <>
                    <Input
                      placeholder="Search students..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="mb-4"
                    />
                    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                      {students.map((student) => (
                        <button
                          key={student.id}
                          onClick={() => setSelectedStudent(student)}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            selectedStudent?.id === student.id
                              ? 'bg-primary-50 border-primary-300 shadow-sm'
                              : 'hover:bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="font-semibold text-sm text-gray-900 break-words leading-snug">
                            {student.fullName}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                            {student.campus && (
                              <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                                {student.campus}
                              </span>
                            )}
                            {student.cohort && (
                              <span className="inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-purple-700">
                                {student.cohort}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                      {students.length === 0 && (
                        <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
                          No students match your search.
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <Input
                      placeholder="Search events..."
                      value={eventSearch}
                      onChange={(e) => setEventSearch(e.target.value)}
                      className="mb-4"
                    />
                    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                      {events.map((event) => (
                        <button
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            selectedEvent?.id === event.id
                              ? 'bg-primary-50 border-primary-300 shadow-sm'
                              : 'hover:bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="font-semibold text-sm text-gray-900 break-words leading-snug">
                            {event.name}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                              {formatDate(event.startDate)}
                            </span>
                            {event.location && (
                              <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 break-all">
                                {event.location}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                      {events.length === 0 && (
                        <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
                          No events match your search.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </Card>
            </div>

            {/* Results Panel */}
            <div className="lg:col-span-2">
              {viewMode === 'by-student' && selectedStudent ? (
                <>
                  {/* Student Info & Stats */}
                  <Card className="p-4 mb-4">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                        {selectedStudent.photoUrl ? (
                          <img
                            src={selectedStudent.photoUrl}
                            alt=""
                            className="w-16 h-16 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-2xl font-bold text-gray-500">
                            {selectedStudent.fullName.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">{selectedStudent.fullName}</h2>
                        <p className="text-gray-600">{selectedStudent.nyuEmail}</p>
                        <p className="text-gray-500 text-sm">{selectedStudent.campus} • {selectedStudent.cohort}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <div className="text-2xl font-bold">{studentStats.total}</div>
                        <div className="text-xs text-gray-500">Events</div>
                      </div>
                      <div className="text-center p-2 bg-green-50 rounded">
                        <div className="text-2xl font-bold text-green-600">{studentStats.present}</div>
                        <div className="text-xs text-gray-500">Present</div>
                      </div>
                      <div className="text-center p-2 bg-red-50 rounded">
                        <div className="text-2xl font-bold text-red-600">{studentStats.absent}</div>
                        <div className="text-xs text-gray-500">Absent</div>
                      </div>
                      <div className="text-center p-2 bg-blue-50 rounded">
                        <div className="text-2xl font-bold text-blue-600">{studentStats.attendanceRate}%</div>
                        <div className="text-xs text-gray-500">Rate</div>
                      </div>
                    </div>
                  </Card>

                  {/* Filter */}
                  <div className="flex gap-4 mb-4">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2 border rounded-md"
                    >
                      <option value="all">All Status</option>
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="not_marked">Not Marked</option>
                    </select>
                  </div>

                  {/* Attendance Records */}
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <Spinner size="lg" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredStudentAttendance.length === 0 ? (
                        <Card className="p-8 text-center text-gray-500">
                          No attendance records found.
                        </Card>
                      ) : (
                        filteredStudentAttendance.map((att) => (
                          <Card key={att.id} className="p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0">
                                <Link
                                  href={`/events/${att.eventId}`}
                                  className="font-semibold text-gray-900 hover:text-primary-600 break-words leading-snug"
                                >
                                  {att.event?.name || 'Unknown Event'}
                                </Link>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
                                  {att.event?.startDate && (
                                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5">
                                      {formatDate(att.event.startDate)}
                                    </span>
                                  )}
                                  {att.event?.location && (
                                    <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 break-all">
                                      {att.event.location}
                                    </span>
                                  )}
                                </div>
                                {att.notes && (
                                  <div className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-sm text-amber-800 break-words">
                                    📝 {att.notes}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                {att.isHandOffMode && (
                                  <span className="inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">📱 Self</span>
                                )}
                                {getStatusBadge(att.status)}
                                <div className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                                  {formatMarkedTime(att.markedAt)}
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))
                      )}
                    </div>
                  )}
                </>
              ) : viewMode === 'by-event' && selectedEvent ? (
                <>
                  {/* Event Info & Stats */}
                  <Card className="p-4 mb-4">
                    <div className="mb-4">
                      <h2 className="text-xl font-bold">{selectedEvent.name}</h2>
                      <p className="text-gray-600">
                        {formatDate(selectedEvent.startDate)}
                        {selectedEvent.startTime && ` at ${selectedEvent.startTime}`}
                      </p>
                      {selectedEvent.location && (
                        <p className="text-gray-500 text-sm">{selectedEvent.location}</p>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <div className="text-2xl font-bold">{eventSummary.total}</div>
                        <div className="text-xs text-gray-500">Total</div>
                      </div>
                      <div className="text-center p-2 bg-green-50 rounded">
                        <div className="text-2xl font-bold text-green-600">{eventSummary.present}</div>
                        <div className="text-xs text-gray-500">Present</div>
                      </div>
                      <div className="text-center p-2 bg-red-50 rounded">
                        <div className="text-2xl font-bold text-red-600">{eventSummary.absent}</div>
                        <div className="text-xs text-gray-500">Absent</div>
                      </div>
                      <div className="text-center p-2 bg-yellow-50 rounded">
                        <div className="text-2xl font-bold text-yellow-600">{eventSummary.notMarked}</div>
                        <div className="text-xs text-gray-500">Not Marked</div>
                      </div>
                    </div>
                  </Card>

                  {/* Filter */}
                  <div className="flex gap-4 mb-4">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2 border rounded-md"
                    >
                      <option value="all">All Status</option>
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="not_marked">Not Marked</option>
                    </select>
                    <Link href={`/events/${selectedEvent.id}/attendance`}>
                      <Button variant="outline">📋 Take Attendance</Button>
                    </Link>
                  </div>

                  {/* Attendance Records */}
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <Spinner size="lg" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredEventAttendance.length === 0 ? (
                        <Card className="p-8 text-center text-gray-500">
                          No attendance records found.
                        </Card>
                      ) : (
                        filteredEventAttendance.map((att) => (
                          <Card key={att.id} className="p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div className="flex min-w-0 items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                  {att.student?.photoUrl ? (
                                    <img
                                      src={att.student.photoUrl}
                                      alt=""
                                      className="w-10 h-10 rounded-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-sm font-bold text-gray-500">
                                      {att.student?.fullName?.charAt(0) || '?'}
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <Link
                                    href={`/students/${att.studentId}`}
                                    className="font-semibold text-gray-900 hover:text-primary-600 break-words leading-snug"
                                  >
                                    {att.student?.fullName || 'Unknown Student'}
                                  </Link>
                                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
                                    {att.student?.campus && (
                                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5">
                                        {att.student.campus}
                                      </span>
                                    )}
                                    {att.markedBy?.fullName && (
                                      <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 break-words">
                                        Marked by {att.markedBy.fullName}
                                      </span>
                                    )}
                                  </div>
                                  {att.notes && (
                                    <div className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-sm text-amber-800 break-words">
                                      📝 {att.notes}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                {att.isHandOffMode && (
                                  <span className="inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">📱 Self</span>
                                )}
                                {getStatusBadge(att.status)}
                                <div className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                                  {formatMarkedTime(att.markedAt)}
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))
                      )}
                    </div>
                  )}
                </>
              ) : (
                <Card className="p-8 text-center text-gray-500">
                  <div className="text-4xl mb-4">📋</div>
                  <p>Select a {viewMode === 'by-student' ? 'student' : 'event'} to view attendance history</p>
                </Card>
              )}
            </div>
          </div>
        </div>
      </PageLayout>
    </ProtectedRoute>
  );
}

