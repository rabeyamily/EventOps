import { Staff } from '../models/Staff';
import 'express-session';

declare global {
  namespace Express {
    interface User extends Staff {}
    
    interface Request {
      user?: Staff;
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    ssoEmail?: string;
    ssoRole?: string;
  }
}

export {};

