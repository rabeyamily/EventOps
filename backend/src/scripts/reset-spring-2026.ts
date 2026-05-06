import { sequelize } from '../database/connection';
import '../models/index'; // load all associations
import { Attendance } from '../models/Attendance';
import { AttendanceSheet } from '../models/AttendanceSheet';
import { Strike } from '../models/Strike';
import { Notification } from '../models/Notification';
import { PersonalAgenda } from '../models/PersonalAgenda';
import { Document } from '../models/Document';
import { Event } from '../models/Event';
import { Student } from '../models/Student';
import path from 'path';
import fs from 'fs';

async function resetSpring2026() {
  try {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║         EventOps — Spring 2026 Full Reset            ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');

    await sequelize.authenticate();
    console.log('✅ Database connection established.\n');

    // ── 1. Attendance records ──────────────────────────────────
    const attendanceCount = await Attendance.count();
    await Attendance.destroy({ where: {}, force: true });
    console.log(`🗑️  Attendance records  — deleted ${attendanceCount}`);

    // ── 2. Attendance sheets ───────────────────────────────────
    const sheetCount = await AttendanceSheet.count();
    await AttendanceSheet.destroy({ where: {}, force: true });
    console.log(`🗑️  Attendance sheets   — deleted ${sheetCount}`);

    // ── 3. Strikes ─────────────────────────────────────────────
    const strikeCount = await Strike.count();
    await Strike.destroy({ where: {}, force: true });
    console.log(`🗑️  Strike records      — deleted ${strikeCount}`);

    // ── 4. Notifications ───────────────────────────────────────
    const notifCount = await Notification.count();
    await Notification.destroy({ where: {}, force: true });
    console.log(`🗑️  Notifications       — deleted ${notifCount}`);

    // ── 5. Personal agendas ────────────────────────────────────
    const agendaCount = await PersonalAgenda.count();
    await PersonalAgenda.destroy({ where: {}, force: true });
    console.log(`🗑️  Personal agendas    — deleted ${agendaCount}`);

    // ── 6. Documents (DB rows + uploaded files) ────────────────
    const docs = await Document.findAll({ attributes: ['id', 'fileName', 'sourceType'] });
    const uploadDir = path.resolve('/app/uploads/documents');
    let filesRemoved = 0;
    for (const doc of docs) {
      if ((doc as any).sourceType === 'upload' && (doc as any).fileName) {
        const filePath = path.join(uploadDir, (doc as any).fileName as string);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          filesRemoved++;
        }
      }
    }
    await Document.destroy({ where: {}, force: true });
    console.log(`🗑️  Documents           — deleted ${docs.length} records, ${filesRemoved} uploaded files`);

    // ── 7. Legacy audit_logs table (if still present in DB) ────
    try {
      await sequelize.query('DELETE FROM "audit_logs"');
      console.log('🗑️  Audit logs          — cleared (legacy table)');
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (/relation .*audit_logs.* does not exist/i.test(msg)) {
        console.log('⏭️  Audit logs          — table not present, skipped');
      } else {
        throw e;
      }
    }

    // ── 8. Events ──────────────────────────────────────────────
    const eventCount = await Event.count();
    await Event.destroy({ where: {}, force: true });
    console.log(`🗑️  Events              — deleted ${eventCount}`);

    // ── 9. Students ────────────────────────────────────────────
    const studentCount = await Student.count();
    await Student.destroy({ where: {}, force: true });
    console.log(`🗑️  Students            — deleted ${studentCount}`);

    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║  ✅  All data cleared. Ready for Spring 2026!        ║');
    console.log('║     GEO staff accounts have been preserved.          ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Reset failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

resetSpring2026();
