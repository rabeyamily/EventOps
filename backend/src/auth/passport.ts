import passport from 'passport';
import { Staff } from '../models/Staff';

passport.serializeUser((user: Staff, done: (err: unknown, id?: unknown) => void) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done: (err: any, user?: Staff | null) => void) => {
  try {
    const staff = await Staff.findByPk(id);
    done(null, staff);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
