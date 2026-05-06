import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database/connection';

export type DocumentCategory = 'presentation' | 'pdf' | 'spreadsheet' | 'video' | 'link' | 'other';
export type DocumentSourceType = 'link' | 'upload';

export interface DocumentAttributes {
  id: string;
  title: string;
  description?: string;
  url: string;
  category: DocumentCategory;
  sourceType: DocumentSourceType;
  fileName?: string;
  fileSize?: number;
  cohort?: string;
  uploadedByStaffId: string;
  isVisible: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DocumentCreationAttributes
  extends Optional<DocumentAttributes, 'id' | 'isVisible' | 'sourceType' | 'createdAt' | 'updatedAt'> {}

export class Document
  extends Model<DocumentAttributes, DocumentCreationAttributes>
  implements DocumentAttributes
{
  public id!: string;
  public title!: string;
  public description?: string;
  public url!: string;
  public category!: DocumentCategory;
  public sourceType!: DocumentSourceType;
  public fileName?: string;
  public fileSize?: number;
  public cohort?: string;
  public uploadedByStaffId!: string;
  public isVisible!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Document.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    sourceType: {
      type: DataTypes.ENUM('link', 'upload'),
      allowNull: false,
      defaultValue: 'link',
    },
    fileName: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    category: {
      type: DataTypes.ENUM('presentation', 'pdf', 'spreadsheet', 'video', 'link', 'other'),
      allowNull: false,
      defaultValue: 'link',
    },
    cohort: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    uploadedByStaffId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'staff',
        key: 'id',
      },
    },
    isVisible: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: 'documents',
    indexes: [
      { fields: ['uploadedByStaffId'] },
      { fields: ['cohort'] },
      { fields: ['category'] },
      { fields: ['isVisible'] },
    ],
  }
);
