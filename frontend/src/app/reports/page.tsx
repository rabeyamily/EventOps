'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PageLayout from '@/components/layout/PageLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Select, Input, Spinner } from '@/components/ui';
import { getAdminDashboard, getRiskDashboard, AdminDashboardData, RiskDashboardData } from '@/lib/api/dashboard';
import { getEvents } from '@/lib/api/events';
import { exportEventAttendanceCSV } from '@/lib/api/attendance';
import { useIsAdmin } from '@/hooks/useAuth';
import { useViewingSemesterStore } from '@/store/viewing-semester-store';
import { formatDate } from '@/lib/utils';

type ReportType = 'overview' | 'attendance' | 'strikes' | 'students';

export default function ReportsPage() {
  const isAdmin = useIsAdmin();
  const viewingSemester = useViewingSemesterStore((s) => s.viewingSemester);
  const [reportType, setReportType] = useState<ReportType>('overview');
  const [loading, setLoading] = useState(true);
  const [adminData, setAdminData] = useState<AdminDashboardData | null>(null);
  const [riskData, setRiskData] = useState<RiskDashboardData | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    if (!viewingSemester) return;
    fetchData();
  }, [viewingSemester]);

  const fetchData = async () => {
    if (!viewingSemester) return;
    setLoading(true);
    try {
      const [admin, risk, eventsRes] = await Promise.all([
        getAdminDashboard(viewingSemester).catch(() => null),
        getRiskDashboard().catch(() => null),
        getEvents({ limit: 50, past: true }).catch(() => ({ data: [] })),
      ]);
      setAdminData(admin);
      setRiskData(risk);
      setEvents(eventsRes.data || []);
    } catch (err) {
      console.error('Failed to fetch report data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportAttendance = async () => {
    if (!selectedEventId) return;
    setExportLoading(true);
    try {
      const a = document.createElement('a');
      a.href = exportEventAttendanceCSV(selectedEventId);
      a.download = `attendance_${selectedEventId}.csv`;
      a.click();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExportLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <ProtectedRoute>
        <PageLayout title="Reports">
          <Card className="p-8 text-center">
            <p className="text-red-600">You do not have permission to view reports.</p>
            <Link href="/dashboard">
              <Button variant="outline" className="mt-4">Return to Dashboard</Button>
            </Link>
          </Card>
        </PageLayout>
      </ProtectedRoute>
    );
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <PageLayout title="Reports & Analytics" noBottomPadding>
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-[#57068c]" />
          </div>
        </PageLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <PageLayout title="Reports & Analytics" noBottomPadding>
        {/* Report Type Selector */}
        <Card className="mb-6 p-4">
          <div className="flex flex-wrap gap-2">
            {(['overview', 'attendance', 'strikes', 'students'] as ReportType[]).map((type) => (
              <Button
                key={type}
                variant={reportType === type ? 'primary' : 'outline'}
                onClick={() => setReportType(type)}
              >
                {type === 'overview' && '📊 Overview'}
                {type === 'attendance' && '📋 Attendance'}
                {type === 'strikes' && '⚠️ Strikes'}
                {type === 'students' && '👤 Students'}
              </Button>
            ))}
            <Link href="/reports/semester">
              <Button variant="outline">🎓 Semester Report</Button>
            </Link>
          </div>
        </Card>

        {/* Overview Report */}
        {reportType === 'overview' && adminData && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-6 text-center">
                <div className="text-4xl font-bold text-gray-900">{adminData.students.total}</div>
                <div className="text-gray-600 mt-1">Total Students</div>
              </Card>
              <Card className="p-6 text-center">
                <div className="text-4xl font-bold text-blue-600">{adminData.events.total}</div>
                <div className="text-gray-600 mt-1">Total Events</div>
              </Card>
              <Card className="p-6 text-center">
                <div className="text-4xl font-bold text-green-600">{adminData.attendance.rate}%</div>
                <div className="text-gray-600 mt-1">Avg Attendance Rate</div>
              </Card>
              <Card className="p-6 text-center">
                <div className="text-4xl font-bold text-red-600">{adminData.strikes.active}</div>
                <div className="text-gray-600 mt-1">Active Strikes</div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Students by Campus</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {adminData.students.byCampus.map((item) => (
                      <div key={item.campus} className="flex items-center justify-between">
                        <span className="text-gray-700">{item.campus}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-3 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-600 rounded-full"
                              style={{ width: `${(item.count / adminData.students.total) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-8">{item.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Students by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {adminData.students.byStatus.map((item) => (
                      <div key={item.status} className="flex items-center justify-between">
                        <Badge
                          variant={
                            item.status === 'clear' ? 'success' :
                            item.status === 'one_strike' ? 'warning' : 'danger'
                          }
                        >
                          {item.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <span className="text-lg font-bold">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Strike Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold">{adminData.strikes.total}</div>
                    <div className="text-sm text-gray-600">Total</div>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{adminData.strikes.active}</div>
                    <div className="text-sm text-red-700">Active</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{adminData.strikes.excused}</div>
                    <div className="text-sm text-green-700">Excused</div>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{adminData.strikes.thisWeek}</div>
                    <div className="text-sm text-yellow-700">This Week</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Attendance Report */}
        {reportType === 'attendance' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Export Event Attendance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Event</label>
                    <Select
                      value={selectedEventId}
                      onChange={(e) => setSelectedEventId(e.target.value)}
                      options={[
                        { value: '', label: 'n event...' },
                        ...events.map((e) => ({
                          value: e.id,
                          label: `${e.name} (${formatDate(e.startDate)})`,
                        })),
                      ]}
                    />
                  </div>
                  <Button
                    variant="primary"
                    onClick={handleExportAttendance}
                    disabled={!selectedEventId || exportLoading}
                    isLoading={exportLoading}
                  >
                    📥 Export CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            {adminData && (
              <Card>
                <CardHeader>
                  <CardTitle>Overall Attendance Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold">{adminData.attendance.total}</div>
                      <div className="text-sm text-gray-600">Total Records</div>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{adminData.attendance.present}</div>
                      <div className="text-sm text-green-700">Present</div>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{adminData.attendance.absent}</div>
                      <div className="text-sm text-red-700">Absent</div>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{adminData.attendance.rate}%</div>
                      <div className="text-sm text-blue-700">Attendance Rate</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {riskData && riskData.highAbsenceEvents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Events with High Absence Rates</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {riskData.highAbsenceEvents.map((event: any) => (
                      <Link
                        key={event.id}
                        href={`/events/${event.id}`}
                        className="block p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-gray-900">{event.name}</p>
                            <p className="text-sm text-gray-500">{formatDate(event.startDate)}</p>
                          </div>
                          <div className="text-right">
                            <Badge variant="danger">{event.absenceRate}% Absent</Badge>
                            <p className="text-xs text-gray-500 mt-1">
                              {event.absent}/{event.total} students
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Strikes Report */}
        {reportType === 'strikes' && riskData && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-6 text-center bg-yellow-50 border-yellow-200">
                <div className="text-4xl font-bold text-yellow-600">{riskData.summary.oneStrike}</div>
                <div className="text-yellow-700 mt-1">Students with 1 Strike</div>
              </Card>
              <Card className="p-6 text-center bg-red-50 border-red-200">
                <div className="text-4xl font-bold text-red-600">{riskData.summary.blocked}</div>
                <div className="text-red-700 mt-1">Blocked Students</div>
              </Card>
              <Card className="p-6 text-center">
                <div className="text-4xl font-bold text-gray-900">{riskData.summary.recentStrikes}</div>
                <div className="text-gray-600 mt-1">Recent Strikes</div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-yellow-700">⚠️ One Strike Warning</CardTitle>
                </CardHeader>
                <CardContent>
                  {riskData.oneStrikeStudents.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No students with one strike</p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {riskData.oneStrikeStudents.map((student: any) => (
                        <Link
                          key={student.id}
                          href={`/students/${student.id}`}
                          className="block p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
                        >
                          <p className="font-medium text-gray-900">{student.fullName}</p>
                          <p className="text-sm text-gray-500">{student.nyuEmail}</p>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-red-700">🚫 Blocked Students</CardTitle>
                </CardHeader>
                <CardContent>
                  {riskData.blockedStudents.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No blocked students</p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {riskData.blockedStudents.map((student: any) => (
                        <Link
                          key={student.id}
                          href={`/students/${student.id}`}
                          className="block p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium text-gray-900">{student.fullName}</p>
                              <p className="text-sm text-gray-500">{student.nyuEmail}</p>
                            </div>
                            <Badge variant="danger">{student.strikeCount} strikes</Badge>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Strikes</CardTitle>
              </CardHeader>
              <CardContent>
                {riskData.recentStrikes.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No recent strikes</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {riskData.recentStrikes.map((strike: any) => (
                          <tr key={strike.id}>
                            <td className="px-4 py-3">
                              <Link href={`/students/${strike.student?.id}`} className="text-primary-600 hover:underline">
                                {strike.student?.fullName}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {strike.event?.name}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {formatDate(strike.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={strike.isExcused ? 'success' : 'danger'}>
                                {strike.isExcused ? 'Excused' : 'Active'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Students Report */}
        {reportType === 'students' && adminData && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-6 text-center">
                <div className="text-4xl font-bold text-gray-900">{adminData.students.total}</div>
                <div className="text-gray-600 mt-1">Total Students</div>
              </Card>
              <Card className="p-6 text-center bg-green-50 border-green-200">
                <div className="text-4xl font-bold text-green-600">
                  {adminData.students.byStatus.find((s) => s.status === 'clear')?.count || 0}
                </div>
                <div className="text-green-700 mt-1">Clear Status</div>
              </Card>
              <Card className="p-6 text-center bg-yellow-50 border-yellow-200">
                <div className="text-4xl font-bold text-yellow-600">{adminData.students.oneStrike}</div>
                <div className="text-yellow-700 mt-1">One Strike</div>
              </Card>
              <Card className="p-6 text-center bg-red-50 border-red-200">
                <div className="text-4xl font-bold text-red-600">{adminData.students.blocked}</div>
                <div className="text-red-700 mt-1">Blocked</div>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Distribution by Campus</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {adminData.students.byCampus.map((item) => {
                    const percentage = Math.round((item.count / adminData.students.total) * 100);
                    return (
                      <div key={item.campus}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{item.campus}</span>
                          <span className="text-gray-500">{item.count} ({percentage}%)</span>
                        </div>
                        <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Quick Links</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Link href="/students">
                    <Button variant="outline" className="w-full">
                      👤 All Students
                    </Button>
                  </Link>
                  <Link href="/students/import">
                    <Button variant="outline" className="w-full">
                      📥 Import Students
                    </Button>
                  </Link>
                  <Link href="/strikes">
                    <Button variant="outline" className="w-full">
                      ⚠️ Manage Strikes
                    </Button>
                  </Link>
                  <Link href="/attendance/history">
                    <Button variant="outline" className="w-full">
                      📋 Attendance History
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </PageLayout>
    </ProtectedRoute>
  );
}

