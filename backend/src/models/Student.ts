import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database/connection';

export enum StudentStatus {
  CLEAR = 'clear',
  ONE_STRIKE = 'one_strike',
  BLOCKED = 'blocked',
}

export enum Campus {
  NYC = 'NYC',
  SHANGHAI = 'Shanghai',
}

export interface StudentAttributes {
  id: string;
  fullName: string;
  preferredName?: string;
  photoUrl?: string;
  nyuEmail: string;
  nNumber?: string;
  campus: Campus;
  uaePhone?: string;
  internationalPhone?: string;
  emergencyContact?: string;
  altEmergencyContact?: string;
  cohort?: string; // Comma-separated list of cohorts, e.g., "Spring 2026, Fall 2025"
  primaryCohort?: string; // The most recent/primary cohort
  // Academic Info
  school?: string;
  major?: string;
  academicLevel?: string;
  gpa?: number;
  admitTerm?: string;
  // Personal Info
  birthdate?: Date;
  citizenship?: string;
  passportCountry?: string;
  gender?: string;
  address?: string;
  // Strike Info
  strikeCount: number;
  status: StudentStatus;
  // Audit fields
  createdByStaffId?: string;
  updatedByStaffId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StudentCreationAttributes
  extends Optional<StudentAttributes, 'id' | 'strikeCount' | 'status' | 'createdAt' | 'updatedAt'> {}

export class Student
  extends Model<StudentAttributes, StudentCreationAttributes>
  implements StudentAttributes
{
  public id!: string;
  public fullName!: string;
  public preferredName?: string;
  public photoUrl?: string;
  public nyuEmail!: string;
  public nNumber?: string;
  public campus!: Campus;
  public uaePhone?: string;
  public internationalPhone?: string;
  public emergencyContact?: string;
  public altEmergencyContact?: string;
  public cohort?: string; // Comma-separated list of cohorts
  public primaryCohort?: string; // The most recent/primary cohort
  // Academic Info
  public school?: string;
  public major?: string;
  public academicLevel?: string;
  public gpa?: number;
  public admitTerm?: string;
  // Personal Info
  public birthdate?: Date;
  public citizenship?: string;
  public passportCountry?: string;
  public gender?: string;
  public address?: string;
  // Strike Info
  public strikeCount!: number;
  public status!: StudentStatus;
  // Audit fields
  public createdByStaffId?: string;
  public updatedByStaffId?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Student.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    fullName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    preferredName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    photoUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    nyuEmail: {
      type: DataTypes.STRING,
      allowNull: false,
      // Not unique alone - allow same email for different cohorts
      validate: {
        isEmail: true,
      },
    },
    nNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    campus: {
      type: DataTypes.ENUM(...Object.values(Campus)),
      allowNull: false,
    },
    uaePhone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    internationalPhone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    emergencyContact: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    altEmergencyContact: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cohort: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Comma-separated list of cohorts the student has been in',
    },
    primaryCohort: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'The most recent/primary cohort',
    },
    // Academic Info
    school: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    major: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    academicLevel: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gpa: {
      type: DataTypes.DECIMAL(4, 3),
      allowNull: true,
    },
    admitTerm: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Personal Info
    birthdate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    citizenship: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    passportCountry: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gender: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Strike Info
    strikeCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 2,
      },
    },
    status: {
      type: DataTypes.ENUM(...Object.values(StudentStatus)),
      allowNull: false,
      defaultValue: StudentStatus.CLEAR,
    },
    // Audit fields
    createdByStaffId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'staff',
        key: 'id',
      },
    },
    updatedByStaffId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'staff',
        key: 'id',
      },
    },
  },
  {
    sequelize,
    tableName: 'students',
    indexes: [
      { fields: ['fullName'] },
      { fields: ['nyuEmail'] },
      { fields: ['campus'] },
      { fields: ['cohort'] },
      { fields: ['primaryCohort'] },
      { fields: ['status'] },
      // Composite unique index: same email can exist for different cohorts
      { 
        fields: ['nyuEmail', 'cohort'], 
        unique: true,
        name: 'unique_email_cohort'
      },
    ],
    hooks: {
      beforeSave: async (student: Student) => {
        // Automatically calculate status based on strike count
        if (student.strikeCount !== undefined) {
          if (student.strikeCount === 0) {
            student.status = StudentStatus.CLEAR;
          } else if (student.strikeCount === 1) {
            student.status = StudentStatus.ONE_STRIKE;
          } else {
            student.status = StudentStatus.BLOCKED;
          }
        }
      },
    },
  }
);

