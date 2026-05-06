import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database/connection';

export enum NotificationType {
  STRIKE_WARNING = 'strike_warning',
  STRIKE_BLOCKED = 'strike_blocked',
  EVENT_REMINDER = 'event_reminder',
  ATTENDANCE_ALERT = 'attendance_alert',
  SYSTEM = 'system',
}

export interface NotificationAttributes {
  id: string;
  staffId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  readAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NotificationCreationAttributes
  extends Optional<NotificationAttributes, 'id' | 'isRead' | 'createdAt' | 'updatedAt'> {}

export class Notification
  extends Model<NotificationAttributes, NotificationCreationAttributes>
  implements NotificationAttributes
{
  public id!: string;
  public staffId!: string;
  public type!: NotificationType;
  public title!: string;
  public message!: string;
  public data?: Record<string, any>;
  public isRead!: boolean;
  public readAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Notification.init(
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
    type: {
      type: DataTypes.ENUM(...Object.values(NotificationType)),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'notifications',
    indexes: [
      { fields: ['staffId'] },
      { fields: ['isRead'] },
      { fields: ['type'] },
      { fields: ['createdAt'] },
    ],
  }
);

