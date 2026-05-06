'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Card, Input, Spinner } from '@/components/ui';
import { getEventById } from '@/lib/api/events';
import { getEventAttendance, quickTapAttendance, AttendanceWithDetails } from '@/lib/api/attendance';
import { Event, Student } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';
import FullScreenLoading from '@/components/FullScreenLoading';

interface StudentAttendanceItem {
  student: Student;
  attendance?: AttendanceWithDetails;
}

export default function HandOffModePage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [students, setStudents] = useState<StudentAttendanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [processingStudent, setProcessingStudent] = useState<string | null>(null);
  const [successStudent, setSuccessStudent] = useState<string | null>(null);
  const [presentCount, setPresentCount] = useState(0);

  const debouncedSearch = useDebounce(search, 300);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [eventData, attendanceData] = await Promise.all([
        getEventById(eventId),
        getEventAttendance(eventId),
      ]);

      setEvent(eventData);
      setPresentCount(attendanceData.summary.present);

      const studentMap = new Map<string, StudentAttendanceItem>();
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
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTap = async (studentId: string, studentName: string) => {
    if (event?.isLocked) return;

    const currentItem = students.find(s => s.student.id === studentId);
    if (currentItem?.attendance?.status === 'present') {
      // Already present, do nothing
      return;
    }

    setProcessingStudent(studentId);
    try {
      const updated = await quickTapAttendance(eventId, studentId, true);

      setStudents((prev) =>
        prev.map((item) =>
          item.student.id === studentId
            ? { ...item, attendance: updated }
            : item
        )
      );

      if (updated.status === 'present') {
        setPresentCount(c => c + 1);
        setSuccessStudent(studentId);
        setTimeout(() => setSuccessStudent(null), 2000);
      }
    } catch (err: any) {
      console.error('Failed to mark attendance:', err);
    } finally {
      setProcessingStudent(null);
    }
  };

  // Filter students - only show not yet present
  const filteredStudents = students.filter((item) => {
    const status = item.attendance?.status || 'not_marked';
    if (status === 'present') return false;

    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      return (
        item.student.fullName.toLowerCase().includes(searchLower) ||
        item.student.nyuEmail.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  if (loading) {
    return <FullScreenLoading />;
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-red-600 mb-4">Event not found</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-indigo-700 p-4">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-6">
        <button
          onClick={() => router.push(`/events/${eventId}/attendance`)}
          className="text-white/80 hover:text-white text-sm mb-4 flex items-center gap-1"
        >
          ← Exit Hand-Off Mode
        </button>
        
        <div className="text-center text-white mb-6">
          <h1 className="text-3xl font-bold mb-2">📱 Student Check-In</h1>
          <p className="text-xl opacity-90">{event.name}</p>
        </div>

        {/* Present Counter */}
        <div className="bg-white/20 backdrop-blur rounded-2xl p-6 text-center mb-6">
          <div className="text-6xl font-bold text-white mb-2">{presentCount}</div>
          <div className="text-white/80 text-lg">Students Checked In</div>
        </div>

        {/* Search */}
        <div className="relative">
          <Input
            placeholder="🔍 Find your name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-lg py-4 px-6 rounded-full border-0 shadow-lg"
          />
        </div>
      </div>

      {/* Student Buttons */}
      <div className="max-w-2xl mx-auto">
        {filteredStudents.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <p className="text-xl font-medium text-gray-700">
              {students.length === 0 
                ? 'No students assigned yet' 
                : 'All students have checked in!'}
            </p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filteredStudents.map((item) => {
              const isProcessing = processingStudent === item.student.id;
              const isSuccess = successStudent === item.student.id;

              return (
                <button
                  key={item.student.id}
                  onClick={() => handleTap(item.student.id, item.student.fullName)}
                  disabled={isProcessing || event.isLocked}
                  className={`
                    w-full p-6 rounded-2xl text-left transition-all transform
                    ${isSuccess 
                      ? 'bg-green-500 scale-95 shadow-lg' 
                      : 'bg-white hover:scale-[1.02] hover:shadow-xl shadow-md'}
                    ${isProcessing ? 'animate-pulse' : ''}
                    disabled:opacity-50
                  `}
                >
                  <div className="flex items-center gap-4">
                    {/* Photo */}
                    <div className="w-16 h-16 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
                      {item.student.photoUrl ? (
                        <img
                          src={item.student.photoUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500 text-2xl font-bold">
                          {item.student.fullName.charAt(0)}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                      <div className={`text-xl font-bold ${isSuccess ? 'text-white' : 'text-gray-900'}`}>
                        {item.student.fullName}
                      </div>
                      <div className={`text-sm ${isSuccess ? 'text-white/80' : 'text-gray-500'}`}>
                        {item.student.campus}
                      </div>
                    </div>

                    {/* Status */}
                    {isSuccess ? (
                      <div className="text-4xl">✓</div>
                    ) : isProcessing ? (
                      <Spinner size="md" />
                    ) : (
                      <div className="text-3xl text-gray-300">👆</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/20 backdrop-blur p-4">
        <div className="max-w-2xl mx-auto text-center text-white/80 text-sm">
          Tap your name to check in • {filteredStudents.length} remaining
        </div>
      </div>
    </div>
  );
}

