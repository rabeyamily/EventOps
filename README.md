# VSP EventOps - Staff Operations Platform

A staff-operated operations platform to manage visiting NYU students, events, buses, and attendance — where students never log in and attendance is confirmed by staff handoff or visual verification.

## 🚀 Quick Start with Docker

### Prerequisites
- Docker Desktop installed and running
- Docker Compose (included with Docker Desktop)

### Development Mode

1. **Start all services** (from the repo root):
   ```bash
   docker compose up -d
   ```

   This uses `docker-compose.yml`, which includes live-reload bind mounts for development.

   Optional — seed GEO staff after containers are healthy:
   ```bash
   docker exec eventops-backend npx tsx src/database/seed-geo-staff.ts
   ```

2. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Database: localhost:5432

3. **Stop services:**
   ```bash
   docker compose down
   ```

### Production Mode

Current compose settings are development-oriented (with bind mounts). For a production deployment, use a separate production compose file or remove bind mounts:

```bash
docker compose -f docker-compose.yml up -d --build
```

## 📁 Project Structure

```
EventOps/
├── backend/          # Node.js/Express API
├── frontend/         # Next.js frontend
├── docker-compose.yml  # Docker stack (DB, API, web)
└── DOCKER.md        # Detailed Docker guide
```

## 🛠️ Development Setup (Without Docker)

### Backend

```bash
cd backend
npm install
cp .env.example .env  # Edit with your settings
npm run migrate       # Set up database
npm run dev          # Start development server
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local  # Edit with your settings
npm run dev          # Start development server
```

## 📚 Documentation

- [Backend README](./backend/README.md) - Backend API documentation
- [Frontend README](./frontend/README.md) - Frontend documentation

## 🔑 Key Features

- **Staff-Only System** - No student login required
- **Visual Attendance** - Staff tap-to-mark attendance
- **Strike System** - Automated strike tracking (0-2 strikes)
- **Event Management** - Full calendar and event operations
- **Role-Based Access** - Staff and Admin roles

## 🏗️ Architecture

- **Backend:** Node.js, Express, TypeScript, Sequelize, PostgreSQL
- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS, Zustand
- **Database:** PostgreSQL
- **Authentication:** Session-based
- **Containerization:** Docker & Docker Compose

## 📝 Environment Variables

See `.env.example` for required environment variables.

## 🔐 Authentication

EventOps now uses email/password authentication with session cookies:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

