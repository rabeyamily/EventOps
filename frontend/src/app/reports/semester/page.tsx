'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PageLayout from '@/components/layout/PageLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import FullScreenLoading from '@/components/FullScreenLoading';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Select } from '@/components/ui';
import { getSemesterReport, SemesterReportData } from '@/lib/api/dashboard';
import { getAvailableSemesters } from '@/lib/api/system-settings';
import { useIsAdmin } from '@/hooks/useAuth';
import { formatDate } from '@/lib/utils';

export default function SemesterReportPage() {
  const isAdmin = useIsAdmin();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<SemesterReportData | null>(null);
  const [semesters, setSemesters] = useState<string[]>([]);
  const [selectedSemester, setSelectedSemester] = useState('');
  const [generating, setGenerating] = useState(false);

  const headerBack = (
    <Link href="/reports">
      <Button variant="outline" size="sm" className="text-xs sm:text-sm whitespace-nowrap">
        ← Back to Reports
      </Button>
    </Link>
  );

  useEffect(() => {
    getAvailableSemesters().then(list => {
      setSemesters(list);
      if (list.length > 0) setSelectedSemester(list[0]);
    }).catch(() => {});
    setLoading(false);
  }, []);

  const handleGenerate = async () => {
    if (!selectedSemester) return;
    setGenerating(true);
    try {
      const data = await getSemesterReport(selectedSemester);
      setReport(data);
    } catch (err) {
      console.error('Failed to fetch semester report:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!report) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const eventsRows = report.events.map(e =>
      `<tr>
        <td style="padding:8px;border:1px solid #ddd;">${e.name}</td>
        <td style="padding:8px;border:1px solid #ddd;">${formatDate(e.startDate)}</td>
        <td style="padding:8px;border:1px solid #ddd;">${e.location || 'N/A'}</td>
        <td style="padding:8px;border:1px solid #ddd;">${e.leadOrganizer}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center;">${e.totalAssigned}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center;">${e.present}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center;">${e.absent}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center;font-weight:bold;">${e.attendanceRate}%</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center;">${e.strikeCount}</td>
      </tr>`
    ).join('');

    printWindow.document.write(`
      <html><head><title>Semester Report - ${report.semester}</title>
      <style>
        @page { margin: 18mm; }
        * { box-sizing: border-box; }
        html, body { margin: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          max-width: 1100px;
          margin: 0 auto;
          padding: 48px 40px 56px;
          color: #333;
        }
        h1 { color: #57068c; border-bottom: 3px solid #57068c; padding-bottom: 10px; }
        h2 { color: #57068c; margin-top: 30px; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
        .stat-box { padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb; }
        .stat-box .value { font-size: 28px; font-weight: bold; }
        .stat-box .label { color: #666; font-size: 13px; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
        th { background: #57068c; color: white; padding: 10px 8px; text-align: left; }
        .highlight { background: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px; padding: 16px; margin: 16px 0; }
        .highlight-bad { background: #fef2f2; border: 2px solid #ef4444; }
        @media print {
          body { padding: 12mm 14mm 16mm; }
        }
      </style></head><body>
      <h1>📊 Semester Report: ${report.semester}</h1>
      <p style="color:#666;">Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

      <div class="stats-grid">
        <div class="stat-box"><div class="value">${report.summary.totalEvents}</div><div class="label">Total Events</div></div>
        <div class="stat-box"><div class="value">${report.summary.totalStudents}</div><div class="label">Total Students</div></div>
        <div class="stat-box"><div class="value" style="color:#16a34a;">${report.summary.overallAttendanceRate}%</div><div class="label">Overall Attendance</div></div>
        <div class="stat-box"><div class="value" style="color:#dc2626;">${report.summary.totalStrikes}</div><div class="label">Total Strikes</div></div>
      </div>

      <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr);">
        <div class="stat-box"><div class="value" style="color:#f59e0b;">${report.summary.oneStrikeStudents}</div><div class="label">Students with 1 Strike</div></div>
        <div class="stat-box"><div class="value" style="color:#dc2626;">${report.summary.blockedStudents}</div><div class="label">Blocked Students</div></div>
      </div>

      ${report.mostSuccessfulEvent ? `
        <div class="highlight">
          <h2 style="margin-top:0;">🏆 Most Successful Event</h2>
          <p><strong>${report.mostSuccessfulEvent.name}</strong> — ${formatDate(report.mostSuccessfulEvent.startDate)}</p>
          <p>Attendance Rate: <strong>${report.mostSuccessfulEvent.attendanceRate}%</strong> (${report.mostSuccessfulEvent.present}/${report.mostSuccessfulEvent.totalAssigned} students)</p>
          <p>Location: ${report.mostSuccessfulEvent.location || 'N/A'} | Lead: ${report.mostSuccessfulEvent.leadOrganizer}</p>
        </div>
      ` : ''}

      ${report.leastSuccessfulEvent ? `
        <div class="highlight highlight-bad">
          <h2 style="margin-top:0;">📉 Least Successful Event</h2>
          <p><strong>${report.leastSuccessfulEvent.name}</strong> — ${formatDate(report.leastSuccessfulEvent.startDate)}</p>
          <p>Attendance Rate: <strong>${report.leastSuccessfulEvent.attendanceRate}%</strong></p>
        </div>
      ` : ''}

      <h2>📋 All Events</h2>
      <table>
        <thead><tr>
          <th>Event</th><th>Date</th><th>Location</th><th>Lead</th><th>Assigned</th><th>Present</th><th>Absent</th><th>Rate</th><th>Strikes</th>
        </tr></thead>
        <tbody>${eventsRows}</tbody>
      </table>
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  if (!isAdmin) {
    return (
      <ProtectedRoute>
        <PageLayout title="Semester Report" noBottomPadding actions={headerBack}>
          <Card className="p-8 text-center">
            <p className="text-red-600">You do not have permission to view this report.</p>
            <Link href="/dashboard"><Button variant="outline" className="mt-4">Return to Dashboard</Button></Link>
          </Card>
        </PageLayout>
      </ProtectedRoute>
    );
  }

  if (loading) {
    return <ProtectedRoute><FullScreenLoading /></ProtectedRoute>;
  }

  return (
    <ProtectedRoute>
      <PageLayout title="Semester Report" noBottomPadding actions={headerBack}>
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Semester</label>
                <Select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                  options={semesters.map(s => ({ value: s, label: s }))}
                />
              </div>
              <Button variant="primary" onClick={handleGenerate} isLoading={generating}>
                Generate Report
              </Button>
              {report && (
                <Button variant="outline" onClick={handleDownloadPDF}>
                  📄 Download as PDF
                </Button>
              )}
            </div>
          </Card>

          {report && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-6 text-center">
                  <div className="text-3xl font-bold text-gray-900">{report.summary.totalEvents}</div>
                  <div className="text-sm text-gray-600 mt-1">Total Events</div>
                </Card>
                <Card className="p-6 text-center">
                  <div className="text-3xl font-bold text-blue-600">{report.summary.totalStudents}</div>
                  <div className="text-sm text-gray-600 mt-1">Total Students</div>
                </Card>
                <Card className="p-6 text-center">
                  <div className="text-3xl font-bold text-green-600">{report.summary.overallAttendanceRate}%</div>
                  <div className="text-sm text-gray-600 mt-1">Overall Attendance</div>
                </Card>
                <Card className="p-6 text-center">
                  <div className="text-3xl font-bold text-red-600">{report.summary.totalStrikes}</div>
                  <div className="text-sm text-gray-600 mt-1">Total Strikes</div>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {report.mostSuccessfulEvent && (
                  <Card className="border-2 border-green-300 bg-green-50/30">
                    <CardHeader>
                      <CardTitle className="text-green-700">🏆 Most Successful Event</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Link href={`/events/${report.mostSuccessfulEvent.id}`} className="hover:underline">
                        <h3 className="text-lg font-bold text-gray-900">{report.mostSuccessfulEvent.name}</h3>
                      </Link>
                      <p className="text-sm text-gray-600 mt-1">{formatDate(report.mostSuccessfulEvent.startDate)} • {report.mostSuccessfulEvent.location || 'N/A'}</p>
                      <p className="text-sm text-gray-600">Lead: {report.mostSuccessfulEvent.leadOrganizer}</p>
                      <div className="mt-3 flex items-center gap-4">
                        <div className="text-2xl font-bold text-green-600">{report.mostSuccessfulEvent.attendanceRate}%</div>
                        <div className="text-sm text-gray-600">
                          {report.mostSuccessfulEvent.present}/{report.mostSuccessfulEvent.totalAssigned} present
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {report.leastSuccessfulEvent && (
                  <Card className="border-2 border-red-300 bg-red-50/30">
                    <CardHeader>
                      <CardTitle className="text-red-700">📉 Needs Improvement</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Link href={`/events/${report.leastSuccessfulEvent.id}`} className="hover:underline">
                        <h3 className="text-lg font-bold text-gray-900">{report.leastSuccessfulEvent.name}</h3>
                      </Link>
                      <p className="text-sm text-gray-600 mt-1">{formatDate(report.leastSuccessfulEvent.startDate)}</p>
                      <div className="mt-3">
                        <div className="text-2xl font-bold text-red-600">{report.leastSuccessfulEvent.attendanceRate}%</div>
                        <div className="text-sm text-gray-600">attendance rate</div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card className="p-6 text-center bg-yellow-50 border-yellow-200">
                  <div className="text-3xl font-bold text-yellow-600">{report.summary.oneStrikeStudents}</div>
                  <div className="text-sm text-yellow-700 mt-1">Students with 1 Strike</div>
                </Card>
                <Card className="p-6 text-center bg-red-50 border-red-200">
                  <div className="text-3xl font-bold text-red-600">{report.summary.blockedStudents}</div>
                  <div className="text-sm text-red-700 mt-1">Blocked Students</div>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>All Events Ranked by Attendance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Assigned</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Present</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rate</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Strikes</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {report.events
                          .sort((a, b) => b.attendanceRate - a.attendanceRate)
                          .map((event, i) => (
                          <tr key={event.id} className={i === 0 ? 'bg-green-50' : ''}>
                            <td className="px-4 py-3 text-sm font-medium">{i + 1}</td>
                            <td className="px-4 py-3">
                              <Link href={`/events/${event.id}`} className="text-[#57068c] hover:underline font-medium text-sm">
                                {event.name}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">{formatDate(event.startDate)}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{event.leadOrganizer}</td>
                            <td className="px-4 py-3 text-sm text-center">{event.totalAssigned}</td>
                            <td className="px-4 py-3 text-sm text-center text-green-600 font-medium">{event.present}</td>
                            <td className="px-4 py-3 text-center">
                              <Badge variant={event.attendanceRate >= 80 ? 'success' : event.attendanceRate >= 50 ? 'warning' : 'danger'}>
                                {event.attendanceRate}%
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm text-center">
                              {event.strikeCount > 0 ? (
                                <Badge variant="danger">{event.strikeCount}</Badge>
                              ) : (
                                <span className="text-gray-400">0</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </PageLayout>
    </ProtectedRoute>
  );
}
