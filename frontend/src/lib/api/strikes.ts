import apiClient, { ApiResponse, handleApiError } from '../api-client';
import { Strike, Student, Event, Staff } from '@/types';

export interface StrikeWithDetails extends Strike {
  event?: Event;
  student?: Student;
  excusedBy?: Staff;
}

export interface StudentStrikesResponse {
  strikes: StrikeWithDetails[];
  stats: {
    total: number;
    active: number;
    excused: number;
  };
  studentStatus: string;
}

export interface AtRiskStudentsResponse {
  students: (Student & { strikes?: StrikeWithDetails[] })[];
  summary: {
    total: number;
    oneStrike: number;
    blocked: number;
  };
}

// Get strikes for a student
export const getStudentStrikes = async (
  studentId: string,
  includeExcused: boolean = true
): Promise<StudentStrikesResponse> => {
  try {
    const params = new URLSearchParams();
    if (includeExcused) params.append('includeExcused', 'true');

    const response = await apiClient.get<ApiResponse<StudentStrikesResponse>>(
      `/strikes/student/${studentId}?${params.toString()}`
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch student strikes');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Create a strike manually
export const createStrike = async (
  studentId: string,
  eventId: string,
  reason?: string
): Promise<StrikeWithDetails> => {
  try {
    const response = await apiClient.post<ApiResponse<StrikeWithDetails>>(
      '/strikes',
      { studentId, eventId, reason }
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to create strike');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Excuse a strike
export const excuseStrike = async (
  strikeId: string,
  reason?: string
): Promise<StrikeWithDetails> => {
  try {
    const response = await apiClient.patch<ApiResponse<StrikeWithDetails>>(
      `/strikes/${strikeId}/excuse`,
      { reason }
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to excuse strike');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Reinstate a strike
export const reinstateStrike = async (strikeId: string): Promise<StrikeWithDetails> => {
  try {
    const response = await apiClient.patch<ApiResponse<StrikeWithDetails>>(
      `/strikes/${strikeId}/reinstate`
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to reinstate strike');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Delete a strike
export const deleteStrike = async (strikeId: string): Promise<void> => {
  try {
    const response = await apiClient.delete<ApiResponse<null>>(`/strikes/${strikeId}`);

    if (!response.data.success) {
      throw new Error('Failed to delete strike');
    }
  } catch (error) {
    throw handleApiError(error);
  }
};

// Process strikes for an event
export const processEventStrikes = async (
  eventId: string
): Promise<{ strikesCreated: number; strikesSkipped: number }> => {
  try {
    const response = await apiClient.post<ApiResponse<{ strikesCreated: number; strikesSkipped: number }>>(
      `/strikes/event/${eventId}/process`
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to process event strikes');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get students at risk
export const getStudentsAtRisk = async (cohort?: string): Promise<AtRiskStudentsResponse> => {
  try {
    const params = new URLSearchParams();
    if (cohort) params.append('cohort', cohort);
    const response = await apiClient.get<ApiResponse<AtRiskStudentsResponse>>(`/strikes/at-risk?${params.toString()}`);

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch at-risk students');
  } catch (error) {
    throw handleApiError(error);
  }
};

