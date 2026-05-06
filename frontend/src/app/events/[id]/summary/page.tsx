'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PageLayout from '@/components/layout/PageLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import FullScreenLoading from '@/components/FullScreenLoading';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui';
import { getEventSummary, EventSummaryData } from '@/lib/api/dashboard';
import { formatDate, formatTime } from '@/lib/utils';
import { formatEventTeamLeadNames } from '@/lib/event-team-leaders';
import type { Event } from '@/types';

export default function EventSummaryPage() {
  const params = useParams();
  const eventId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<EventSummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (eventId) {
      fetchSummary();
    }
  }, [eventId]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const data = await getEventSummary(eventId);
      setSummary(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load event summary');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!summary) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const ev = summary.event;
    const att = summary.attendance;
    const teamLeadLabel = ev.teamLeadNames || formatEventTeamLeadNames(ev as Event) || 'N/A';

    const presentRows = summary.presentStudents.map(s =>
      `<tr><td style="padding:6px 8px;border:1px solid #ddd;">${s.fullName}</td><td style="padding:6px 8px;border:1px solid #ddd;">${s.nyuEmail}</td><td style="padding:6px 8px;border:1px solid #ddd;">${s.campus}</td></tr>`
    ).join('');

    const absentRows = summary.absentStudents.map(s =>
      `<tr><td style="padding:6px 8px;border:1px solid #ddd;">${s.fullName}</td><td style="padding:6px 8px;border:1px solid #ddd;">${s.nyuEmail}</td><td style="padding:6px 8px;border:1px solid #ddd;">${s.campus}</td><td style="padding:6px 8px;border:1px solid #ddd;">${s.note || ''}</td></tr>`
    ).join('');

    const campusRows = summary.campusBreakdown.map(c =>
      `<tr><td style="padding:6px 8px;border:1px solid #ddd;">${c.campus}</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:center;">${c.total}</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:center;">${c.present}</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:center;">${c.absent}</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-weight:bold;">${c.rate}%</td></tr>`
    ).join('');

    const strikeRows = summary.strikes.map(s =>
      `<tr><td style="padding:6px 8px;border:1px solid #ddd;">${s.studentName}</td><td style="padding:6px 8px;border:1px solid #ddd;">${s.studentEmail}</td><td style="padding:6px 8px;border:1px solid #ddd;">${s.isExcused ? 'Excused' : 'Active'}</td><td style="padding:6px 8px;border:1px solid #ddd;">${s.reason || ''}</td></tr>`
    ).join('');

    const notesRows = summary.absentWithNotes.map(n =>
      `<tr><td style="padding:6px 8px;border:1px solid #ddd;">${n.studentName}</td><td style="padding:6px 8px;border:1px solid #ddd;">${n.note}</td><td style="padding:6px 8px;border:1px solid #ddd;">${n.markedBy}</td></tr>`
    ).join('');

    printWindow.document.write(`
      <html><head><title>Event Summary - ${ev.name}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 1000px; margin: 0 auto; padding: 40px 20px; color: #333; }
        h1 { color: #57068c; border-bottom: 3px solid #57068c; padding-bottom: 10px; }
        h2 { color: #57068c; margin-top: 30px; font-size: 18px; }
        .meta { color: #666; margin: 4px 0; font-size: 14px; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
        .stat-box { padding: 16px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb; }
        .stat-box .value { font-size: 24px; font-weight: bold; }
        .stat-box .label { color: #666; font-size: 12px; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
        th { background: #57068c; color: white; padding: 8px; text-align: left; }
        .bar { height: 20px; border-radius: 4px; display: inline-block; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>📋 Event Summary: ${ev.name}</h1>
      <p class="meta">📅 ${formatDate(ev.startDate)}${ev.startTime ? ' at ' + ev.startTime : ''}</p>
      <p class="meta">📍 ${ev.location || 'N/A'}</p>
      <p class="meta">👤 Team leaders: ${teamLeadLabel}</p>
      <p class="meta" style="color:#999;">Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

      <div class="stats-grid">
        <div class="stat-box"><div class="value">${att.totalAssigned}</div><div class="label">Total Assigned</div></div>
        <div class="stat-box"><div class="value" style="color:#16a34a;">${att.present}</div><div class="label">Present</div></div>
        <div class="stat-box"><div class="value" style="color:#dc2626;">${att.absent}</div><div class="label">Absent</div></div>
        <div class="stat-box"><div class="value" style="color:#2563eb;">${att.attendanceRate}%</div><div class="label">Attendance Rate</div></div>
      </div>

      ${summary.campusBreakdown.length > 0 ? `
        <h2>Campus Breakdown</h2>
        <table><thead><tr><th>Campus</th><th style="text-align:center;">Total</th><th style="text-align:center;">Present</th><th style="text-align:center;">Absent</th><th style="text-align:center;">Rate</th></tr></thead>
        <tbody>${campusRows}</tbody></table>
      ` : ''}

      ${summary.absentWithNotes.length > 0 ? `
        <h2>📝 Absence Notes</h2>
        <table><thead><tr><th>Student</th><th>Note</th><th>Marked By</th></tr></thead>
        <tbody>${notesRows}</tbody></table>
      ` : ''}

      ${summary.strikes.length > 0 ? `
        <h2>⚠️ Strikes from this Event</h2>
        <table><thead><tr><th>Student</th><th>Email</th><th>Status</th><th>Reason</th></tr></thead>
        <tbody>${strikeRows}</tbody></table>
      ` : ''}

      ${summary.atRiskStudents.length > 0 ? `
        <h2>🚨 At-Risk Students</h2>
        <table><thead><tr><th>Student</th><th>Email</th><th>Strikes</th><th>Status</th><th>Attendance</th></tr></thead>
        <tbody>${summary.atRiskStudents.map(s =>
          `<tr><td style="padding:6px 8px;border:1px solid #ddd;">${s.fullName}</td><td style="padding:6px 8px;border:1px solid #ddd;">${s.nyuEmail}</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:center;">${s.strikeCount}</td><td style="padding:6px 8px;border:1px solid #ddd;">${s.status}</td><td style="padding:6px 8px;border:1px solid #ddd;">${s.attendanceStatus}</td></tr>`
        ).join('')}</tbody></table>
      ` : ''}

      <h2>✅ Present Students (${att.present})</h2>
      <table><thead><tr><th>Name</th><th>Email</th><th>Campus</th></tr></thead>
      <tbody>${presentRows || '<tr><td colspan="3" style="padding:8px;text-align:center;color:#999;">None</td></tr>'}</tbody></table>

      <h2>❌ Absent Students (${att.absent})</h2>
      <table><thead><tr><th>Name</th><th>Email</th><th>Campus</th><th>Note</th></tr></thead>
      <tbody>${absentRows || '<tr><td colspan="4" style="padding:8px;text-align:center;color:#999;">None</td></tr>'}</tbody></table>

      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  if (loading) {
    return <ProtectedRoute><FullScreenLoading /></ProtectedRoute>;
  }

  if (error || !summary) {
    return (
      <ProtectedRoute>
        <PageLayout title="Event Summary">
          <Card className="p-8 text-center">
            <p className="text-red-600">{error || 'Failed to load event summary.'}</p>
            <Link href={`/events/${eventId}`}><Button variant="outline" className="mt-4">Back to Event</Button></Link>
          </Card>
        </PageLayout>
      </ProtectedRoute>
    );
  }

  const ev = summary.event;
  const att = summary.attendance;
  const teamLeadDisplay = ev.teamLeadNames || formatEventTeamLeadNames(ev as Event);

  return (
    <ProtectedRoute>
      <PageLayout title={`Event Summary: ${ev.name}`}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{ev.name}</h1>
              <div className="flex flex-wrap gap-3 text-sm text-gray-600 mt-1">
                <span>📅 {formatDate(ev.startDate)}{ev.startTime ? ` at ${formatTime(ev.startTime)}` : ''}</span>
                {ev.location && <span>📍 {ev.location}</span>}
                {teamLeadDisplay ? <span>👤 {teamLeadDisplay}</span> : null}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" onClick={handleDownloadPDF}>📄 Download as PDF</Button>
              <Link href={`/events/${eventId}`}><Button variant="outline">Back to Event</Button></Link>
            </div>
          </div>

          {/* Attendance Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-5 text-center">
              <div className="text-3xl font-bold text-gray-900">{att.totalAssigned}</div>
              <div className="text-sm text-gray-600 mt-1">Total Assigned</div>
            </Card>
            <Card className="p-5 text-center bg-green-50 border-green-200">
              <div className="text-3xl font-bold text-green-600">{att.present}</div>
              <div className="text-sm text-green-700 mt-1">Present</div>
            </Card>
            <Card className="p-5 text-center bg-red-50 border-red-200">
              <div className="text-3xl font-bold text-red-600">{att.absent}</div>
              <div className="text-sm text-red-700 mt-1">Absent</div>
            </Card>
            <Card className="p-5 text-center bg-blue-50 border-blue-200">
              <div className="text-3xl font-bold text-blue-600">{att.attendanceRate}%</div>
              <div className="text-sm text-blue-700 mt-1">Attendance Rate</div>
            </Card>
          </div>

          {/* Attendance Bar */}
          <Card className="p-4">
            <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden flex">
              {att.totalAssigned > 0 && (
                <>
                  <div
                    className="bg-green-500 h-full flex items-center justify-center text-white text-xs font-medium"
                    style={{ width: `${(att.present / att.totalAssigned) * 100}%` }}
                  >
                    {att.present > 0 && `${att.present}`}
                  </div>
                  <div
                    className="bg-red-500 h-full flex items-center justify-center text-white text-xs font-medium"
                    style={{ width: `${(att.absent / att.totalAssigned) * 100}%` }}
                  >
                    {att.absent > 0 && `${att.absent}`}
                  </div>
                  {att.notMarked > 0 && (
                    <div
                      className="bg-gray-400 h-full flex items-center justify-center text-white text-xs font-medium"
                      style={{ width: `${(att.notMarked / att.totalAssigned) * 100}%` }}
                    >
                      {att.notMarked}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-4 mt-2 text-xs text-gray-600">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block"></span> Present</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block"></span> Absent</span>
              {att.notMarked > 0 && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-400 inline-block"></span> Not Marked</span>}
            </div>
          </Card>

          {/* Campus Breakdown */}
          {summary.campusBreakdown.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Campus Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary.campusBreakdown.map(c => (
                    <div key={c.campus} className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">{c.campus}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">{c.present}/{c.total} present</span>
                        <Badge variant={c.rate >= 80 ? 'success' : c.rate >= 50 ? 'warning' : 'danger'}>
                          {c.rate}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Absence Notes */}
          {summary.absentWithNotes.length > 0 && (
            <Card className="border-orange-200">
              <CardHeader>
                <CardTitle className="text-orange-700">📝 Absence Notes ({summary.absentWithNotes.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {summary.absentWithNotes.map((n, i) => (
                    <div key={i} className="p-3 bg-orange-50 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">{n.studentName}</p>
                          <p className="text-sm text-gray-500">{n.studentEmail}</p>
                        </div>
                        <span className="text-xs text-gray-400">by {n.markedBy}</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1 italic">&ldquo;{n.note}&rdquo;</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Strikes */}
          {summary.strikes.length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-700">⚠️ Strikes ({summary.strikes.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {summary.strikes.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{s.studentName}</p>
                        <p className="text-sm text-gray-500">{s.studentEmail}</p>
                        {s.reason && <p className="text-sm text-gray-600 mt-1">{s.reason}</p>}
                      </div>
                      <Badge variant={s.isExcused ? 'success' : 'danger'}>
                        {s.isExcused ? 'Excused' : 'Active'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* At-Risk Students */}
          {summary.atRiskStudents.length > 0 && (
            <Card className="border-orange-200">
              <CardHeader>
                <CardTitle className="text-orange-700">🚨 At-Risk Students ({summary.atRiskStudents.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Strikes</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Attendance</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {summary.atRiskStudents.map(s => (
                        <tr key={s.id}>
                          <td className="px-4 py-3">
                            <Link href={`/students/${s.id}`} className="text-[#57068c] hover:underline font-medium">
                              {s.fullName}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{s.nyuEmail}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={s.strikeCount >= 2 ? 'danger' : 'warning'}>{s.strikeCount}</Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={s.status === 'blocked' ? 'danger' : s.status === 'one_strike' ? 'warning' : 'success'}>
                              {s.status.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={s.attendanceStatus === 'present' ? 'success' : 'danger'}>
                              {s.attendanceStatus}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Student Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-700">✅ Present ({att.present})</CardTitle>
              </CardHeader>
              <CardContent>
                {summary.presentStudents.length > 0 ? (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {summary.presentStudents.map(s => (
                      <div key={s.id} className="flex justify-between items-center p-2 bg-green-50 rounded text-sm">
                        <Link href={`/students/${s.id}`} className="font-medium text-gray-900 hover:text-[#57068c]">
                          {s.fullName}
                        </Link>
                        <span className="text-gray-500 text-xs">{s.campus}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4 text-sm">No students present</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-red-700">❌ Absent ({att.absent})</CardTitle>
              </CardHeader>
              <CardContent>
                {summary.absentStudents.length > 0 ? (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {summary.absentStudents.map(s => (
                      <div key={s.id} className="p-2 bg-red-50 rounded text-sm">
                        <div className="flex justify-between items-center">
                          <Link href={`/students/${s.id}`} className="font-medium text-gray-900 hover:text-[#57068c]">
                            {s.fullName}
                          </Link>
                          <span className="text-gray-500 text-xs">{s.campus}</span>
                        </div>
                        {s.note && <p className="text-xs text-gray-500 mt-1 italic">Note: {s.note}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4 text-sm">No students absent</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </PageLayout>
    </ProtectedRoute>
  );
}
