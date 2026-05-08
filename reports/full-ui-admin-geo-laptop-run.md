# Full UI Run (Laptop) - GEO and Admin

Generated: 2026-04-28  
Viewport target: laptop (`1440x900`)  
Environment: local frontend `http://localhost:3000`, backend `http://localhost:3001`

## What was executed

- Re-ran the app in **GEO mode** and **Admin mode**.
- Verified role access boundaries using:
  - Backend RBAC route enforcement
  - API differential run (`reports/role-access-matrix.md`)
  - UI route-by-route navigation and full-page captures
- Captured feature-specific pages including:
  - dashboard, students, events, attendance history
  - event detail, attendance taking flow UI, boarding mode UI, event summary UI
  - reports/settings/documents/staff areas
  - admin-only denial states for GEO

## Admin screenshot evidence (full-page, laptop)

Stored in `reports/geoandadmin/`:
- `admin-01-dashboard.png`
- `admin-02-students.png`
- `admin-03-events.png`
- `admin-04-staff-directory.png`
- `admin-05-reports.png`
- `admin-06-settings.png`
- `admin-07-documents.png`
- `admin-08-semester-report.png`

## GEO screenshot evidence (full-page, laptop)

Stored in `reports/geoandadmin/`:
- `geo-01-dashboard.png`
- `geo-02-students.png`
- `geo-03-events.png`
- `geo-04-staff-directory.png`
- `geo-05-reports.png` (explicit access denied)
- `geo-06-settings.png`
- `geo-07-documents.png`
- `geo-08-admin-only-staff-import-denied.png`

Additional rerun captures stored in `reports/`:
- `geo2-01-dashboard.png`
- `geo2-02-students-list.png`
- `geo2-03-events-list.png`
- `geo2-04-event-detail.png`
- `geo2-05-attendance-taking.png`
- `geo2-06-boarding.png`
- `geo2-07-event-summary.png`
- `geo2-08-attendance-history.png`

## Feature/case coverage summary

### Shared operational UI (both roles can access)
- Dashboard base
- Students list/detail surfaces
- Events list/detail surfaces
- Attendance history page
- Event attendance operational pages (take attendance, boarding, summary)
- Documents read/list
- Settings profile/notification preferences

### Admin-only UI/operations confirmed
- Reports/analytics pages
- Semester report page
- Staff import/management routes
- Student creation/import and event creation/import management paths
- System settings/admin maintenance capabilities (via API matrix)

### GEO restriction scenarios confirmed
- Reports page denied (`geo-05-reports.png`)
- Staff import denied (`geo-08-admin-only-staff-import-denied.png`)
- API-level admin actions denied (`403`) in role matrix file

## Reference files

- Role API matrix: `reports/role-access-matrix.md`
- Role API raw JSON: `reports/role-access-matrix.json`
- GEO vs Admin access narrative: `reports/geo-vs-admin-access-report.md`

## Notes

- During rerun, a subset of screenshot calls intermittently timed out and were retried; final evidence bundle includes successful captures from the rerun plus the stable role set in `reports/geoandadmin/`.
- Event-specific screenshots are based on seeded sample event UI route paths and represent the actual boarding/attendance/summary interfaces.
