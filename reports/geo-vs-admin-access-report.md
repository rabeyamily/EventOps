# GEO vs Admin Access Report

Generated: 2026-04-28  
Source evidence:
- API matrix: `reports/role-access-matrix.json` and `reports/role-access-matrix.md`
- UI screenshots: `reports/admin-*.png` and `reports/geo-*.png`

## Role model (from backend RBAC)

From `backend/src/auth/rbac.ts`:
- **GEO (`staff`) has explicit permissions**:
  - `view_students`
  - `view_events`
  - `view_attendance`
  - `mark_attendance`
  - `view_strikes`
  - `view_staff`
  - `assign_students`
  - `unassign_students`
- **Admin has all permissions** (`Object.values(Permission)`).

## High-level summary

- Total API checks executed: **28**
- Admin forbidden responses: **0**
- GEO forbidden responses: **15**
- GEO can read most operational data, but cannot perform admin configuration/management actions.

## API access by capability type

### A) Shared access (both Admin and GEO)

Both roles returned non-403 (allowed and/or input-validated):
- Dashboard risk: `GET /api/dashboard/risk`
- Students read: `GET /api/students`, `GET /api/students/:id`
- Events read: `GET /api/events`, `GET /api/events/:id`
- Event assignment (single assignment route): `POST /api/events/:id/assignments` (returned 404 for both in this run due current data state, not RBAC denial)
- Attendance export: `GET /api/attendance/export`
- Documents read: `GET /api/documents`
- Staff read: `GET /api/staff`
- Notifications read: `GET /api/notifications`
- Personal agenda read/write: `GET /api/personal-agenda`, `POST /api/personal-agenda`
- Lock event route was callable by GEO in this sample (returned 400 because event state was invalid at call time, not 403 RBAC denial)

### B) Admin-only access (GEO explicitly denied with 403)

These operations returned 200/201 for Admin and **403 for GEO**:
- Dashboard admin: `GET /api/dashboard/admin`
- Student create/delete:
  - `POST /api/students`
  - `DELETE /api/students/:id`
- Event create/unlock:
  - `POST /api/events`
  - `POST /api/events/:id/unlock`
- Assignment bulk/clear:
  - `POST /api/events/:id/assignments/bulk`
  - `DELETE /api/events/:id/assignments`
- Strike admin actions:
  - `POST /api/strikes`
  - `POST /api/strikes/event/:eventId/process`
- Documents write:
  - `POST /api/documents`
- Staff write:
  - `POST /api/staff`
- System settings/admin maintenance:
  - `GET /api/system-settings`
  - `PUT /api/system-settings/current-semester`
  - `POST /api/admin/recalculate-statuses`
- Notification generation:
  - `POST /api/notifications/daily-summary`

## UI differences (with screenshot proof)

### 1) Dashboard
- Admin: richer admin dashboard with action/management cards and admin mode controls.
  - `reports/admin-01-dashboard.png`
- GEO: simplified dashboard with limited quick actions and GEO mode badge.
  - `reports/geo-01-dashboard.png`

### 2) Students
- Admin: create/edit/import controls visible.
  - `reports/admin-02-students.png`
- GEO: read/list/search/filter experience, without admin creation/import controls.
  - `reports/geo-02-students.png`

### 3) Events
- Admin: import/add controls visible.
  - `reports/admin-03-events.png`
- GEO: can browse events; admin creation/import controls absent.
  - `reports/geo-03-events.png`

### 4) Staff directory
- Admin: staff management actions (import/add/edit/delete affordances).
  - `reports/admin-04-staff-directory.png`
- GEO: read-only staff directory presentation.
  - `reports/geo-04-staff-directory.png`

### 5) Reports
- Admin: reports and analytics accessible.
  - `reports/admin-05-reports.png`
- GEO: reports page denies access.
  - `reports/geo-05-reports.png`

### 6) Settings
- Admin: profile + preferences in admin account context.
  - `reports/admin-06-settings.png`
- GEO: profile + preferences in staff account context.
  - `reports/geo-06-settings.png`

### 7) Documents
- Admin: document creation/management controls.
  - `reports/admin-07-documents.png`
- GEO: document listing/consumption view.
  - `reports/geo-07-documents.png`

### 8) Explicit admin-only page denial
- Admin import semester report/staff import pages are available in admin context.
  - `reports/admin-08-semester-report.png`
- GEO receives access denied on admin-only staff import screen.
  - `reports/geo-08-admin-only-staff-import-denied.png`

## Practical interpretation

- **GEO role = operational execution role**: can run daily operations (view students/events/staff, attendance operations, some assignment operations).
- **Admin role = operational + governance role**: all GEO capabilities plus data lifecycle, configuration, imports, reporting, maintenance, and content management.

## Notes

- A few endpoint results are non-403 failures (e.g., 400/404) because of object state/input in the sampled dataset at test time. These are still important: they indicate the request passed RBAC and reached business validation.
- All exact status evidence is preserved in `reports/role-access-matrix.md`.
