import apiClient, { ApiResponse, handleApiError } from '../api-client';

export interface StaffNoteData {
  id?: string;
  staffId?: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

export const getMyNote = async (): Promise<StaffNoteData> => {
  try {
    const response = await apiClient.get<ApiResponse<StaffNoteData>>('/staff-notes');
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    return { content: '' };
  } catch (error) {
    throw handleApiError(error);
  }
};

export const saveMyNote = async (content: string): Promise<StaffNoteData> => {
  try {
    const response = await apiClient.put<ApiResponse<StaffNoteData>>('/staff-notes', { content });
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to save note');
  } catch (error) {
    throw handleApiError(error);
  }
};
