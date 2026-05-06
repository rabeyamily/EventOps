import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import passport from './auth/passport';
import { errorHandler } from './middleware/errorHandler';
import { sessionConfig } from './config/session';
import { testConnection } from './database/connection';
import { syncDatabase } from './database/migrate';
import {
  securityHeaders,
  rateLimiter,
  requestLogger,
  requestId,
} from './middleware/security';
import path from 'path';

// Register model definitions before routes/controllers start querying associations.
import './models';

// Routes
import authRouter from './routes/auth';
import studentsRouter from './routes/students';
import eventsRouter from './routes/events';
import eventAssignmentsRouter from './routes/event-assignments';
import adminRouter from './routes/admin';
import attendanceRouter from './routes/attendance';
import attendanceSheetsRouter from './routes/attendance-sheets';
import strikesRouter from './routes/strikes';
import staffRouter from './routes/staff';
import dashboardRouter from './routes/dashboard';
import notificationsRouter from './routes/notifications';
import systemSettingsRouter from './routes/system-settings';
import personalAgendaRouter from './routes/personal-agenda';
import documentsRouter from './routes/documents';
import staffNotesRouter from './routes/staff-notes';
import integrationsRouter from './routes/integrations';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Apply baseline security headers before any other middleware writes responses.
app.use(securityHeaders);

// Stamp every request with an ID so logs across middleware stay correlated.
app.use(requestId);

// Keep noisy logs out of tests so assertions remain stable.
if (process.env.NODE_ENV !== 'test') {
  app.use(requestLogger);
}

// CORS behavior changes in dev to support laptops/phones on the same network.
const isDev = process.env.NODE_ENV === 'development';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

// In development, allow requests from localhost and common network IPs
const corsOptions = isDev 
  ? {
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        // Allow localhost
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
          return callback(null, true);
        }
        
        // Allow common local network IP ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
        const networkIpPattern = /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/;
        if (networkIpPattern.test(origin)) {
          return callback(null, true);
        }
        
        // Allow the configured frontend URL
        if (origin === frontendUrl) {
          return callback(null, true);
        }
        
        // Final fallback in development: do not block local QA by origin checks.
        callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'Cache-Control'],
    }
  : {
      origin: frontendUrl,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'Cache-Control'],
    };

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Keep payload limits explicit to avoid accidental oversized uploads.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Use strict API limits outside development; keep local auth flows frictionless.
if (!isDev) {
  app.use('/api/', rateLimiter({ windowMs: 15 * 60 * 1000, max: 100 }));
  app.use('/api/auth/', rateLimiter({ windowMs: 15 * 60 * 1000, max: 20 }));
} else {
  // In development we keep a high cap so test loops do not get throttled.
  app.use('/api/', rateLimiter({ windowMs: 15 * 60 * 1000, max: 10000 }));
  // No rate limiting for auth endpoints in development
}

// Sessions must be initialized before Passport attaches user info to requests.
app.use(session(sessionConfig));

// Passport reads/writes session state after session middleware is live.
app.use(passport.initialize());
app.use(passport.session());

// Serve uploaded files
const uploadDir = process.env.UPLOAD_DIR || './uploads';
app.use('/uploads', express.static(path.join(process.cwd(), uploadDir)));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'VSP EventOps API is running',
    timestamp: new Date().toISOString(),
  });
});

// Database health check
app.get('/api/health/db', async (_req, res) => {
  const isConnected = await testConnection();
  res.status(isConnected ? 200 : 503).json({
    status: isConnected ? 'ok' : 'error',
    database: isConnected ? 'connected' : 'disconnected',
  });
});

// Authentication routes
app.use('/api/auth', authRouter);

// API Routes
app.use('/api/students', studentsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/events', eventAssignmentsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/attendance-sheets', attendanceSheetsRouter);
app.use('/api/strikes', strikesRouter);
app.use('/api/staff', staffRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/system-settings', systemSettingsRouter);
app.use('/api/personal-agenda', personalAgendaRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/staff-notes', staffNotesRouter);
app.use('/api/integrations', integrationsRouter);

// Error handling middleware (must be last)
app.use(errorHandler);

// Boot sequence: verify DB first, then open the HTTP listener.
const startServer = async () => {
  try {
    // Test database connection
    const isConnected = await testConnection();
    if (!isConnected) {
      console.error('❌ Failed to connect to database. Please check your configuration.');
      process.exit(1);
    }

    // Sync database models (create tables if they don't exist)
    if (process.env.SYNC_DB === 'true') {
      console.log('🔄 Syncing database models...');
      await syncDatabase(false);
    }

    // Start server - listen on all interfaces (0.0.0.0) to allow network access
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 VSP EventOps Server running on http://0.0.0.0:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🌐 Network access: http://<your-ip>:${PORT}/api/health`);
      console.log(`🔐 Auth: POST http://localhost:${PORT}/api/auth/login | POST http://localhost:${PORT}/api/auth/signup`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
