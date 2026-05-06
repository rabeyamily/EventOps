import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database/connection';

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  NOT_MARKED = 'not_marked',
}

export interface AttendanceAttributes {
  id: string;
  eventId: string;
  studentId: string;
  attendanceSheetId?: string;
  status: AttendanceStatus;
  markedByStaffId: string;
  notes?: string;
  markedAt: Date;
  isHandOffMode: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AttendanceCreationAttributes
  extends Optional<AttendanceAttributes, 'id' | 'markedAt' | 'isHandOffMode' | 'createdAt' | 'updatedAt'> {}

export class Attendance
  extends Model<AttendanceAttributes, AttendanceCreationAttributes>
  implements AttendanceAttributes
{
  public id!: string;
  public eventId!: string;
  public studentId!: string;
  public attendanceSheetId?: string;
  public status!: AttendanceStatus;
  public markedByStaffId!: string;
  public notes?: string;
  public markedAt!: Date;
  public isHandOffMode!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Attendance.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    eventId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'events',
        key: 'id',
      },
    },
    studentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'students',
        key: 'id',
      },
    },
    attendanceSheetId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'attendance_sheets',
        key: 'id',
      },
    },
    status: {
      type: DataTypes.ENUM(...Object.values(AttendanceStatus)),
      allowNull: false,
      defaultValue: AttendanceStatus.NOT_MARKED,
    },
    markedByStaffId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'staff',
        key: 'id',
      },
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    markedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    isHandOffMode: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'attendances',
    indexes: [
      { fields: ['eventId'] },
      { fields: ['studentId'] },
      { fields: ['status'] },
      { fields: ['markedByStaffId'] },
      { fields: ['attendanceSheetId'] },
      // Note: No unique constraint - allows multiple attendance records per student per event (one per sheet)
      // Application logic ensures one record per student per sheet
    ],
  }
);

