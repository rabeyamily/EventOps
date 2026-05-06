import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../auth/middleware';
import { sequelize } from '../database/connection';
import { Op } from 'sequelize';

const router = express.Router();

// \u005B \u005D are [ ] so we avoid no-useless-escape on bracket literals in the character class
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\u005B\u005D{};':"\\|,.<>/?]).{8,}$/;

// Sign up
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, role } = req.body;
    const { Staff, StaffRole } = await import('../models/Staff');

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required.' });
      return;
    }

    if (!PASSWORD_REGEX.test(password)) {
      res.status(400).json({
        success: false,
        error:
          'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.',
      });
      return;
    }

    const existing = await Staff.findOne({ where: { email } });
    if (existing) {
      res.status(400).json({ success: false, error: 'An account with this email already exists. Please log in.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const staff = await Staff.create({
      email,
      fullName: fullName || email.split('@')[0],
      passwordHash,
      role: role === 'admin' ? StaffRole.ADMIN : StaffRole.STAFF,
      position: 'GEO',
    });

    res.status(201).json({
      success: true,
      data: {
        message: 'Account created successfully. You can now log in.',
        user: {
          id: staff.id,
          email: staff.email,
          fullName: staff.fullName,
          role: staff.role,
        },
      },
    });
  } catch (error: any) {
    console.error('Sign up error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create account.' });
  }
});

// Look up a user's role by email for login auto-selection
router.get('/lookup-role', async (req: Request, res: Response) => {
  try {
    const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';

    if (!email) {
      res.json({ success: true, data: { role: null } });
      return;
    }

    const { Staff } = await import('../models/Staff');
    const staff = await Staff.findOne({
      where: { email },
      attributes: ['role'],
    });

    res.json({
      success: true,
      data: {
        role: staff?.role ?? null,
      },
    });
  } catch (error: any) {
    console.error('Role lookup error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to look up role.' });
  }
});

// Log in
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body;
    const { Staff } = await import('../models/Staff');

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required.' });
      return;
    }

    const staff = await Staff.findOne({ where: { email } });
    if (!staff || !staff.passwordHash) {
      res.status(401).json({ success: false, error: 'Invalid email or password.' });
      return;
    }

    const valid = await bcrypt.compare(password, staff.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid email or password.' });
      return;
    }

    if (role && staff.role !== role) {
      res.status(403).json({
        success: false,
        error: `Your account is registered as ${staff.role === 'admin' ? 'Admin' : 'GEO'}. Please select the correct role to log in.`,
      });
      return;
    }

    req.login(staff, (err: any) => {
      if (err) {
        res.status(500).json({ success: false, error: 'Login failed.' });
        return;
      }
      res.json({
        success: true,
        data: {
          user: {
            id: staff.id,
            email: staff.email,
            fullName: staff.fullName,
            preferredName: staff.preferredName,
            role: staff.role,
            phone: staff.phone,
          },
        },
      });
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: error.message || 'Login failed.' });
  }
});

// Logout
router.post('/logout', requireAuth, (req: Request, res: Response) => {
  req.logout((err: any) => {
    if (err) {
      res.status(500).json({ error: 'Logout failed' });
      return;
    }
    req.session?.destroy((sessionErr: any) => {
      if (sessionErr) {
        res.status(500).json({ error: 'Session destruction failed' });
        return;
      }
      res.clearCookie('eventops.sid');
      res.json({ message: 'Logged out successfully' });
    });
  });
});

// Get current user
router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      user: {
        id: req.user?.id,
        email: req.user?.email,
        fullName: req.user?.fullName,
        preferredName: req.user?.preferredName,
        nyuEmail: req.user?.nyuEmail,
        classYear: req.user?.classYear,
        major: req.user?.major,
        role: req.user?.role,
        phone: req.user?.phone,
      },
    },
  });
});

// Delete own account
router.delete('/delete-account', requireAuth, async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const userId = req.user?.id;
    if (!userId) {
      await transaction.rollback();
      res.status(401).json({ success: false, error: 'Not authenticated.' });
      return;
    }

    const { password } = req.body;
    const { Staff } = await import('../models/Staff');
    const { Event } = await import('../models/Event');

    const staff = await Staff.findByPk(userId, { transaction });
    if (!staff) {
      await transaction.rollback();
      res.status(404).json({ success: false, error: 'Account not found.' });
      return;
    }

    if (staff.passwordHash && password) {
      const valid = await bcrypt.compare(password, staff.passwordHash);
      if (!valid) {
        await transaction.rollback();
        res.status(401).json({ success: false, error: 'Incorrect password.' });
        return;
      }
    } else if (staff.passwordHash && !password) {
      await transaction.rollback();
      res.status(400).json({ success: false, error: 'Password is required to delete your account.' });
      return;
    }

    const ownedEvents = await Event.count({
      where: {
        [Op.or]: [
          { leadOrganizerId: userId },
          { leadOrganizer2Id: userId },
          { leadOrganizer3Id: userId },
        ],
      },
      transaction,
    });
    if (ownedEvents > 0) {
      await transaction.rollback();
      res.status(400).json({
        success: false,
        error: `You are the lead organizer of ${ownedEvents} event(s). Please reassign or delete them before deleting your account.`,
      });
      return;
    }

    // Remove user-owned data
    await sequelize.query(`DELETE FROM notifications WHERE "staffId" = :uid`, { replacements: { uid: userId }, transaction });
    await sequelize.query(`DELETE FROM personal_agenda WHERE "staffId" = :uid`, { replacements: { uid: userId }, transaction });
    await sequelize.query(`DELETE FROM staff_notes WHERE "staffId" = :uid`, { replacements: { uid: userId }, transaction });

    // Nullify FK references in shared records so historical data is preserved
    await sequelize.query(`UPDATE documents SET "uploadedByStaffId" = NULL WHERE "uploadedByStaffId" = :uid`, { replacements: { uid: userId }, transaction });
    await sequelize.query(`UPDATE attendances SET "markedByStaffId" = NULL WHERE "markedByStaffId" = :uid`, { replacements: { uid: userId }, transaction });
    await sequelize.query(`UPDATE attendance_sheets SET "createdByStaffId" = NULL WHERE "createdByStaffId" = :uid`, { replacements: { uid: userId }, transaction });
    await sequelize.query(`UPDATE students SET "createdByStaffId" = NULL WHERE "createdByStaffId" = :uid`, { replacements: { uid: userId }, transaction });
    await sequelize.query(`UPDATE students SET "updatedByStaffId" = NULL WHERE "updatedByStaffId" = :uid`, { replacements: { uid: userId }, transaction });
    await sequelize.query(`UPDATE strikes SET "excusedByStaffId" = NULL WHERE "excusedByStaffId" = :uid`, { replacements: { uid: userId }, transaction });
    await sequelize.query(`UPDATE events SET "lockedByStaffId" = NULL WHERE "lockedByStaffId" = :uid`, { replacements: { uid: userId }, transaction });

    // Remove session rows for this user
    await sequelize.query(`DELETE FROM user_sessions WHERE sess::text LIKE :pattern`, { replacements: { pattern: `%"passport":{"user":"${userId}"}%` }, transaction });

    await staff.destroy({ transaction });
    await transaction.commit();

    req.logout((err: any) => {
      if (err) {
        res.status(200).json({ success: true, message: 'Account deleted. Session cleanup failed.' });
        return;
      }
      req.session?.destroy((_sessionErr: any) => {
        res.clearCookie('eventops.sid');
        res.json({ success: true, message: 'Account deleted successfully.' });
      });
    });
  } catch (error: any) {
    await transaction.rollback();
    console.error('Delete account error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to delete account.' });
  }
});

export default router;
