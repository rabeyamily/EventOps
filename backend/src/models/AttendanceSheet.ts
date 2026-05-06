import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database/connection';

export interface AttendanceSheetAttributes {
  id: string;
  eventId: string;
  name: string;
  busNumber: string;
  createdByStaffId: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AttendanceSheetCreationAttributes
  extends Optional<AttendanceSheetAttributes, 'id' | 'isActive' | 'createdAt' | 'updatedAt'> {}

export class AttendanceSheet
  extends Model<AttendanceSheetAttributes, AttendanceSheetCreationAttributes>
  implements AttendanceSheetAttributes
{
  public id!: string;
  public eventId!: string;
  public name!: string;
  public busNumber!: string;
  public createdByStaffId!: string;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AttendanceSheet.init(
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
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    busNumber: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    createdByStaffId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'staff',
        key: 'id',
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'attendance_sheets',
    indexes: [
      { fields: ['eventId'] },
      { fields: ['busNumber'] },
      { fields: ['isActive'] },
      { fields: ['createdByStaffId'] },
    ],
  }
);
