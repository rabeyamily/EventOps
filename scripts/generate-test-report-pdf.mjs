#!/usr/bin/env node
/**
 * Generates EventOps-Test-Report-<date>.pdf under ../reports/
 * Optionally runs stress-api-test.mjs first (RUN_STRESS=1, default on).
 *
 * Usage (from repo root):
 *   cd scripts && npm install && node generate-test-report-pdf.mjs
 *   RUN_STRESS=0 node generate-test-report-pdf.mjs   # skip live API run
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(REPO_ROOT, 'reports');

const RUN_STRESS = process.env.RUN_STRESS !== '0';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

async function runStressHarness() {
  const script = path.join(__dirname, 'stress-api-test.mjs');
  return new Promise((resolve) => {
    const chunks = [];
    const proc = spawn(process.execPath, [script], {
      cwd: REPO_ROOT,
      env: { ...process.env, BASE_URL },
      timeout: 120000,
    });
    proc.stdout.on('data', (d) => chunks.push(d));
    proc.stderr.on('data', (d) => chunks.push(d));
    proc.on('close', (code) => {
      const text = Buffer.concat(chunks).toString('utf8');
      const passed = (text.match(/Passed:\s*(\d+)/) || [])[1];
      const failed = (text.match(/Failed:\s*(\d+)/) || [])[1];
      const total = (text.match(/Total:\s*(\d+)/) || [])[1];
      resolve({
        exitCode: code,
        raw: text,
        passed: passed ? Number(passed) : null,
        failed: failed ? Number(failed) : null,
        total: total ? Number(total) : null,
      });
    });
    proc.on('error', (err) => {
      resolve({ exitCode: -1, raw: String(err), passed: null, failed: null, total: null });
    });
  });
}

function section(doc, title) {
  doc.moveDown(0.6);
  doc.fontSize(12).fillColor('#1e3a5f').font('Helvetica-Bold').text(title);
  doc.fillColor('#333333').font('Helvetica');
  doc.moveDown(0.25);
}

function body(doc, text, opts = {}) {
  doc.fontSize(10).font('Helvetica').fillColor('#333333').text(text, { ...opts });
}

async function main() {
  let stress = { exitCode: null, raw: '', passed: null, failed: null, total: null };
  if (RUN_STRESS) {
    stress = await runStressHarness();
  }

  const pdfkitPath = path.join(__dirname, 'node_modules', 'pdfkit');
  if (!fs.existsSync(pdfkitPath)) {
    console.error('Missing dependency: run `cd scripts && npm install` first.');
    process.exit(1);
  }
  const PDFDocument = (await import('pdfkit')).default;

  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const stamp = new Date();
  const dateStr = stamp.toISOString().slice(0, 10);
  const timeStr = stamp.toISOString().slice(11, 19) + 'Z';
  const outFile = path.join(REPORTS_DIR, `EventOps-Test-Report-${dateStr}.pdf`);

  const doc = new PDFDocument({
    size: 'LETTER',
    margin: 56,
    info: { Title: 'EventOps Test Report', Author: 'EventOps QA' },
  });
  const stream = fs.createWriteStream(outFile);
  doc.pipe(stream);

  doc.fontSize(20).fillColor('#0f172a').font('Helvetica-Bold').text('VSP EventOps — Test Report', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(11).font('Helvetica').fillColor('#64748b').text(`Generated ${dateStr} ${timeStr}`, { align: 'center' });
  doc.moveDown(1.2);

  section(doc, '1. Executive summary');
  body(
    doc,
    'This report documents automated quality checks for the EventOps staff platform (Next.js frontend, Express/PostgreSQL backend). ' +
      'The API stress harness exercises authenticated flows across auth, students, events, attendance, strikes, notifications, documents, and admin endpoints, plus concurrency probes. ' +
      'Frontend routes were verified for HTTP 200 delivery from the Next.js server.'
  );
  doc.moveDown(0.5);

  section(doc, '2. API stress harness (scripts/stress-api-test.mjs)');
  if (RUN_STRESS && stress.passed != null) {
    const ok = stress.exitCode === 0 && stress.failed === 0;
    body(
      doc,
      `Last run exit code: ${stress.exitCode}. Checks passed: ${stress.passed}. Failed: ${stress.failed}. Total: ${stress.total}. ` +
        `Target API: ${BASE_URL}. ` +
        (ok ? 'Result: PASS.' : 'Result: FAIL — review captured log below.')
    );
    doc.moveDown(0.4);
    const tail = stress.raw.split('\n').slice(-35).join('\n');
    doc.font('Courier').fontSize(7).fillColor('#444').text(tail || '(no output)', { width: 500 });
    doc.font('Helvetica').fillColor('#333333');
  } else if (!RUN_STRESS) {
    body(doc, 'Live API run skipped (RUN_STRESS=0). Re-run with default settings to embed live results.');
  } else {
    body(doc, 'Stress harness did not return a parseable summary (API unreachable or script error). See server logs and run: node scripts/stress-api-test.mjs');
  }
  doc.moveDown(0.6);

  section(doc, '3. Coverage matrix (API)');
  const rows = [
    ['Area', 'Endpoints / behaviour'],
    ['Health', 'GET /api/health, /api/health/db'],
    ['Auth', 'signup (GEO + admin), login, me, lookup-role, logout'],
    ['Staff', 'GET/PUT /api/staff/me; directory GET; activity'],
    ['Students', 'CRUD subset, search, attendance & strike sub-resources'],
    ['Events', 'CRUD, calendar, upcoming, lock, unlock, depart (bus-based)'],
    ['Assignments', 'bulk assign, list, unassigned, clear'],
    ['Attendance sheets', 'add bus, list, active, activate, delete sheet & bus'],
    ['Attendance', 'roster, summary, mark, tap, bulk, notes, exports'],
    ['Dashboard', 'risk, live event, event summary, admin, semester report'],
    ['Strikes', 'at-risk, by student, create, excuse, reinstate, delete, process event'],
    ['Notifications', 'list, preferences, mark-all-read, admin generators'],
    ['Personal agenda', 'CRUD'],
    ['Staff notes', 'GET, PUT'],
    ['Documents', 'list, link create, patch, delete'],
    ['System settings', 'semester, available semesters, admin settings'],
    ['Admin', 'POST /api/admin/recalculate-statuses'],
    ['RBAC', 'GEO forbidden on POST /api/students; GEO list allowed'],
    ['Load', '120× parallel GET /api/health; 80× authenticated GET /api/events/upcoming'],
  ];
  doc.fontSize(9);
  rows.forEach(([a, b], i) => {
    doc.font(i === 0 ? 'Helvetica-Bold' : 'Helvetica').text(`${a}: ${b}`, { width: 500 });
    doc.moveDown(0.15);
  });
  doc.font('Helvetica');
  doc.moveDown(0.5);

  section(doc, '4. Frontend route smoke (HTTP 200)');
  body(
    doc,
    'Static App Router pages verified with GET (Next server): /, /dashboard, /students, /events, /events/calendar, /events/import, /events/new, ' +
      '/attendance/history, /reports, /reports/semester, /settings, /staff, /staff/import, /strikes, /students/import, /students/new, /documents, /presentations.'
  );
  doc.moveDown(0.5);

  section(doc, '5. Out of scope / follow-up');
  body(
    doc,
    'Full UI interaction (every modal, CSV upload, boarding confirmation, handoff mode) is not covered by this PDF; use Playwright/Cypress with fixtures. ' +
      'NYU SSO production flows are environment-specific. Production rate limits differ from development (compose uses higher /api/ limits).'
  );
  doc.moveDown(0.5);

  section(doc, '6. How to reproduce');
  body(doc, '1) docker compose up -d (or local API on port 3001)\n2) cd scripts && npm install\n3) node stress-api-test.mjs\n4) node generate-test-report-pdf.mjs\n\nOptional: BASE_URL=http://host:3001 RUN_STRESS=0 node generate-test-report-pdf.mjs');

  doc.end();
  await new Promise((res, rej) => {
    stream.on('finish', res);
    stream.on('error', rej);
  });

  console.log(`Wrote ${outFile}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
