import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database/connection';

export enum AttendanceMode {
  BUS_BASED = 'bus_based',
}

export enum Semester {
  SPRING = 'Spring',
  FALL = 'Fall',
}

export interface EventAttributes {
  id: string;
  name: string;
  startDate: Date;
  endDate?: Date;
  startTime?: string;
  endTime?: string;
  location?: string;
  leadOrganizerId: string;
  /** Optional second and third GEO team leads (max 3 total including primary). */
  leadOrganizer2Id?: string | null;
  leadOrganizer3Id?: string | null;
  teamLeaderIds?: string[];
  assignedGeoIds?: string[];
  attendanceMode: AttendanceMode;
  notes?: string;
  isLocked: boolean;
  lockedAt?: Date;
  lockedByStaffId?: string;
  lockReason?: string;
  departedAt?: Date;
  semester?: Semester;
  academicYear?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EventCreationAttributes
  extends Optional<
    EventAttributes,
    'id' | 'isLocked' | 'createdAt' | 'updatedAt' | 'leadOrganizer2Id' | 'leadOrganizer3Id'
  > {}

export class Event
  extends Model<EventAttributes, EventCreationAttributes>
  implements EventAttributes
{
  public id!: string;
  public name!: string;
  public startDate!: Date;
  public endDate?: Date;
  public startTime?: string;
  public endTime?: string;
  public location?: string;
  public leadOrganizerId!: string;
  public leadOrganizer2Id?: string | null;
  public leadOrganizer3Id?: string | null;
  public teamLeaderIds?: string[];
  public assignedGeoIds?: string[];
  public attendanceMode!: AttendanceMode;
  public notes?: string;
  public isLocked!: boolean;
  public lockedAt?: Date;
  public lockedByStaffId?: string;
  public lockReason?: string;
  public departedAt?: Date;
  public semester?: Semester;
  public academicYear?: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Event.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    startTime: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    endTime: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    leadOrganizerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'staff',
        key: 'id',
      },
    },
    leadOrganizer2Id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'staff',
        key: 'id',
      },
    },
    leadOrganizer3Id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'staff',
        key: 'id',
      },
    },
    teamLeaderIds: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    assignedGeoIds: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    attendanceMode: {
      type: DataTypes.ENUM(...Object.values(AttendanceMode)),
      allowNull: false,
      defaultValue: AttendanceMode.BUS_BASED,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isLocked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    lockedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lockedByStaffId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'staff',
        key: 'id',
      },
    },
    lockReason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    departedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    semester: {
      type: DataTypes.ENUM(...Object.values(Semester)),
      allowNull: true,
    },
    academicYear: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'events',
    indexes: [
      { fields: ['startDate'] },
      { fields: ['leadOrganizerId'] },
      { fields: ['isLocked'] },
      { fields: ['semester', 'academicYear'] },
    ],
  }
);

