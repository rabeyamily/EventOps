import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database/connection';

export interface StaffNoteAttributes {
  id: string;
  staffId: string;
  content: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StaffNoteCreationAttributes
  extends Optional<StaffNoteAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class StaffNote
  extends Model<StaffNoteAttributes, StaffNoteCreationAttributes>
  implements StaffNoteAttributes
{
  public id!: string;
  public staffId!: string;
  public content!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

StaffNote.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    staffId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'staff',
        key: 'id',
      },
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
    },
  },
  {
    sequelize,
    tableName: 'staff_notes',
    indexes: [
      { fields: ['staffId'], unique: true },
    ],
  }
);
