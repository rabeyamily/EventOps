import apiClient, { ApiResponse, handleApiError } from '../api-client';
import { Semester } from '@/types';

export interface CurrentSemester {
  semester: Semester;
  academicYear: number;
  semesterString: string;
}

// Get current active semester
export const getCurrentSemester = async (): Promise<CurrentSemester> => {
  try {
    const response = await apiClient.get<ApiResponse<CurrentSemester>>('/system-settings/current-semester');
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch current semester');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get list of available semesters (admin-managed; add via Settings)
export const getAvailableSemesters = async (): Promise<string[]> => {
  try {
    const response = await apiClient.get<ApiResponse<string[]>>('/system-settings/available-semesters');
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    return [];
  } catch (error) {
    return [];
  }
};

// Add a semester to the admin-managed list (Admin only)
export const addAvailableSemester = async (
  semester: Semester,
  academicYear: number
): Promise<string[]> => {
  try {
    const response = await apiClient.post<ApiResponse<string[]>>('/system-settings/available-semesters', {
      semester,
      academicYear,
    });
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    return [];
  } catch (error) {
    throw handleApiError(error);
  }
};

// Update current active semester (Admin only)
export const updateCurrentSemester = async (
  semester: Semester,
  academicYear: number
): Promise<CurrentSemester> => {
  try {
    const response = await apiClient.put<ApiResponse<CurrentSemester>>('/system-settings/current-semester', {
      semester,
      academicYear,
    });
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to update current semester');
  } catch (error) {
    throw handleApiError(error);
  }
};
