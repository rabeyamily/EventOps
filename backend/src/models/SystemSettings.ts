import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database/connection';

export interface SystemSettingsAttributes {
  id: string;
  key: string;
  value: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SystemSettingsCreationAttributes
  extends Optional<SystemSettingsAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class SystemSettings
  extends Model<SystemSettingsAttributes, SystemSettingsCreationAttributes>
  implements SystemSettingsAttributes
{
  public id!: string;
  public key!: string;
  public value!: string;
  public description?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SystemSettings.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    value: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'system_settings',
    indexes: [{ fields: ['key'] }],
  }
);
