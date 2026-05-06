import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database/connection';

export interface StrikeAttributes {
  id: string;
  studentId: string;
  eventId: string;
  reason?: string;
  isExcused: boolean;
  excusedByStaffId?: string;
  excusedAt?: Date;
  excusedReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StrikeCreationAttributes
  extends Optional<StrikeAttributes, 'id' | 'isExcused' | 'createdAt' | 'updatedAt'> {}

export class Strike
  extends Model<StrikeAttributes, StrikeCreationAttributes>
  implements StrikeAttributes
{
  public id!: string;
  public studentId!: string;
  public eventId!: string;
  public reason?: string;
  public isExcused!: boolean;
  public excusedByStaffId?: string;
  public excusedAt?: Date;
  public excusedReason?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Strike.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    studentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'students',
        key: 'id',
      },
    },
    eventId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'events',
        key: 'id',
      },
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isExcused: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    excusedByStaffId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'staff',
        key: 'id',
      },
    },
    excusedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    excusedReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'strikes',
    indexes: [
      { fields: ['studentId'] },
      { fields: ['eventId'] },
      { fields: ['isExcused'] },
    ],
    hooks: {
      afterCreate: async (strike: Strike) => {
        // Update student status when strike is created
        const { updateStudentStatus } = await import('../utils/studentStatus');
        await updateStudentStatus(strike.studentId);
      },
      afterUpdate: async (strike: Strike) => {
        // Update student status when strike is updated (e.g., excused)
        const { updateStudentStatus } = await import('../utils/studentStatus');
        await updateStudentStatus(strike.studentId);
      },
      afterDestroy: async (strike: Strike) => {
        // Update student status when strike is deleted
        const { updateStudentStatus } = await import('../utils/studentStatus');
        await updateStudentStatus(strike.studentId);
      },
    },
  }
);

