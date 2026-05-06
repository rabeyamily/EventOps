import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database/connection';

export enum StaffRole {
  STAFF = 'staff',
  ADMIN = 'admin',
}

export interface StaffAttributes {
  id: string;
  fullName: string;
  preferredName?: string;
  email: string;
  passwordHash?: string;
  nyuEmail?: string;
  classYear?: string;
  major?: string;
  minor?: string;
  notes?: string;
  role: StaffRole;
  position?: string;
  phone?: string;
  whatsapp?: string;
  uaePhone?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StaffCreationAttributes
  extends Optional<StaffAttributes, 'id' | 'role' | 'passwordHash' | 'createdAt' | 'updatedAt'> {}

export class Staff
  extends Model<StaffAttributes, StaffCreationAttributes>
  implements StaffAttributes
{
  public id!: string;
  public fullName!: string;
  public preferredName?: string;
  public email!: string;
  public passwordHash?: string;
  public nyuEmail?: string;
  public classYear?: string;
  public major?: string;
  public minor?: string;
  public notes?: string;
  public role!: StaffRole;
  public position?: string;
  public phone?: string;
  public whatsapp?: string;
  public uaePhone?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Staff.init(
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
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    nyuEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true,
      },
    },
    classYear: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    major: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    minor: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM(...Object.values(StaffRole)),
      allowNull: false,
      defaultValue: StaffRole.STAFF,
    },
    position: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'GEO', // Default to GEO (Global Education Officer)
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    whatsapp: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    uaePhone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'staff',
    indexes: [
      { fields: ['email'] },
      { fields: ['nyuEmail'] },
      { fields: ['role'] },
      { fields: ['position'] },
      { fields: ['classYear'] },
    ],
  }
);

