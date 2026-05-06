import { Student } from './Student';
import { Staff } from './Staff';
import { Event } from './Event';
import { Attendance } from './Attendance';
import { AttendanceSheet } from './AttendanceSheet';
import { Strike } from './Strike';
import { Notification } from './Notification';
import { SystemSettings } from './SystemSettings';
import { PersonalAgenda } from './PersonalAgenda';
import { Document } from './Document';
import { StaffNote } from './StaffNote';

// Define associations
Event.belongsTo(Staff, { foreignKey: 'leadOrganizerId', as: 'leadOrganizer' });
Event.belongsTo(Staff, { foreignKey: 'leadOrganizer2Id', as: 'leadOrganizer2' });
Event.belongsTo(Staff, { foreignKey: 'leadOrganizer3Id', as: 'leadOrganizer3' });
Event.belongsTo(Staff, { foreignKey: 'lockedByStaffId', as: 'lockedBy' });
Staff.hasMany(Event, { foreignKey: 'leadOrganizerId', as: 'organizedEvents' });

Attendance.belongsTo(Event, { foreignKey: 'eventId', as: 'event' });
Attendance.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });
Attendance.belongsTo(Staff, { foreignKey: 'markedByStaffId', as: 'markedBy' });
Attendance.belongsTo(AttendanceSheet, { foreignKey: 'attendanceSheetId', as: 'attendanceSheet' });

AttendanceSheet.belongsTo(Event, { foreignKey: 'eventId', as: 'event' });
AttendanceSheet.belongsTo(Staff, { foreignKey: 'createdByStaffId', as: 'createdBy' });

Event.hasMany(Attendance, { foreignKey: 'eventId', as: 'attendances' });
Event.hasMany(AttendanceSheet, { foreignKey: 'eventId', as: 'attendanceSheets' });
Student.hasMany(Attendance, { foreignKey: 'studentId', as: 'attendances' });
AttendanceSheet.hasMany(Attendance, { foreignKey: 'attendanceSheetId', as: 'attendances' });
Student.belongsTo(Staff, { foreignKey: 'createdByStaffId', as: 'createdBy' });
Student.belongsTo(Staff, { foreignKey: 'updatedByStaffId', as: 'updatedBy' });

Strike.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });
Strike.belongsTo(Event, { foreignKey: 'eventId', as: 'event' });
Strike.belongsTo(Staff, { foreignKey: 'excusedByStaffId', as: 'excusedBy' });

Student.hasMany(Strike, { foreignKey: 'studentId', as: 'strikes' });
Event.hasMany(Strike, { foreignKey: 'eventId', as: 'strikes' });

Notification.belongsTo(Staff, { foreignKey: 'staffId', as: 'staff' });
Staff.hasMany(Notification, { foreignKey: 'staffId', as: 'notifications' });

PersonalAgenda.belongsTo(Staff, { foreignKey: 'staffId', as: 'staff' });
Staff.hasMany(PersonalAgenda, { foreignKey: 'staffId', as: 'personalAgenda' });

Document.belongsTo(Staff, { foreignKey: 'uploadedByStaffId', as: 'uploadedBy' });
Staff.hasMany(Document, { foreignKey: 'uploadedByStaffId', as: 'documents' });

StaffNote.belongsTo(Staff, { foreignKey: 'staffId', as: 'staff' });
Staff.hasOne(StaffNote, { foreignKey: 'staffId', as: 'staffNote' });

export {
  Student,
  Staff,
  Event,
  Attendance,
  AttendanceSheet,
  Strike,
  Notification,
  SystemSettings,
  PersonalAgenda,
  Document,
  StaffNote,
};

