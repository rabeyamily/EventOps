import apiClient from '../api-client';

export type DocumentCategory = 'presentation' | 'pdf' | 'spreadsheet' | 'video' | 'link' | 'other';
export type DocumentSourceType = 'link' | 'upload';

export interface Document {
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
  uploadedBy?: { id: string; fullName: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentPayload {
  title: string;
  description?: string;
  url: string;
  category?: DocumentCategory;
  cohort?: string;
}

export interface UpdateDocumentPayload {
  title?: string;
  description?: string;
  url?: string;
  category?: DocumentCategory;
  cohort?: string;
  isVisible?: boolean;
}

export async function getDocuments(filters?: { cohort?: string; category?: DocumentCategory }): Promise<Document[]> {
  const params = new URLSearchParams();
  if (filters?.cohort) params.append('cohort', filters.cohort);
  if (filters?.category) params.append('category', filters.category);
  const query = params.toString();
  const res = await apiClient.get(`/documents${query ? `?${query}` : ''}`);
  return res.data.data;
}

export async function createDocument(payload: CreateDocumentPayload): Promise<Document> {
  const res = await apiClient.post('/documents', payload);
  return res.data;
}

export async function uploadDocument(
  file: File,
  metadata: { title?: string; description?: string; category?: DocumentCategory; cohort?: string }
): Promise<Document> {
  const form = new FormData();
  form.append('file', file);
  if (metadata.title) form.append('title', metadata.title);
  if (metadata.description) form.append('description', metadata.description);
  if (metadata.category) form.append('category', metadata.category);
  if (metadata.cohort) form.append('cohort', metadata.cohort);

  const res = await apiClient.post('/documents/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function updateDocument(id: string, payload: UpdateDocumentPayload): Promise<Document> {
  const res = await apiClient.patch(`/documents/${id}`, payload);
  return res.data;
}

export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(`/documents/${id}`);
}

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  presentation: 'Presentation',
  pdf: 'PDF',
  spreadsheet: 'Spreadsheet',
  video: 'Video',
  link: 'Link',
  other: 'Other',
};

export const CATEGORY_ICONS: Record<DocumentCategory, string> = {
  presentation: '📊',
  pdf: '📄',
  spreadsheet: '📋',
  video: '🎥',
  link: '🔗',
  other: '📁',
};

/** Auto-detect category from file extension */
export function detectCategory(filename: string): DocumentCategory {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (['ppt', 'pptx', 'key'].includes(ext)) return 'presentation';
  if (['xls', 'xlsx', 'csv', 'numbers'].includes(ext)) return 'spreadsheet';
  if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) return 'video';
  return 'other';
}

/** Format file size for display */
export function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
