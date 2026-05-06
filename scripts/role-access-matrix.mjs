#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const REPORTS_DIR = path.resolve(process.cwd(), 'reports');
const PASS = 'TestPass1!';

function createClient() {
  const jar = new Map();
  const setCookies = (res) => {
    const vals = res.headers.getSetCookie?.() || [];
    if (vals.length === 0) {
      const sc = res.headers.get('set-cookie');
      if (sc) vals.push(sc);
    }
    for (const line of vals) {
      const [pair] = line.split(';');
      const idx = pair.indexOf('=');
      if (idx > 0) jar.set(pair.slice(0, idx), pair.slice(idx + 1));
    }
  };
  const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  const req = async (method, p, body) => {
    const headers = {};
    if (jar.size) headers.Cookie = cookieHeader();
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${BASE}${p}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    setCookies(res);
    let json = null;
    const text = await res.text();
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: res.status, json, text };
  };
  return { req };
}

function classify(status) {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  return 'allowed_or_validated';
}

async function main() {
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const adminEmail = `role.admin.${suffix}@test.local`;
  const geoEmail = `role.geo.${suffix}@test.local`;

  // Bootstrap accounts
  const anon = createClient();
  await anon.req('POST', '/api/auth/signup', { email: adminEmail, password: PASS, fullName: 'Role Admin', role: 'admin' });
  await anon.req('POST', '/api/auth/signup', { email: geoEmail, password: PASS, fullName: 'Role GEO', role: 'staff' });

  const admin = createClient();
  const geo = createClient();
  await admin.req('POST', '/api/auth/login', { email: adminEmail, password: PASS, role: 'admin' });
  await geo.req('POST', '/api/auth/login', { email: geoEmail, password: PASS, role: 'staff' });

  // IDs for endpoint probes
  const firstEvent = await admin.req('GET', '/api/events?limit=1');
  const firstStudent = await admin.req('GET', '/api/students?limit=1');
  const eventId = firstEvent.json?.data?.[0]?.id;
  const studentId = firstStudent.json?.data?.[0]?.id;
  const fakeId = '00000000-0000-0000-0000-000000000001';
  const targetEvent = eventId || fakeId;
  const targetStudent = studentId || fakeId;

  const checks = [
    ['GET', '/api/dashboard/risk', 'Dashboard risk'],
    ['GET', '/api/dashboard/admin', 'Dashboard admin'],
    ['GET', '/api/students?limit=5', 'Students list'],
    ['POST', '/api/students', 'Create student', { fullName: 'Role Test Student', nyuEmail: `role.student.${suffix}@nyu.edu`, campus: 'NYC' }],
    ['GET', `/api/students/${targetStudent}`, 'Student detail'],
    ['DELETE', `/api/students/${targetStudent}`, 'Delete student'],
    ['GET', '/api/events?limit=5', 'Events list'],
    ['POST', '/api/events', 'Create event', { name: `Role test ${suffix}`, startDate: new Date().toISOString(), leadOrganizerId: (await admin.req('GET', '/api/staff?limit=1')).json?.data?.[0]?.id || fakeId, attendanceMode: 'bus_based' }],
    ['GET', `/api/events/${targetEvent}`, 'Event detail'],
    ['POST', `/api/events/${targetEvent}/lock`, 'Lock event', { reason: 'role-matrix' }],
    ['POST', `/api/events/${targetEvent}/unlock`, 'Unlock event'],
    ['POST', `/api/events/${targetEvent}/assignments`, 'Assign student', { studentId: targetStudent }],
    ['POST', `/api/events/${targetEvent}/assignments/bulk`, 'Bulk assign students', { mode: 'all' }],
    ['DELETE', `/api/events/${targetEvent}/assignments`, 'Clear assignments'],
    ['GET', '/api/attendance/export', 'Attendance export'],
    ['POST', '/api/strikes', 'Create strike', { studentId: targetStudent, eventId: targetEvent, reason: 'role-matrix' }],
    ['POST', '/api/strikes/event/' + targetEvent + '/process', 'Process strikes'],
    ['GET', '/api/documents', 'Documents list'],
    ['POST', '/api/documents', 'Create document link', { title: 'Role matrix doc', url: 'https://example.com', category: 'link' }],
    ['GET', '/api/staff?limit=5', 'Staff list'],
    ['POST', '/api/staff', 'Create staff', { fullName: 'Role Matrix Staff', email: `role.staff.${suffix}@nyu.edu`, role: 'staff' }],
    ['GET', '/api/system-settings', 'System settings all'],
    ['PUT', '/api/system-settings/current-semester', 'Set current semester', { semester: 'Fall', academicYear: 2026 }],
    ['POST', '/api/admin/recalculate-statuses', 'Admin recalculate statuses'],
    ['GET', '/api/notifications', 'Notifications list'],
    ['POST', '/api/notifications/daily-summary', 'Generate daily summary'],
    ['GET', '/api/personal-agenda', 'Personal agenda list'],
    ['POST', '/api/personal-agenda', 'Create personal agenda', { title: 'Role task', priority: 'low' }],
  ];

  const matrix = [];
  for (const [method, endpoint, label, body] of checks) {
    const a = await admin.req(method, endpoint, body);
    const g = await geo.req(method, endpoint, body);
    matrix.push({
      label,
      method,
      endpoint,
      admin_status: a.status,
      geo_status: g.status,
      admin_access: classify(a.status),
      geo_access: classify(g.status),
    });
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    adminEmail,
    geoEmail,
    totalChecks: matrix.length,
    adminForbiddenCount: matrix.filter((m) => m.admin_status === 403).length,
    geoForbiddenCount: matrix.filter((m) => m.geo_status === 403).length,
  };

  const outJson = path.join(REPORTS_DIR, 'role-access-matrix.json');
  fs.writeFileSync(outJson, JSON.stringify({ summary, matrix }, null, 2));

  const lines = [];
  lines.push('# Role Access Matrix (Admin vs GEO)');
  lines.push('');
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push(`Base URL: ${BASE}`);
  lines.push('');
  lines.push('| Feature | Method | Endpoint | Admin | GEO |');
  lines.push('|---|---|---|---:|---:|');
  for (const r of matrix) {
    lines.push(`| ${r.label} | ${r.method} | \`${r.endpoint}\` | ${r.admin_status} | ${r.geo_status} |`);
  }
  const outMd = path.join(REPORTS_DIR, 'role-access-matrix.md');
  fs.writeFileSync(outMd, lines.join('\n'));

  console.log(`Wrote ${outJson}`);
  console.log(`Wrote ${outMd}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
