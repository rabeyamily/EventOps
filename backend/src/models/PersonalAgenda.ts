import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database/connection';

export interface PersonalAgendaAttributes {
  id: string;
  staffId: string;
  title: string;
  description?: string;
  completed: boolean;
  dueDate?: Date;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  color?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PersonalAgendaCreationAttributes
  extends Optional<PersonalAgendaAttributes, 'id' | 'completed' | 'createdAt' | 'updatedAt'> {}

export class PersonalAgenda
  extends Model<PersonalAgendaAttributes, PersonalAgendaCreationAttributes>
  implements PersonalAgendaAttributes
{
  public id!: string;
  public staffId!: string;
  public title!: string;
  public description?: string;
  public completed!: boolean;
  public dueDate?: Date;
  public priority?: 'low' | 'medium' | 'high';
  public tags?: string[];
  public color?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PersonalAgenda.init(
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
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    completed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    dueDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      allowNull: true,
    },
    tags: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    color: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'personal_agenda',
    indexes: [
      { fields: ['staffId'] },
      { fields: ['completed'] },
      { fields: ['dueDate'] },
    ],
  }
);
