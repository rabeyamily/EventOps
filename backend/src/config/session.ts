import session from 'express-session';
// @ts-expect-error connect-pg-simple may lack complete typings for default export
import connectPgSimple from 'connect-pg-simple';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const PgSession = connectPgSimple(session);

// Create PostgreSQL pool for session store
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const sessionConfig = {
  store: new PgSession({
    pool: pool as any,
    tableName: 'user_sessions',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to false in development to allow HTTP connections (required for iPhone)
    httpOnly: true,
    maxAge: parseInt(process.env.SESSION_COOKIE_MAX_AGE || '86400000', 10), // 24 hours default
    sameSite: 'lax' as const, // 'lax' works for same-site requests (same IP/domain)
    // In development, iPhone accessing via Mac IP should be treated as same-site
  },
  name: 'eventops.sid',
};

