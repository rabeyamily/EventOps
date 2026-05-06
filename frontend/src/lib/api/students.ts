import apiClient, { ApiResponse, handleApiError } from '../api-client';
import { Student, PaginatedResponse, Attendance, Strike } from '@/types';

export interface StudentFilters {
  search?: string;
  campus?: 'NYC' | 'Shanghai';
  cohort?: string;
  status?: 'clear' | 'one_strike' | 'blocked';
  missingInfo?: boolean;
  page?: number;
  limit?: number;
}

// Get all students with filters
export const getStudents = async (
  filters?: StudentFilters
): Promise<PaginatedResponse<Student>> => {
  try {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.campus) params.append('campus', filters.campus);
    if (filters?.cohort) params.append('cohort', filters.cohort);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.missingInfo === true) params.append('missingInfo', 'true');
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await apiClient.get<any>(`/students?${params.toString()}`);
    
    if (response.data.success) {
      // Backend returns { success, data: [...], pagination: {...} }
      return {
        data: response.data.data || [],
        pagination: response.data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
    }
    throw new Error('Failed to fetch students');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get student by ID
export const getStudentById = async (id: string): Promise<Student> => {
  try {
    const response = await apiClient.get<ApiResponse<Student>>(`/students/${id}`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch student');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Create student (Admin only)
export const createStudent = async (studentData: Partial<Student>): Promise<Student> => {
  try {
    const response = await apiClient.post<ApiResponse<Student>>('/students', studentData);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to create student');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Update student (Admin only)
export const updateStudent = async (
  id: string,
  studentData: Partial<Student>
): Promise<Student> => {
  try {
    const response = await apiClient.put<ApiResponse<Student>>(
      `/students/${id}`,
      studentData
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to update student');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Delete student (Admin only)
export const deleteStudent = async (id: string): Promise<void> => {
  try {
    await apiClient.delete(`/students/${id}`);
  } catch (error) {
    throw handleApiError(error);
  }
};

// Upload student photo (Admin only)
export const uploadStudentPhoto = async (
  id: string,
  file: File
): Promise<Student> => {
  try {
    const formData = new FormData();
    formData.append('photo', file);

    const response = await apiClient.post<ApiResponse<{ photoUrl: string }>>(
      `/students/${id}/photo`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    
    if (response.data.success && response.data.data) {
      // Fetch updated student to get full object
      return await getStudentById(id);
    }
    throw new Error('Failed to upload photo');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Delete student photo (Admin only)
export const deleteStudentPhoto = async (id: string): Promise<void> => {
  try {
    await apiClient.delete(`/students/${id}/photo`);
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get student attendance history
export const getStudentAttendanceHistory = async (id: string): Promise<Attendance[]> => {
  try {
    const response = await apiClient.get<ApiResponse<Attendance[]>>(`/students/${id}/attendance`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch attendance history');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get student strike history
export const getStudentStrikeHistory = async (id: string): Promise<Strike[]> => {
  try {
    const response = await apiClient.get<ApiResponse<Strike[]>>(`/students/${id}/strikes`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch strike history');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Import students from CSV (Admin only)
export const importStudentsCSV = async (file: File): Promise<any> => {
  try {
    const formData = new FormData();
    formData.append('csv', file);

    const response = await apiClient.post<ApiResponse<any>>(
      '/students/import',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to import CSV');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Import students from Google Sheet by semester (Admin only)
export const importStudentsFromGoogleSheet = async (semester: string): Promise<any> => {
  try {
    const response = await apiClient.post<ApiResponse<any>>('/students/import/google-sheet', {
      semester,
    });

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to import students from Google Sheet');
  } catch (error) {
    throw handleApiError(error);
  }
};

