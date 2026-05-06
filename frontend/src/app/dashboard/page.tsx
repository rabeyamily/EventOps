'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth-store';
import { useViewingSemesterStore } from '@/store/viewing-semester-store';
import PageLayout from '@/components/layout/PageLayout';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import FullScreenLoading from '@/components/FullScreenLoading';
import { Badge, Button, Spinner } from '@/components/ui';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getAdminDashboard, AdminDashboardData } from '@/lib/api/dashboard';
import { getMyNote, saveMyNote } from '@/lib/api/staff-notes';
import RichNoteEditor from '@/components/RichNoteEditor';
import { formatDate, formatTime } from '@/lib/utils';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, fetchUser } = useAuthStore();
  const viewingSemester = useViewingSemesterStore((s) => s.viewingSemester);
  const canViewSharedDashboard = user?.role === 'admin' || user?.role === 'staff';
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const noteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchUserCalled = useRef(false);
  const lastFetchedCohort = useRef<string | null>(null);

  useEffect(() => {
    // Avoid re-fetching auth user on every dashboard navigation; it triggers global loading flashes.
    if (user || isLoading || fetchUserCalled.current) return;
    fetchUserCalled.current = true;
    fetchUser().catch(() => {
      if (!isAuthenticated) {
        router.push('/');
      }
    });
  }, [user, isLoading, fetchUser, router, isAuthenticated]);

  const fetchDashboard = useCallback(async () => {
    if (!canViewSharedDashboard || !viewingSemester) return;
    setLoading(true);
    setError(null);
    try {
      const cohort = viewingSemester;
      const data = await getAdminDashboard(cohort);
      setDashboardData(data);
      lastFetchedCohort.current = cohort ?? null;
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [canViewSharedDashboard, viewingSemester]);

  useEffect(() => {
    if (canViewSharedDashboard && viewingSemester !== null) {
      fetchDashboard();
    } else if (!canViewSharedDashboard) {
      setLoading(false);
    }
  }, [canViewSharedDashboard, viewingSemester, fetchDashboard]);

  useEffect(() => {
    if (isAuthenticated) {
      getMyNote().then(data => setNoteContent(data.content || '')).catch(() => {});
    }
  }, [isAuthenticated]);

  const handleNoteChange = (value: string) => {
    setNoteContent(value);
    setNoteSaved(false);
    if (noteTimeoutRef.current) clearTimeout(noteTimeoutRef.current);
    noteTimeoutRef.current = setTimeout(async () => {
      setNoteSaving(true);
      try {
        await saveMyNote(value);
        setNoteSaved(true);
        setTimeout(() => setNoteSaved(false), 2000);
      } catch (err) {
        console.error('Failed to save note:', err);
      } finally {
        setNoteSaving(false);
      }
    }, 800);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getActionIcon = (type: string) => {
    if (type === 'ATTENDANCE') return '📋';
    if (type === 'STRIKE') return '⚠️';
    if (type === 'STUDENT_INFO') return '📝';
    return '🔔';
  };

  const getPriorityColor = (priority: string) => {
    if (priority === 'high') return 'bg-red-50 border-red-200 text-red-800';
    if (priority === 'medium') return 'bg-orange-50 border-orange-200 text-orange-800';
    return 'bg-blue-50 border-blue-200 text-blue-800';
  };

  const getEventStatusColor = (event: any) => {
    if (event.isLocked) return 'bg-gray-100 border-gray-300';
    if (event.attendance?.completionRate === 100) return 'bg-green-50 border-green-200';
    if (event.attendance?.completionRate >= 80) return 'bg-blue-50 border-blue-200';
    if (event.attendance?.completionRate >= 50) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const getEventStatusDot = (event: any) => {
    const now = new Date();
    const eventDate = new Date(event.startDate);
    const eventTime = event.startTime ? new Date(`${event.startDate}T${event.startTime}`) : eventDate;
    
    if (event.isLocked) return '🔒';
    if (eventTime < now) return '✅';
    if (eventDate.toDateString() === now.toDateString()) return '🟡';
    return '🔵';
  };

  // Link styled as primary Button (sm) — do not nest <button> inside <a>
  const actionItemLinkClassName =
    'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 bg-primary-600 text-white hover:bg-primary-700 px-3 py-1.5 text-xs whitespace-nowrap';

  // Only show full-screen loader on initial load (no data yet)
  if (loading && dashboardData === null && canViewSharedDashboard) {
    return (
      <ProtectedRoute>
        <PageLayout>
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-[#57068c]" />
          </div>
        </PageLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <PageLayout>
        <div className="-mt-3 sm:-mt-6">
          {/* Inline loading indicator for semester refetches */}
          {loading && dashboardData !== null && (
            <div className="flex justify-center py-2 mb-2">
              <Spinner size="sm" className="text-[#57068c]" />
            </div>
          )}

          {canViewSharedDashboard && dashboardData ? (
            <div className="space-y-3 sm:space-y-4">
            {/* Greeting and Summary */}
            <div className="bg-gradient-to-r from-[#57068c] via-[#7a0fb8] to-[#9d5dd4] text-white rounded-lg p-4 sm:p-6 relative overflow-hidden">
              {/* Organic flowing line pattern overlay */}
              <svg 
                className="absolute inset-0 w-full h-full"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="none"
                viewBox="0 0 400 200"
              >
                <defs>
                  <pattern id="organic-pattern" x="0" y="0" width="400" height="200" patternUnits="userSpaceOnUse">
                    {/* Flowing organic lines - more visible */}
                    <path 
                      d="M0,50 Q50,30 100,50 T200,50 Q250,70 300,50 T400,50" 
                      stroke="rgba(30, 0, 60, 0.6)" 
                      fill="none" 
                      strokeWidth="2"
                    />
                    <path 
                      d="M0,80 Q60,60 120,80 T240,80 Q300,100 360,80 T400,80" 
                      stroke="rgba(30, 0, 60, 0.55)" 
                      fill="none" 
                      strokeWidth="2"
                    />
                    <path 
                      d="M0,110 Q40,90 80,110 T160,110 Q200,130 240,110 T320,110 Q360,90 400,110" 
                      stroke="rgba(30, 0, 60, 0.6)" 
                      fill="none" 
                      strokeWidth="2"
                    />
                    <path 
                      d="M0,140 Q70,120 140,140 T280,140 Q350,160 400,140" 
                      stroke="rgba(30, 0, 60, 0.55)" 
                      fill="none" 
                      strokeWidth="2"
                    />
                    <path 
                      d="M0,20 Q30,40 60,20 T120,20 Q150,0 180,20 T240,20 Q270,40 300,20 T360,20 Q390,0 400,20" 
                      stroke="rgba(30, 0, 60, 0.5)" 
                      fill="none" 
                      strokeWidth="1.8"
                    />
                    <path 
                      d="M0,170 Q50,150 100,170 T200,170 Q250,190 300,170 T400,170" 
                      stroke="rgba(30, 0, 60, 0.55)" 
                      fill="none" 
                      strokeWidth="2"
                    />
                    {/* Additional flowing curves for more organic feel */}
                    <path 
                      d="M50,0 Q80,30 110,0 T170,0 Q200,30 230,0 T290,0 Q320,30 350,0 T400,0" 
                      stroke="rgba(30, 0, 60, 0.45)" 
                      fill="none" 
                      strokeWidth="1.8"
                    />
                    <path 
                      d="M100,200 Q130,170 160,200 T220,200 Q250,170 280,200 T340,200 Q370,170 400,200" 
                      stroke="rgba(30, 0, 60, 0.5)" 
                      fill="none" 
                      strokeWidth="1.8"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#organic-pattern)" />
              </svg>
              
              <div className="relative z-10">
                <h1 className="text-xl sm:text-2xl font-bold mb-2">
                  {getGreeting()}, {user?.preferredName || user?.fullName || user?.email?.split('@')[0] || 'User'}
                </h1>
                <div className="flex flex-wrap gap-4 text-sm sm:text-base">
                  <span>Today: {formatDate(new Date())}</span>
                  <span>•</span>
                  <span>{dashboardData.events.today || 0} event{dashboardData.events.today !== 1 ? 's' : ''} today</span>
                </div>
              </div>
            </div>

            {/* Action Items and Today's Events Side by Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-stretch">
              {/* Action Items */}
              {dashboardData.actionItems && dashboardData.actionItems.length > 0 && (
                <Card className="border border-[#57068c] h-full flex flex-col">
                  <CardHeader className="pb-2 border-b border-purple-100">
                    <CardTitle className="text-base sm:text-lg font-bold text-[#57068c]">🎯 ACTION ITEMS ({dashboardData.actionItems.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <div className="space-y-2">
                      {dashboardData.actionItems.map((item, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg border ${getPriorityColor(item.priority)}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-lg">{getActionIcon(item.type)}</span>
                              <span className="font-medium text-sm">{item.message}</span>
                            </div>
                            {item.eventId && (
                              <Link
                                href={`/events/${item.eventId}/attendance`}
                                className={actionItemLinkClassName}
                              >
                                Take Attendance →
                              </Link>
                            )}
                            {item.type === 'STRIKE' && (
                              <Link href="/strikes" className={actionItemLinkClassName}>
                                Manage →
                              </Link>
                            )}
                            {item.type === 'STUDENT_INFO' && (
                              <Link
                                href="/students?missingInfo=true"
                                className={actionItemLinkClassName}
                              >
                                View →
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex justify-between items-center mb-2">
                        <div className="text-base sm:text-lg font-bold text-orange-700">⚠️ STUDENTS NEEDING ATTENTION</div>
                        <Link href="/strikes">
                          <Button variant="outline" size="sm" className="text-xs">Manage</Button>
                        </Link>
                      </div>
                      {dashboardData.atRiskStudents && dashboardData.atRiskStudents.length > 0 ? (
                        <div className="space-y-1 sm:space-y-2">
                          {dashboardData.atRiskStudents.slice(0, 5).map((student: any) => (
                            <Link
                              key={student.id}
                              href={`/students/${student.id}`}
                              className="block p-1.5 sm:p-2 bg-orange-50 rounded hover:bg-orange-100 transition-colors"
                            >
                              <div className="flex justify-between items-center gap-2">
                                <span className="font-medium text-gray-900 text-xs sm:text-sm truncate">
                                  {student.strikeCount >= 2 ? '🔴' : '🟡'} {student.fullName}
                                </span>
                                <Badge variant={student.strikeCount >= 2 ? 'danger' : 'warning'} size="sm">
                                  {student.strikeCount} {student.strikeCount !== 1 ? 'strikes' : 'strike'}
                                </Badge>
                              </div>
                            </Link>
                          ))}
                          {dashboardData.studentsMissingInfo && dashboardData.studentsMissingInfo.length > 0 && (
                            <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-orange-200">
                              <div className="text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                                📝 Missing Information ({dashboardData.studentsMissingInfo.length})
                              </div>
                              <Link href="/students?missingInfo=true" className="text-xs text-[#57068c] hover:underline">
                                View all →
                              </Link>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-2 sm:py-4 text-xs sm:text-sm">All students are in good standing</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Today's Events + This Week */}
              <Card padding="none" className="h-full flex flex-col">
                <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-1 border-b border-gray-100 mb-0">
                  <CardTitle className="text-base sm:text-lg font-bold">📅 TODAY&apos;S EVENTS</CardTitle>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 pt-0 pb-4 sm:pb-6 flex-1 flex flex-col">
                    {dashboardData.events.todayList && dashboardData.events.todayList.length > 0 ? (
                      <div className="space-y-3">
                        {dashboardData.events.todayList.map((event: any) => (
                          <div
                            key={event.id}
                            className={`p-3 rounded-lg border ${getEventStatusColor(event)}`}
                          >
                            <div className="flex items-start justify-between gap-3 mb-1.5">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-base">{getEventStatusDot(event)}</span>
                                  <Link
                                    href={`/events/${event.id}`}
                                    className="font-semibold text-gray-900 hover:text-[#57068c] transition-colors text-base leading-tight"
                                  >
                                    {event.name}
                                  </Link>
                                </div>
                                <div className="text-xs text-gray-600 space-y-0.5">
                                  {event.startTime && (
                                    <div>🕐 {formatTime(event.startTime)}</div>
                                  )}
                                  {event.location && (
                                    <div>📍 {event.location}</div>
                                  )}
                                </div>
                              </div>
                              <Link
                                href={`/events/${event.id}/attendance`}
                                className={`${actionItemLinkClassName} self-start flex-shrink-0`}
                              >
                                Take Attendance →
                              </Link>
                            </div>
                            {event.attendance && (
                              <div className="mt-2">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="font-medium">
                                    {event.attendance.present}/{event.attendance.totalAssigned} checked in
                                  </span>
                                  <span className="font-bold w-10 text-right">{event.attendance.completionRate}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${
                                      event.attendance.completionRate === 100
                                        ? 'bg-green-500'
                                        : event.attendance.completionRate >= 80
                                        ? 'bg-blue-500'
                                        : event.attendance.completionRate >= 50
                                        ? 'bg-yellow-500'
                                        : 'bg-red-500'
                                    }`}
                                    style={{ width: `${event.attendance.completionRate}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-2 sm:py-4 text-sm sm:text-base">No events scheduled for today</p>
                    )}

                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex justify-between items-center mb-3">
                        <CardTitle className="text-base sm:text-lg font-bold">📅 THIS WEEK</CardTitle>
                        <Link href="/events">
                          <Button size="sm" variant="primary" className="text-xs whitespace-nowrap min-w-[140px] justify-center">
                            View All
                          </Button>
                        </Link>
                      </div>
                      {dashboardData.events.next && dashboardData.events.next.length > 0 ? (
                        <div className="space-y-2">
                          {dashboardData.events.next.slice(0, 5).map((event: any) => (
                            <Link
                              key={event.id}
                              href={`/events/${event.id}`}
                              className="block p-2 rounded-lg border bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100 transition-colors"
                            >
                              <div className="flex justify-between items-center gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-gray-900 text-sm sm:text-base leading-tight truncate">
                                    {event.name}
                                  </div>
                                  <div className="text-xs text-gray-600 mt-0.5">{formatDate(event.startDate)}</div>
                                </div>
                                {event.attendance && (
                                  <div className="text-xs font-bold text-gray-700 flex-shrink-0 w-10 text-right">
                                    {event.attendance.completionRate}%
                                  </div>
                                )}
                              </div>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-4 text-sm">No upcoming events this week</p>
                      )}
                    </div>
                  </CardContent>
              </Card>
            </div>

            {/* Personal Notes + Quick Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 sm:gap-6 items-stretch">
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base sm:text-lg font-bold">📝 MY NOTES</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <RichNoteEditor
                    content={noteContent}
                    onChange={handleNoteChange}
                    saving={noteSaving}
                    saved={noteSaved}
                    placeholder="Write your notes here..."
                    compact={true}
                  />
                </CardContent>
              </Card>

              <Card className="p-3 sm:p-4 h-full border-[#e6e2f5]">
                <div className="space-y-3">
                  <div className="text-xs font-semibold tracking-wide text-[#6b6590] uppercase">
                    At a glance
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-center">
                      <div className="text-xl sm:text-2xl font-bold text-gray-900 leading-none">
                        {dashboardData.students.total}
                      </div>
                      <div className="mt-1 text-[11px] sm:text-xs text-gray-500">Students</div>
                    </div>
                    <div className="rounded-lg border border-[#e2d7fb] bg-[#faf7ff] px-2.5 py-2 text-center">
                      <div className="text-xl sm:text-2xl font-bold text-[#57068c] leading-none">
                        {dashboardData.events.total}
                      </div>
                      <div className="mt-1 text-[11px] sm:text-xs text-[#6f5b93]">Total events</div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {dashboardData.students.byCampus.map((campus) => (
                      <div
                        key={campus.campus}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5"
                      >
                        <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-gray-700 font-medium">
                          <span className="w-2 h-2 rounded-full bg-[#57068c]"></span>
                          {campus.campus === 'NYC' ? 'New York' : 'Shanghai'}
                        </span>
                        <span className="text-sm sm:text-base font-semibold text-gray-900">{campus.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
            </div>
          ) : (
            /* Staff (non-admin) dashboard */
            <div className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <Card>
                <CardHeader className="pb-2 sm:pb-4">
                  <CardTitle className="text-base sm:text-lg">Welcome to VSP EventOps</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm">
                    Staff operations platform for managing visiting NYU students, events, and attendance.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 sm:pb-4">
                  <CardTitle className="text-base sm:text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-2">
                    <Link href="/students" className="block">
                      <Button variant="outline" size="sm" className="w-full justify-start text-xs sm:text-sm">
                        👤 View Students
                      </Button>
                    </Link>
                    <Link href="/events" className="block">
                      <Button variant="outline" size="sm" className="w-full justify-start text-xs sm:text-sm">
                        📅 View Events
                      </Button>
                    </Link>
                    <Link href="/attendance/history" className="block">
                      <Button variant="outline" size="sm" className="w-full justify-start text-xs sm:text-sm">
                        📋 Attendance History
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              <Card className="sm:col-span-2 lg:col-span-1">
                <CardHeader className="pb-2 sm:pb-4">
                  <CardTitle className="text-base sm:text-lg">Your Role</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant="info" className="text-sm sm:text-lg px-3 sm:px-4 py-1 sm:py-2">
                    {user?.role?.toUpperCase() || 'GEO'}
                  </Badge>
                  <p className="text-xs sm:text-sm text-gray-500 mt-2 truncate">
                    {user?.email}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Personal Notes for Staff */}
            <Card>
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-base sm:text-lg font-bold">📝 MY NOTES</CardTitle>
              </CardHeader>
              <CardContent>
                <RichNoteEditor
                  content={noteContent}
                  onChange={handleNoteChange}
                  saving={noteSaving}
                  saved={noteSaved}
                  placeholder="Write your notes here..."
                />
              </CardContent>
            </Card>
            </div>
          )}
        </div>
      </PageLayout>
    </ProtectedRoute>
  );
}
