#!/usr/bin/env node
/**
 * Long-form API stress + feature coverage for EventOps.
 * Run with stack up: docker compose up -d
 *   node scripts/stress-api-test.mjs
 * Optional: BASE_URL=http://127.0.0.1:3001 node scripts/stress-api-test.mjs
 */
const BASE = process.env.BASE_URL || 'http://localhost:3001';
const PASS = 'StressTest1!';

const jar = new Map();

function applySetCookie(res) {
  const fn = res.headers.getSetCookie?.bind(res.headers);
  const lines = typeof fn === 'function' ? fn() : [];
  if (!lines.length) {
    const sc = res.headers.get('set-cookie');
    if (sc) lines.push(sc);
  }
  for (const line of lines) {
    const [pair] = line.split(';');
    const eq = pair.indexOf('=');
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function api(method, path, { body, headers = {} } = {}) {
  const opts = {
    method,
    headers: {
      ...headers,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(jar.size ? { Cookie: cookieHeader() } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
  const res = await fetch(BASE + path, opts);
  applySetCookie(res);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text.slice(0, 500) };
  }
  return { status: res.status, json, text };
}

const results = [];

function log(ok, name, detail = '') {
  results.push({ ok, name, detail });
  const icon = ok ? '✓' : '✗';
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ''}`);
}

function must(cond, name, detail) {
  log(cond, name, detail);
  return cond;
}

async function main() {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const geoEmail = `geo_${suffix}@stress.test`;
  const adminEmail = `admin_${suffix}@stress.test`;

  // --- Public / health ---
  {
    const a = await api('GET', '/api/health');
    must(a.status === 200 && a.json?.status === 'ok', 'GET /api/health', `status=${a.status}`);
  }
  {
    const a = await api('GET', '/api/health/db');
    must(a.status === 200 && a.json?.database === 'connected', 'GET /api/health/db', `status=${a.status}`);
  }
  {
    const a = await api('GET', '/api/system-settings/current-semester');
    must(a.status === 200, 'GET /api/system-settings/current-semester', `status=${a.status}`);
  }
  {
    const a = await api('GET', '/api/system-settings/available-semesters');
    must(a.status === 200, 'GET /api/system-settings/available-semesters', `status=${a.status}`);
  }

  // --- Signup GEO + Admin ---
  {
    const a = await api('POST', '/api/auth/signup', {
      body: { email: geoEmail, password: PASS, fullName: 'Stress GEO', role: 'staff' },
    });
    must(a.status === 201 && a.json?.success, 'POST /api/auth/signup (GEO)', JSON.stringify(a.json).slice(0, 120));
  }
  {
    const a = await api('POST', '/api/auth/signup', {
      body: { email: adminEmail, password: PASS, fullName: 'Stress Admin', role: 'admin' },
    });
    must(a.status === 201 && a.json?.success, 'POST /api/auth/signup (admin)', JSON.stringify(a.json).slice(0, 120));
  }

  const geoId = (await api('POST', '/api/auth/login', { body: { email: geoEmail, password: PASS } })).json?.data
    ?.user?.id;
  jar.clear();
  const adminLogin = await api('POST', '/api/auth/login', { body: { email: adminEmail, password: PASS } });
  must(adminLogin.status === 200 && adminLogin.json?.success, 'POST /api/auth/login (admin)', `status=${adminLogin.status}`);
  const adminId = adminLogin.json?.data?.user?.id;
  must(Boolean(adminId), 'admin session has user id', String(adminId));

  const me = await api('GET', '/api/auth/me');
  must(me.status === 200 && me.json?.data?.user?.role === 'admin', 'GET /api/auth/me', me.json?.data?.user?.role);

  const lookup = await api('GET', `/api/auth/lookup-role?email=${encodeURIComponent(geoEmail)}`);
  must(lookup.status === 200 && lookup.json?.data?.role === 'staff', 'GET /api/auth/lookup-role', String(lookup.json?.data?.role));

  // --- Staff profile ---
  {
    const a = await api('PUT', '/api/staff/me', {
      body: { preferredName: 'SA', phone: '555-0100' },
    });
    must(a.status === 200, 'PUT /api/staff/me', `status=${a.status}`);
  }
  {
    const a = await api('GET', '/api/staff/me');
    must(a.status === 200, 'GET /api/staff/me', `status=${a.status}`);
  }

  // --- Students (admin) ---
  let studentId;
  {
    const a = await api('POST', '/api/students', {
      body: {
        fullName: `Student ${suffix}`,
        nyuEmail: `stu_${suffix}@nyu.edu`,
        campus: 'NYC',
        cohort: '2026',
      },
    });
    must(a.status === 201 || a.status === 200, 'POST /api/students', `status=${a.status}`);
    studentId = a.json?.data?.id ?? a.json?.data?.dataValues?.id ?? a.json?.id;
  }
  if (studentId && typeof studentId === 'object' && studentId.id) studentId = studentId.id;
  must(Boolean(studentId), 'student id captured', String(studentId));

  {
    const a = await api('GET', `/api/students/${studentId}`);
    must(a.status === 200, 'GET /api/students/:id', `status=${a.status}`);
  }
  {
    const a = await api('GET', `/api/students/${studentId}/attendance`);
    must(a.status === 200, 'GET /api/students/:id/attendance', `status=${a.status}`);
  }
  {
    const a = await api('GET', `/api/students/${studentId}/strikes`);
    must(a.status === 200, 'GET /api/students/:id/strikes', `status=${a.status}`);
  }
  {
    const a = await api('GET', '/api/students?limit=5');
    must(a.status === 200, 'GET /api/students', `status=${a.status}`);
  }
  {
    const a = await api('GET', '/api/students/search?search=nyu');
    must(a.status === 200, 'GET /api/students/search', `status=${a.status}`);
  }

  // --- Events (admin): bus_based for sheets + depart ---
  const start = new Date();
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setHours(end.getHours() + 3);
  let eventId;
  {
    const a = await api('POST', '/api/events', {
      body: {
        name: `Stress Event ${suffix}`,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        location: 'Test Hall',
        leadOrganizerId: geoId,
        attendanceMode: 'bus_based',
        notes: 'stress',
      },
    });
    must(a.status === 201 || a.status === 200, 'POST /api/events', `status=${a.status} ${JSON.stringify(a.json).slice(0, 200)}`);
    eventId = a.json?.data?.id ?? a.json?.data?.dataValues?.id ?? a.json?.id;
  }
  must(Boolean(eventId), 'event id captured', String(eventId));

  {
    const a = await api('GET', `/api/events/${eventId}`);
    must(a.status === 200, 'GET /api/events/:id', `status=${a.status}`);
  }
  {
    const a = await api('GET', '/api/events?limit=10');
    must(a.status === 200, 'GET /api/events', `status=${a.status}`);
  }
  {
    const a = await api('GET', `/api/events/calendar?year=${start.getFullYear()}&month=${start.getMonth() + 1}`);
    must(a.status === 200, 'GET /api/events/calendar', `status=${a.status}`);
  }
  {
    const a = await api('GET', '/api/events/upcoming?limit=10');
    must(a.status === 200, 'GET /api/events/upcoming', `status=${a.status}`);
  }

  // --- Assignments ---
  {
    const a = await api('POST', `/api/events/${eventId}/assignments/bulk`, {
      body: { mode: 'all' },
    });
    must(a.status === 200 || a.status === 201, 'POST /api/events/:id/assignments/bulk', `status=${a.status}`);
  }
  {
    const a = await api('GET', `/api/events/${eventId}/assignments`);
    must(a.status === 200, 'GET /api/events/:id/assignments', `status=${a.status}`);
  }
  {
    const a = await api('GET', `/api/events/${eventId}/unassigned`);
    must(a.status === 200, 'GET /api/events/:id/unassigned', `status=${a.status}`);
  }

  // --- Attendance sheets ---
  {
    const a = await api('POST', `/api/attendance-sheets/event/${eventId}/add-bus`);
    must(a.status === 200 || a.status === 201, 'POST /api/attendance-sheets/event/:id/add-bus', `status=${a.status}`);
  }
  let sheets = (await api('GET', `/api/attendance-sheets/event/${eventId}`)).json?.data;
  if (!Array.isArray(sheets)) sheets = sheets ? [sheets] : [];
  let sheetId = sheets[0]?.id;
  {
    const a = await api('GET', `/api/attendance-sheets/event/${eventId}/active`);
    must(a.status === 200, 'GET /api/attendance-sheets/event/:id/active', `status=${a.status}`);
  }
  if (sheetId) {
    const a = await api('POST', `/api/attendance-sheets/${sheetId}/activate`);
    must(a.status === 200, 'POST /api/attendance-sheets/:sheetId/activate', `status=${a.status}`);
  }

  // --- Attendance ---
  {
    const a = await api('GET', `/api/attendance/event/${eventId}`);
    must(a.status === 200, 'GET /api/attendance/event/:eventId', `status=${a.status}`);
  }
  {
    const a = await api('GET', `/api/attendance/event/${eventId}/summary`);
    must(a.status === 200, 'GET /api/attendance/event/:eventId/summary', `status=${a.status}`);
  }
  {
    const a = await api('POST', `/api/attendance/event/${eventId}/student/${studentId}`, {
      body: { status: 'present', notes: 'stress', isHandOffMode: false },
    });
    must(a.status === 200 || a.status === 201, 'POST mark attendance', `status=${a.status}`);
  }
  {
    const a = await api('POST', `/api/attendance/event/${eventId}/student/${studentId}/tap`, { body: {} });
    must(a.status === 200 || a.status === 201, 'POST tap attendance', `status=${a.status}`);
  }
  {
    const a = await api('POST', `/api/attendance/event/${eventId}/bulk`, {
      body: { studentIds: [studentId], status: 'present' },
    });
    must(a.status === 200 || a.status === 201, 'POST bulk attendance', `status=${a.status}`);
  }

  let attendanceId;
  {
    const r = await api('GET', `/api/attendance/event/${eventId}`);
    const list = r.json?.data?.attendances || r.json?.data?.attendance || [];
    const arr = Array.isArray(list) ? list : [];
    const row =
      arr.find((x) => (x.studentId || x.student?.id) === studentId) || arr[0];
    attendanceId = row?.id;
  }
  if (attendanceId) {
    const a = await api('PATCH', `/api/attendance/${attendanceId}/notes`, { body: { notes: 'stress-note' } });
    must(a.status === 200, 'PATCH attendance notes', `status=${a.status}`);
  } else {
    log(false, 'PATCH attendance notes', 'no attendance id (skipped)');
  }

  {
    const a = await api('GET', `/api/attendance/student/${studentId}`);
    must(a.status === 200, 'GET /api/attendance/student/:studentId', `status=${a.status}`);
  }
  {
    const a = await api('GET', `/api/attendance/event/${eventId}/export`);
    must(a.status === 200, 'GET /api/attendance/event/:eventId/export', `status=${a.status} len=${a.text?.length}`);
  }
  {
    const a = await api('GET', '/api/attendance/export');
    must(a.status === 200, 'GET /api/attendance/export', `status=${a.status}`);
  }

  // --- Dashboard ---
  {
    const a = await api('GET', '/api/dashboard/risk');
    must(a.status === 200, 'GET /api/dashboard/risk', `status=${a.status}`);
  }
  {
    const a = await api('GET', `/api/dashboard/event/${eventId}`);
    must(a.status === 200, 'GET /api/dashboard/event/:eventId', `status=${a.status}`);
  }
  {
    const a = await api('GET', `/api/dashboard/event-summary/${eventId}`);
    must(a.status === 200, 'GET /api/dashboard/event-summary/:eventId', `status=${a.status}`);
  }
  {
    const a = await api('GET', '/api/dashboard/admin');
    must(a.status === 200, 'GET /api/dashboard/admin', `status=${a.status}`);
  }

  // --- Strikes ---
  {
    const a = await api('GET', '/api/strikes/at-risk');
    must(a.status === 200, 'GET /api/strikes/at-risk', `status=${a.status}`);
  }
  {
    const a = await api('GET', `/api/strikes/student/${studentId}`);
    must(a.status === 200, 'GET /api/strikes/student/:studentId', `status=${a.status}`);
  }
  let strikeId;
  {
    const a = await api('POST', '/api/strikes', {
      body: { studentId, eventId, reason: 'stress' },
    });
    must(a.status === 200 || a.status === 201, 'POST /api/strikes', `status=${a.status}`);
    strikeId = a.json?.data?.id || a.json?.id;
  }
  if (strikeId) {
    const ex = await api('PATCH', `/api/strikes/${strikeId}/excuse`, { body: { reason: 'stress-excuse' } });
    must(ex.status === 200, 'PATCH /api/strikes/:id/excuse', `status=${ex.status}`);
    const re = await api('PATCH', `/api/strikes/${strikeId}/reinstate`);
    must(re.status === 200, 'PATCH /api/strikes/:id/reinstate', `status=${re.status}`);
    const del = await api('DELETE', `/api/strikes/${strikeId}`);
    must(del.status === 200 || del.status === 204, 'DELETE /api/strikes/:id', `status=${del.status}`);
  }

  {
    const a = await api('POST', `/api/strikes/event/${eventId}/process`);
    must(a.status === 200 || a.status === 201, 'POST /api/strikes/event/:eventId/process', `status=${a.status}`);
  }

  // --- Notifications ---
  {
    const a = await api('GET', '/api/notifications');
    must(a.status === 200, 'GET /api/notifications', `status=${a.status}`);
  }
  {
    const a = await api('GET', '/api/notifications/preferences');
    must(a.status === 200, 'GET /api/notifications/preferences', `status=${a.status}`);
  }
  {
    const a = await api('PUT', '/api/notifications/preferences', {
      body: { strikeAlerts: true, eventReminders: true, dailySummary: false, attendanceAlerts: true },
    });
    must(a.status === 200, 'PUT /api/notifications/preferences', `status=${a.status}`);
  }
  {
    const a = await api('POST', '/api/notifications/mark-all-read');
    must(a.status === 200, 'POST /api/notifications/mark-all-read', `status=${a.status}`);
  }
  {
    const a = await api('POST', '/api/notifications/daily-summary');
    must(a.status === 200 || a.status === 201, 'POST /api/notifications/daily-summary', `status=${a.status}`);
  }
  {
    const a = await api('POST', '/api/notifications/student-alerts');
    must(a.status === 200 || a.status === 201, 'POST /api/notifications/student-alerts', `status=${a.status}`);
  }

  // --- Personal agenda ---
  let agendaId;
  {
    const a = await api('POST', '/api/personal-agenda', {
      body: { title: `Task ${suffix}`, priority: 'high' },
    });
    must(a.status === 200 || a.status === 201, 'POST /api/personal-agenda', `status=${a.status}`);
    agendaId = a.json?.data?.id || a.json?.id;
  }
  {
    const a = await api('GET', '/api/personal-agenda');
    must(a.status === 200, 'GET /api/personal-agenda', `status=${a.status}`);
  }
  if (agendaId) {
    const a = await api('PUT', `/api/personal-agenda/${agendaId}`, { body: { completed: true, title: 'Done' } });
    must(a.status === 200, 'PUT /api/personal-agenda/:id', `status=${a.status}`);
    const d = await api('DELETE', `/api/personal-agenda/${agendaId}`);
    must(d.status === 200 || d.status === 204, 'DELETE /api/personal-agenda/:id', `status=${d.status}`);
  }

  // --- Staff notes ---
  {
    const a = await api('PUT', '/api/staff-notes', { body: { content: `note ${suffix}` } });
    must(a.status === 200, 'PUT /api/staff-notes', `status=${a.status}`);
  }
  {
    const a = await api('GET', '/api/staff-notes');
    must(a.status === 200, 'GET /api/staff-notes', `status=${a.status}`);
  }

  // --- Documents ---
  {
    const a = await api('GET', '/api/documents');
    must(a.status === 200, 'GET /api/documents', `status=${a.status}`);
  }
  let docId;
  {
    const a = await api('POST', '/api/documents', {
      body: {
        title: `Link ${suffix}`,
        url: 'https://example.com/doc',
        category: 'link',
      },
    });
    must(a.status === 200 || a.status === 201, 'POST /api/documents (link)', `status=${a.status}`);
    docId = a.json?.id || a.json?.data?.id;
  }
  if (docId) {
    const p = await api('PATCH', `/api/documents/${docId}`, { body: { title: `Link ${suffix} updated` } });
    must(p.status === 200, 'PATCH /api/documents/:id', `status=${p.status}`);
    const d = await api('DELETE', `/api/documents/${docId}`);
    must(d.status === 200 || d.status === 204, 'DELETE /api/documents/:id', `status=${d.status}`);
  }

  // --- System settings (admin) ---
  {
    const a = await api('GET', '/api/system-settings');
    must(a.status === 200, 'GET /api/system-settings', `status=${a.status}`);
  }
  {
    const a = await api('POST', '/api/system-settings/available-semesters', {
      body: { semester: 'Spring', academicYear: 2030 },
    });
    must([200, 201, 400].includes(a.status), 'POST /api/system-settings/available-semesters', `status=${a.status}`);
  }

  // --- Admin maintenance ---
  {
    const a = await api('POST', '/api/admin/recalculate-statuses');
    must(a.status === 200, 'POST /api/admin/recalculate-statuses', `status=${a.status}`);
  }

  // --- Staff directory ---
  {
    const a = await api('GET', `/api/staff/${geoId}/activity`);
    must(a.status === 200, 'GET /api/staff/:id/activity', `status=${a.status}`);
  }
  {
    const a = await api('GET', `/api/staff/${geoId}`);
    must(a.status === 200, 'GET /api/staff/:id', `status=${a.status}`);
  }
  {
    const a = await api('GET', '/api/staff?limit=20');
    must(a.status === 200, 'GET /api/staff', `status=${a.status}`);
  }

  // --- Semester report ---
  {
    const a = await api('GET', '/api/dashboard/semester-report');
    must(a.status === 200, 'GET /api/dashboard/semester-report', `status=${a.status}`);
  }

  // --- Event lifecycle: lock → depart → unlock ---
  {
    const a = await api('POST', `/api/events/${eventId}/lock`, { body: { reason: 'stress' } });
    must(a.status === 200, 'POST /api/events/:id/lock', `status=${a.status}`);
  }
  {
    const a = await api('POST', `/api/events/${eventId}/unlock`);
    must(a.status === 200, 'POST /api/events/:id/unlock', `status=${a.status}`);
  }
  {
    const a = await api('POST', `/api/events/${eventId}/depart`);
    must(a.status === 200, 'POST /api/events/:id/depart', `status=${a.status}`);
  }
  {
    const a = await api('POST', `/api/events/${eventId}/unlock`);
    must(a.status === 200, 'POST unlock after depart', `status=${a.status}`);
  }

  // --- Cleanup: clear assignments, delete sheets/bus, delete event, delete student ---
  {
    const a = await api('DELETE', `/api/events/${eventId}/assignments`);
    must(a.status === 200 || a.status === 204, 'DELETE clear assignments', `status=${a.status}`);
  }
  if (sheetId) {
    const a = await api('DELETE', `/api/attendance-sheets/${sheetId}`);
    must([200, 204, 400, 404].includes(a.status), 'DELETE sheet (cleanup)', `status=${a.status}`);
  }
  {
    const a = await api('DELETE', `/api/attendance-sheets/event/${eventId}/bus/${encodeURIComponent('Bus 1')}`);
    must([200, 204, 404].includes(a.status), 'DELETE bus (cleanup)', `status=${a.status}`);
  }
  {
    const a = await api('DELETE', `/api/events/${eventId}`);
    must(a.status === 200 || a.status === 204, 'DELETE /api/events/:id', `status=${a.status}`);
  }
  {
    const a = await api('DELETE', `/api/students/${studentId}`);
    must(a.status === 200 || a.status === 204, 'DELETE /api/students/:id', `status=${a.status}`);
  }

  // --- Logout ---
  {
    const a = await api('POST', '/api/auth/logout');
    must(a.status === 200, 'POST /api/auth/logout', `status=${a.status}`);
  }

  // --- GEO RBAC (after logout, login geo) ---
  jar.clear();
  const gLogin = await api('POST', '/api/auth/login', { body: { email: geoEmail, password: PASS } });
  must(gLogin.status === 200, 'POST login GEO', `status=${gLogin.status}`);
  {
    const a = await api('POST', '/api/students', {
      body: {
        fullName: 'Should Fail',
        nyuEmail: `denied_${suffix}@nyu.edu`,
        campus: 'NYC',
      },
    });
    must(a.status === 403, 'GEO POST /api/students is forbidden', `status=${a.status}`);
  }
  {
    const a = await api('GET', '/api/students?limit=2');
    must(a.status === 200, 'GEO GET /api/students', `status=${a.status}`);
  }

  // --- Burst concurrency (dev rate limit is high) ---
  const burstN = 120;
  const burst = await Promise.all(
    Array.from({ length: burstN }, () => fetch(`${BASE}/api/health`).then((r) => r.status))
  );
  const burstOk = burst.every((s) => s === 200);
  must(burstOk, `Concurrent GET /api/health x${burstN}`, `failures=${burst.filter((s) => s !== 200).length}`);

  jar.clear();
  await api('POST', '/api/auth/login', { body: { email: adminEmail, password: PASS } });
  const burst3 = await Promise.all(
    Array.from({ length: 80 }, () =>
      api('GET', '/api/events/upcoming?limit=3').then((r) => r.status)
    )
  );
  const authedBurstOk = burst3.every((s) => s === 200);
  must(authedBurstOk, 'Concurrent authenticated GET /api/events/upcoming x80', `fail=${burst3.filter((x) => x !== 200).length}`);

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log('\n--- Summary ---');
  console.log(`Passed: ${passed}  Failed: ${failed}  Total: ${results.length}`);
  if (failed) {
    console.log('\nFailures:');
    for (const r of results.filter((x) => !x.ok)) console.log(`  - ${r.name}: ${r.detail}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
