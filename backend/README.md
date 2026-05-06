# VSP EventOps Backend

Staff-only operations platform for managing visiting NYU students, events, buses, and attendance.

## Setup

### Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials and session settings
```

3. Create PostgreSQL database:
```bash
createdb eventops
```

4. Run database migrations:
```bash
npm run migrate
```

5. Start development server:
```bash
npm run dev
```

## Environment Variables

Key environment variables (see `.env.example` for full list):

- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Secret for session encryption

## Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run migrate` - Run database migrations
- `npm run migrate:create <name>` - Create new migration

## Authentication

The system uses email/password authentication with server-side sessions.

```bash
POST /api/auth/signup
{
  "email": "staff@nyu.edu",
  "password": "StrongPassword123!",
  "fullName": "Staff Member",
  "role": "staff" // or "admin"
}
```

```bash
POST /api/auth/login
{
  "email": "staff@nyu.edu",
  "password": "StrongPassword123!",
  "role": "staff" // optional role assertion ("staff" or "admin")
}
```

## API Endpoints

### Health Check
- `GET /api/health` - Server health check
- `GET /api/health/db` - Database connection check

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Log in
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `GET /api/auth/lookup-role` - Look up role by email
- `DELETE /api/auth/delete-account` - Delete current account

### Integrations
- `POST /api/integrations/google-form/students` - Create/update student from Google Form webhook

## Google Form -> Students Tab Sync

This project supports machine-to-machine webhook import from Google Forms into the `students` table.

### 1) Backend Configuration

Add the webhook secret in your environment:

```bash
GOOGLE_FORM_WEBHOOK_SECRET=replace-with-long-random-secret
```

Then restart backend:

```bash
npm run dev
```

### 2) Webhook Endpoint

- **URL**: `POST /api/integrations/google-form/students`
- **Auth Header**: `x-webhook-secret: <GOOGLE_FORM_WEBHOOK_SECRET>`
- **Content-Type**: `application/json`

Required payload fields:
- `fullName`
- `nyuEmail`

Common optional payload fields:
- `campus` (`NYC` or `Shanghai`)
- `preferredName`, `uaePhone`, `internationalPhone`
- `emergencyContact`, `altEmergencyContact`
- `cohort`, `nNumber`, `school`, `major`, `academicLevel`
- `admitTerm`, `citizenship`, `passportCountry`, `gender`, `address`
- `passportUrl`, `immigrationFormUrl`

Behavior:
- If `nyuEmail` already exists, the student is updated.
- If not, a student is created.
- Cohort is taken from payload if provided; otherwise from current semester setting/fallback.
- Endpoint is rate-limited.

### 3) Local Test with cURL

```bash
curl -X POST "http://localhost:3001/api/integrations/google-form/students" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_SECRET" \
  -d '{
    "fullName": "Test Student",
    "nyuEmail": "test.student@nyu.edu",
    "campus": "NYC",
    "uaePhone": "+971500000000",
    "cohort": "Spring 2026",
    "passportUrl": "https://drive.google.com/file/d/example/view"
  }'
```

### 4) Google Apps Script Trigger

In the Google Sheet linked to your form:
1. Open `Extensions -> Apps Script`
2. Add the script below
3. Create a trigger for `onFormSubmit` (event type: `From spreadsheet`, `On form submit`)

```javascript
function onFormSubmit(e) {
  const endpoint = "https://YOUR_BACKEND_DOMAIN/api/integrations/google-form/students";
  const secret = "YOUR_WEBHOOK_SECRET";

  const row = e.namedValues;
  const firstName = (row["First Name"]?.[0] || "").trim();
  const lastName = (row["Last Name"]?.[0] || "").trim();
  const fullName = `${firstName} ${lastName}`.trim();

  const payload = {
    fullName: fullName,
    nyuEmail: (row["NYU Email"]?.[0] || "").trim(),
    campus: (row["Campus"]?.[0] || "NYC").trim(),
    preferredName: (row["Preferred Name"]?.[0] || "").trim(),
    uaePhone: (row["UAE Phone"]?.[0] || "").trim(),
    internationalPhone: (row["International Phone"]?.[0] || "").trim(),
    emergencyContact: (row["Emergency Contact"]?.[0] || "").trim(),
    cohort: (row["Cohort"]?.[0] || "").trim(),
    passportUrl: (row["Passport Upload"]?.[0] || "").trim(),
    immigrationFormUrl: (row["Immigration Form"]?.[0] || "").trim()
  };

  UrlFetchApp.fetch(endpoint, {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-webhook-secret": secret
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}
```

### 5) Verification Checklist

- Submit a new form response -> new student appears in `Students` tab.
- Submit same email with updated phone -> existing student is updated (no duplicate row).
- Test wrong secret -> endpoint returns `401`.
- Test missing required fields -> endpoint returns `400`.

## Project Structure

```
backend/
├── src/
│   ├── auth/           # Authentication & authorization
│   │   ├── passport.ts  # Passport session strategy
│   │   ├── middleware.ts # Auth middleware
│   │   └── rbac.ts     # Role-based access control
│   ├── config/          # Configuration files
│   │   └── session.ts  # Session configuration
│   ├── database/       # Database setup
│   │   ├── connection.ts # Sequelize connection
│   │   └── migrate.ts  # Migration runner
│   ├── models/         # Sequelize models
│   │   ├── Student.ts
│   │   ├── Staff.ts
│   │   ├── Event.ts
│   │   ├── Attendance.ts
│   │   ├── Strike.ts
│   │   └── index.ts
│   ├── routes/         # API routes
│   ├── middleware/     # Express middleware
│   └── index.ts        # Main server file
├── migrations/         # Database migrations
└── package.json
```

## Database Models

- **Student** - Student profiles with strike tracking
- **Staff** - Staff members (staff/admin roles)
- **Event** - Events and programs
- **Attendance** - Attendance records
- **Strike** - Strike records with excuse tracking

