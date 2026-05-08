# Role Access Matrix (Admin vs GEO)

Generated: 2026-04-28T17:26:29.043Z
Base URL: http://localhost:3001

| Feature | Method | Endpoint | Admin | GEO |
|---|---|---|---:|---:|
| Dashboard risk | GET | `/api/dashboard/risk` | 200 | 200 |
| Dashboard admin | GET | `/api/dashboard/admin` | 200 | 403 |
| Students list | GET | `/api/students?limit=5` | 200 | 200 |
| Create student | POST | `/api/students` | 201 | 403 |
| Student detail | GET | `/api/students/0f3140b2-14b2-40d0-9560-7f2b2259d5bf` | 200 | 200 |
| Delete student | DELETE | `/api/students/0f3140b2-14b2-40d0-9560-7f2b2259d5bf` | 200 | 403 |
| Events list | GET | `/api/events?limit=5` | 200 | 200 |
| Create event | POST | `/api/events` | 201 | 403 |
| Event detail | GET | `/api/events/ccb92b8c-c78f-46ad-baed-9726bf5a1f6e` | 200 | 200 |
| Lock event | POST | `/api/events/ccb92b8c-c78f-46ad-baed-9726bf5a1f6e/lock` | 200 | 400 |
| Unlock event | POST | `/api/events/ccb92b8c-c78f-46ad-baed-9726bf5a1f6e/unlock` | 200 | 403 |
| Assign student | POST | `/api/events/ccb92b8c-c78f-46ad-baed-9726bf5a1f6e/assignments` | 404 | 404 |
| Bulk assign students | POST | `/api/events/ccb92b8c-c78f-46ad-baed-9726bf5a1f6e/assignments/bulk` | 201 | 403 |
| Clear assignments | DELETE | `/api/events/ccb92b8c-c78f-46ad-baed-9726bf5a1f6e/assignments` | 200 | 403 |
| Attendance export | GET | `/api/attendance/export` | 200 | 200 |
| Create strike | POST | `/api/strikes` | 404 | 403 |
| Process strikes | POST | `/api/strikes/event/ccb92b8c-c78f-46ad-baed-9726bf5a1f6e/process` | 200 | 403 |
| Documents list | GET | `/api/documents` | 200 | 200 |
| Create document link | POST | `/api/documents` | 201 | 403 |
| Staff list | GET | `/api/staff?limit=5` | 200 | 200 |
| Create staff | POST | `/api/staff` | 200 | 403 |
| System settings all | GET | `/api/system-settings` | 200 | 403 |
| Set current semester | PUT | `/api/system-settings/current-semester` | 200 | 403 |
| Admin recalculate statuses | POST | `/api/admin/recalculate-statuses` | 200 | 403 |
| Notifications list | GET | `/api/notifications` | 200 | 200 |
| Generate daily summary | POST | `/api/notifications/daily-summary` | 200 | 403 |
| Personal agenda list | GET | `/api/personal-agenda` | 200 | 200 |
| Create personal agenda | POST | `/api/personal-agenda` | 201 | 201 |