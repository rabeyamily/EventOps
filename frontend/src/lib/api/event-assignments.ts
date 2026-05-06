import apiClient, { ApiResponse, handleApiError } from '../api-client';
import { Student, PaginatedResponse, Attendance } from '@/types';

export interface AssignmentWithStudent extends Attendance {
  student: Student;
}

export interface AssignmentSummary {
  total: number;
  present: number;
  absent: number;
  notMarked: number;
}

export interface AssignmentsResponse {
  data: AssignmentWithStudent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: AssignmentSummary;
}

export interface BulkAssignResult {
  assigned: number;
  skipped: number;
  total: number;
}

// Get assigned students for an event
export const getEventAssignments = async (
  eventId: string,
  params?: { page?: number; limit?: number; search?: string; _t?: number }
): Promise<AssignmentsResponse> => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?._t) queryParams.append('_t', params._t.toString()); // Cache busting

    const response = await apiClient.get<ApiResponse<any>>(
      `/events/${eventId}/assignments?${queryParams.toString()}`
    );
    
    console.log('Raw API response:', response.data);
    
    if (response.data.success) {
      const apiData = response.data as any;
      return {
        data: (apiData.data || []) as AssignmentWithStudent[],
        pagination: apiData.pagination || {
          page: 1,
          limit: 100,
          total: 0,
          totalPages: 0,
        },
        summary: apiData.summary || {
          total: 0,
          present: 0,
          absent: 0,
          notMarked: 0,
        },
      } as AssignmentsResponse;
    }
    throw new Error('Failed to fetch assignments');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get unassigned students for an event
export const getUnassignedStudents = async (
  eventId: string,
  params?: { page?: number; limit?: number; search?: string; campus?: string; cohort?: string }
): Promise<PaginatedResponse<Student>> => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.campus) queryParams.append('campus', params.campus);
    if (params?.cohort) queryParams.append('cohort', params.cohort);

    const response = await apiClient.get<ApiResponse<PaginatedResponse<Student>>>(
      `/events/${eventId}/unassigned?${queryParams.toString()}`
    );
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch unassigned students');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Assign single student to event
export const assignStudent = async (
  eventId: string,
  studentId: string
): Promise<AssignmentWithStudent> => {
  try {
    const response = await apiClient.post<ApiResponse<AssignmentWithStudent>>(
      `/events/${eventId}/assignments`,
      { studentId }
    );
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to assign student');
  } catch (error: any) {
    // Extract detailed error message from API response
    if (error?.response?.data) {
      const errorData = error.response.data;
      
      // Handle validation errors with details array
      if (errorData.details && Array.isArray(errorData.details)) {
        const details = errorData.details.map((d: any) => `${d.path}: ${d.message}`).join(', ');
        throw new Error(`Validation failed: ${details}`);
      }
      
      // Handle standard API error format: { success: false, error: "...", message: "..." }
      if (errorData.error) {
        throw new Error(errorData.message || errorData.error);
      }
      
      // Handle error object format: { error: { message: "..." } }
      if (errorData.error?.message) {
        throw new Error(errorData.error.message);
      }
      
      // Handle simple message format
      if (errorData.message) {
        throw new Error(errorData.message);
      }
    }
    
    // Fallback to handleApiError
    const apiError = handleApiError(error);
    throw new Error(apiError.message || apiError.error || 'Failed to assign student');
  }
};

// Bulk assign students to event
export const bulkAssignStudents = async (
  eventId: string,
  mode: 'all' | 'campus' | 'cohort',
  campus?: string,
  cohort?: string
): Promise<BulkAssignResult> => {
  try {
    const response = await apiClient.post<ApiResponse<BulkAssignResult>>(
      `/events/${eventId}/assignments/bulk`,
      { mode, campus, cohort }
    );
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to bulk assign students');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Remove student from event
export const removeAssignment = async (
  eventId: string,
  studentId: string
): Promise<void> => {
  try {
    await apiClient.delete(`/events/${eventId}/assignments/${studentId}`);
  } catch (error) {
    throw handleApiError(error);
  }
};

// Clear all assignments from event
export const clearAssignments = async (eventId: string): Promise<{ removed: number }> => {
  try {
    const response = await apiClient.delete<ApiResponse<{ removed: number }>>(
      `/events/${eventId}/assignments`
    );
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to clear assignments');
  } catch (error) {
    throw handleApiError(error);
  }
};

