'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, Input, Spinner, Badge, Modal } from '@/components/ui';
import { getEventById, markEventDeparted } from '@/lib/api/events';
import { getEventAttendance, quickTapAttendance, markAttendance, markAllAbsent, AttendanceWithDetails, AttendanceSummary } from '@/lib/api/attendance';
import { Event, Student } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate, formatTime } from '@/lib/utils';
import FullScreenLoading from '@/components/FullScreenLoading';

type BoardingFilter = 'all' | 'boarded' | 'not_boarded' | 'at_risk';

interface StudentBoardingItem {
  student: Student;
  attendance?: AttendanceWithDetails;
}

export default function BusBoardingPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [students, setStudents] = useState<StudentBoardingItem[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>({ total: 0, present: 0, absent: 0, notMarked: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<BoardingFilter>('all');
  const [processingStudent, setProcessingStudent] = useState<string | null>(null);

  // Modal states
  const [showDepartureModal, setShowDepartureModal] = useState(false);
  const [showMarkAbsentModal, setShowMarkAbsentModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [departureLoading, setDepartureLoading] = useState(false);
  const [departureConfirmText, setDepartureConfirmText] = useState('');

  const debouncedSearch = useDebounce(search, 300);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [eventData, attendanceData] = await Promise.all([
        getEventById(eventId),
        getEventAttendance(eventId),
      ]);

      setEvent(eventData);
      setSummary(attendanceData.summary);

      const studentMap = new Map<string, StudentBoardingItem>();
      attendanceData.attendances.forEach((att) => {
        if (att.student) {
          studentMap.set(att.student.id, {
            student: att.student,
            attendance: att,
          });
        }
      });

      setStudents(Array.from(studentMap.values()));
    } catch (err: any) {
      setError(err.message || 'Failed to load boarding data');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Board student (mark present)
  const handleBoard = async (studentId: string) => {
    if (event?.isLocked || event?.departedAt) return;

    setProcessingStudent(studentId);
    try {
      const updated = await quickTapAttendance(eventId, studentId, false);

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

        return {
          ...prev,
          present: prev.present - (oldStatus === 'present' ? 1 : 0) + (newStatus === 'present' ? 1 : 0),
          absent: prev.absent - (oldStatus === 'absent' ? 1 : 0) + (newStatus === 'absent' ? 1 : 0),
          notMarked: prev.notMarked - (oldStatus === 'not_marked' ? 1 : 0) + (newStatus === 'not_marked' ? 1 : 0),
        };
      });
    } catch (err: any) {
      console.error('Failed to board student:', err);
    } finally {
      setProcessingStudent(null);
    }
  };

  // Mark student as absent (not boarding)
  const handleMarkNotBoarding = async (studentId: string) => {
    if (event?.isLocked || event?.departedAt) return;

    setProcessingStudent(studentId);
    try {
      const updated = await markAttendance(eventId, studentId, 'absent', { notes: 'Not boarding' });

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
    } catch (err: any) {
      console.error('Failed to mark not boarding:', err);
    } finally {
      setProcessingStudent(null);
    }
  };

  // Mark all remaining as absent
  const handleMarkAllAbsent = async () => {
    try {
      await markAllAbsent(eventId);
      setShowMarkAbsentModal(false);
      fetchData();
    } catch (err: any) {
      console.error('Failed to mark all absent:', err);
    }
  };

  // Confirm departure
  const handleConfirmDeparture = async () => {
    if (departureConfirmText !== 'DEPART') return;

    setDepartureLoading(true);
    try {
      await markEventDeparted(eventId);
      setShowDepartureModal(false);
      fetchData();
    } catch (err: any) {
      console.error('Failed to mark departure:', err);
    } finally {
      setDepartureLoading(false);
    }
  };

  // Filter students
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
    const status = item.attendance?.status || 'not_marked';
    switch (filter) {
      case 'boarded':
        return status === 'present';
      case 'not_boarded':
        return status === 'not_marked';
      case 'at_risk':
        return item.student.strikeCount > 0;
      default:
        return true;
    }
  });

  // Students at risk (have strikes)
  const atRiskStudents = students.filter(s => s.student.strikeCount > 0);
  const blockedStudents = students.filter(s => s.student.strikeCount >= 2);
  const notBoardedCount = summary.notMarked;
  const canDepart = notBoardedCount === 0;

  // Get boarding status color
  const getBoardingStatusColor = (item: StudentBoardingItem) => {
    const status = item.attendance?.status || 'not_marked';
    if (status === 'present') return 'bg-green-500';
    if (status === 'absent') return 'bg-red-500';
    return 'bg-yellow-400';
  };

  if (loading) {
    return <FullScreenLoading />;
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <Card className="p-8 text-center">
          <p className="text-red-600 mb-4">{error || 'Event not found'}</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <Link href={`/events/${eventId}`} className="text-gray-400 hover:text-white text-sm">
                ← Back to Event
              </Link>
              <h1 className="text-2xl font-bold text-white mt-1">🚌 Bus Boarding Mode</h1>
              <p className="text-gray-400">{event.name} • {formatDate(event.startDate)}</p>
            </div>
            <div className="text-right">
              {event.departedAt ? (
                <Badge variant="success" size="lg">✓ Departed</Badge>
              ) : event.isLocked ? (
                <Badge variant="warning" size="lg">🔒 Locked</Badge>
              ) : (
                <Badge variant="info" size="lg">Boarding Active</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="p-4 text-center bg-gray-800 border-gray-700">
            <div className="text-4xl font-bold text-white">{summary.total}</div>
            <div className="text-gray-400 text-sm">Assigned</div>
          </Card>
          <Card className="p-4 text-center bg-green-900/50 border-green-700">
            <div className="text-4xl font-bold text-green-400">{summary.present}</div>
            <div className="text-green-300 text-sm">Boarded</div>
          </Card>
          <Card className="p-4 text-center bg-yellow-900/50 border-yellow-700">
            <div className="text-4xl font-bold text-yellow-400">{summary.notMarked}</div>
            <div className="text-yellow-300 text-sm">Waiting</div>
          </Card>
          <Card className="p-4 text-center bg-red-900/50 border-red-700">
            <div className="text-4xl font-bold text-red-400">{summary.absent}</div>
            <div className="text-red-300 text-sm">Not Coming</div>
          </Card>
          <Card className="p-4 text-center bg-orange-900/50 border-orange-700">
            <div className="text-4xl font-bold text-orange-400">{atRiskStudents.length}</div>
            <div className="text-orange-300 text-sm">At Risk</div>
          </Card>
        </div>

        {/* Strike Risk Warnings */}
        {atRiskStudents.length > 0 && !event.departedAt && (
          <Card className="p-4 mb-6 bg-orange-900/30 border-orange-600">
            <h3 className="text-orange-400 font-bold mb-2">⚠️ Strike Risk Warnings</h3>
            <div className="grid md:grid-cols-2 gap-2">
              {atRiskStudents.map((item) => (
                <div
                  key={item.student.id}
                  className={`p-2 rounded flex items-center justify-between ${
                    item.student.strikeCount >= 2 ? 'bg-red-900/50' : 'bg-orange-900/50'
                  }`}
                >
                  <span className="text-white">{item.student.fullName}</span>
                  <Badge variant={item.student.strikeCount >= 2 ? 'danger' : 'warning'}>
                    {item.student.strikeCount} Strike{item.student.strikeCount !== 1 ? 's' : ''}
                    {item.student.strikeCount >= 2 && ' - BLOCKED'}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Pre-Departure Validation */}
        {!event.departedAt && (
          <Card className={`p-4 mb-6 ${canDepart ? 'bg-green-900/30 border-green-600' : 'bg-yellow-900/30 border-yellow-600'}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`font-bold ${canDepart ? 'text-green-400' : 'text-yellow-400'}`}>
                  {canDepart ? '✓ Ready to Depart' : '⏳ Pre-Departure Check'}
                </h3>
                <p className={`text-sm ${canDepart ? 'text-green-300' : 'text-yellow-300'}`}>
                  {canDepart
                    ? 'All students have been accounted for'
                    : `${notBoardedCount} student${notBoardedCount !== 1 ? 's' : ''} not yet marked`}
                </p>
              </div>
              <div className="flex gap-2">
                {!canDepart && (
                  <Button
                    variant="danger"
                    onClick={() => setShowMarkAbsentModal(true)}
                    disabled={event.isLocked}
                  >
                    Mark All Waiting as Absent
                  </Button>
                )}
                <Button
                  variant="primary"
                  onClick={() => canDepart ? setShowDepartureModal(true) : setShowSummaryModal(true)}
                  disabled={event.isLocked}
                  className={canDepart ? 'bg-green-600 hover:bg-green-700' : ''}
                >
                  {canDepart ? '🚌 Confirm Departure' : '📋 View Summary'}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Departed Notice */}
        {event.departedAt && (
          <Card className="p-4 mb-6 bg-green-900/30 border-green-600">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-green-400 font-bold">✓ Bus Has Departed</h3>
                <p className="text-green-300 text-sm">
                  Departed at {new Date(event.departedAt).toLocaleString()}
                </p>
              </div>
              <Button variant="outline" onClick={() => setShowSummaryModal(true)}>
                📋 View Final Summary
              </Button>
            </div>
          </Card>
        )}

        {/* Controls */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search students..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>

          <div className="flex gap-2">
            {(['all', 'boarded', 'not_boarded', 'at_risk'] as BoardingFilter[]).map((f) => (
              <Button
                key={f}
                variant={filter === f ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilter(f)}
                className={filter !== f ? 'border-gray-600 text-gray-300' : ''}
              >
                {f === 'all' && 'All'}
                {f === 'boarded' && `✓ Boarded (${summary.present})`}
                {f === 'not_boarded' && `⏳ Waiting (${summary.notMarked})`}
                {f === 'at_risk' && `⚠️ At Risk (${atRiskStudents.length})`}
              </Button>
            ))}
          </div>
        </div>

        {/* Student List */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredStudents.length === 0 ? (
            <Card className="col-span-full p-8 text-center bg-gray-800 border-gray-700">
              <p className="text-gray-400">
                {students.length === 0
                  ? 'No students assigned to this event'
                  : 'No students match your filter'}
              </p>
            </Card>
          ) : (
            filteredStudents.map((item) => {
              const status = item.attendance?.status || 'not_marked';
              const isProcessing = processingStudent === item.student.id;
              const isBoarded = status === 'present';
              const isAbsent = status === 'absent';
              const hasStrikes = item.student.strikeCount > 0;
              const isBlocked = item.student.strikeCount >= 2;

              return (
                <Card
                  key={item.student.id}
                  className={`p-4 transition-all ${
                    isBoarded
                      ? 'bg-green-900/40 border-green-600'
                      : isAbsent
                      ? 'bg-red-900/40 border-red-600'
                      : 'bg-gray-800 border-gray-700 hover:border-gray-500'
                  } ${isBlocked ? 'ring-2 ring-red-500' : hasStrikes ? 'ring-2 ring-orange-500' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Status Indicator */}
                    <div className={`w-3 h-3 rounded-full mt-2 ${getBoardingStatusColor(item)} ${isProcessing ? 'animate-pulse' : ''}`} />

                    {/* Photo */}
                    <div className="w-12 h-12 rounded-full bg-gray-700 flex-shrink-0 overflow-hidden">
                      {item.student.photoUrl ? (
                        <img src={item.student.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg font-bold">
                          {item.student.fullName.charAt(0)}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{item.student.fullName}</div>
                      <div className="text-sm text-gray-400 truncate">{item.student.campus}</div>
                      
                      {/* Strike Badge */}
                      {hasStrikes && (
                        <Badge
                          variant={isBlocked ? 'danger' : 'warning'}
                          size="sm"
                          className="mt-1"
                        >
                          {item.student.strikeCount} Strike{item.student.strikeCount !== 1 ? 's' : ''}
                          {isBlocked && ' - BLOCKED'}
                        </Badge>
                      )}
                    </div>

                    {/* Actions */}
                    {!event.departedAt && !event.isLocked && (
                      <div className="flex flex-col gap-1">
                        {!isBoarded && !isAbsent && (
                          <>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleBoard(item.student.id)}
                              disabled={isProcessing}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              ✓ Board
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleMarkNotBoarding(item.student.id)}
                              disabled={isProcessing}
                              className="text-red-400 hover:bg-red-900/30"
                            >
                              ✕ Not Coming
                            </Button>
                          </>
                        )}
                        {isBoarded && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleBoard(item.student.id)}
                            disabled={isProcessing}
                            className="text-yellow-400 hover:bg-yellow-900/30"
                          >
                            ↩ Undo
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Status Badge for departed/locked */}
                    {(event.departedAt || event.isLocked) && (
                      <Badge variant={isBoarded ? 'success' : isAbsent ? 'danger' : 'default'}>
                        {isBoarded ? 'Boarded' : isAbsent ? 'Absent' : 'Missing'}
                      </Badge>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Mark All Absent Modal */}
      <Modal
        isOpen={showMarkAbsentModal}
        onClose={() => setShowMarkAbsentModal(false)}
        title="Mark Remaining Students as Absent?"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            This will mark all {summary.notMarked} waiting students as <strong>absent</strong> (not coming).
          </p>
          <div className="bg-yellow-50 p-3 rounded-lg">
            <p className="text-yellow-800 text-sm">
              ⚠️ This action will add strikes to these students if they were expected to attend.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowMarkAbsentModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleMarkAllAbsent}>
              Mark All Absent
            </Button>
          </div>
        </div>
      </Modal>

      {/* Departure Confirmation Modal */}
      <Modal
        isOpen={showDepartureModal}
        onClose={() => setShowDepartureModal(false)}
        title="🚌 Confirm Bus Departure"
      >
        <div className="space-y-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-bold text-green-800 mb-2">Pre-Departure Checklist</h4>
            <ul className="space-y-2 text-green-700">
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                {summary.present} students boarded
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                {summary.absent} students marked absent
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                All students accounted for
              </li>
            </ul>
          </div>

          {blockedStudents.length > 0 && (
            <div className="bg-red-50 p-3 rounded-lg">
              <p className="text-red-800 text-sm font-medium">
                ⚠️ {blockedStudents.length} blocked student{blockedStudents.length !== 1 ? 's' : ''} on board. 
                Ensure proper approval was obtained.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type &ldquo;DEPART&rdquo; to confirm departure
            </label>
            <Input
              value={departureConfirmText}
              onChange={(e) => setDepartureConfirmText(e.target.value.toUpperCase())}
              placeholder="DEPART"
              className="text-center font-mono text-lg"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDepartureModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmDeparture}
              disabled={departureConfirmText !== 'DEPART' || departureLoading}
              isLoading={departureLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              🚌 Confirm Departure
            </Button>
          </div>
        </div>
      </Modal>

      {/* Summary Modal */}
      <Modal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        title="📋 Boarding Summary"
      >
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{summary.present}</div>
              <div className="text-sm text-green-700">Boarded</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{summary.absent}</div>
              <div className="text-sm text-red-700">Absent</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{summary.notMarked}</div>
              <div className="text-sm text-yellow-700">Not Marked</div>
            </div>
          </div>

          {/* Not marked students */}
          {summary.notMarked > 0 && (
            <div className="bg-yellow-50 p-3 rounded-lg">
              <h4 className="font-bold text-yellow-800 mb-2">⏳ Students Not Marked ({summary.notMarked})</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                {students
                  .filter(s => (s.attendance?.status || 'not_marked') === 'not_marked')
                  .map(s => (
                    <li key={s.student.id}>• {s.student.fullName}</li>
                  ))}
              </ul>
            </div>
          )}

          {/* Absent students */}
          {summary.absent > 0 && (
            <div className="bg-red-50 p-3 rounded-lg">
              <h4 className="font-bold text-red-800 mb-2">❌ Absent Students ({summary.absent})</h4>
              <ul className="text-sm text-red-700 space-y-1">
                {students
                  .filter(s => s.attendance?.status === 'absent')
                  .map(s => (
                    <li key={s.student.id}>
                      • {s.student.fullName}
                      {s.student.strikeCount > 0 && ` (${s.student.strikeCount} prior strikes)`}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* At risk students on board */}
          {atRiskStudents.filter(s => s.attendance?.status === 'present').length > 0 && (
            <div className="bg-orange-50 p-3 rounded-lg">
              <h4 className="font-bold text-orange-800 mb-2">⚠️ At-Risk Students Boarded</h4>
              <ul className="text-sm text-orange-700 space-y-1">
                {atRiskStudents
                  .filter(s => s.attendance?.status === 'present')
                  .map(s => (
                    <li key={s.student.id}>
                      • {s.student.fullName} ({s.student.strikeCount} strike{s.student.strikeCount !== 1 ? 's' : ''})
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setShowSummaryModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

