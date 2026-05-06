import apiClient, { ApiResponse, handleApiError } from '../api-client';
import { Attendance, Student, Event, Staff } from '@/types';

export interface AttendanceWithDetails extends Attendance {
  student?: Student;
  markedBy?: Staff;
  event?: Event;
}

export interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  notMarked: number;
}

export interface EventAttendanceResponse {
  attendances: AttendanceWithDetails[];
  summary: AttendanceSummary;
}

export interface StudentAttendanceResponse {
  attendances: AttendanceWithDetails[];
  stats: {
    total: number;
    present: number;
    absent: number;
    attendanceRate: number;
  };
}

// Get all attendance records for an event
export const getEventAttendance = async (
  eventId: string,
  status?: 'present' | 'absent' | 'not_marked',
  sheetId?: string,
  filterBySheet?: boolean // If true, only return attendance for the active/specified sheet
): Promise<EventAttendanceResponse> => {
  try {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (sheetId) params.append('sheetId', sheetId);
    if (filterBySheet) params.append('filterBySheet', 'true');

    const response = await apiClient.get<ApiResponse<EventAttendanceResponse>>(
      `/attendance/event/${eventId}?${params.toString()}`
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch attendance');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get attendance summary for an event
export const getEventAttendanceSummary = async (eventId: string): Promise<AttendanceSummary> => {
  try {
    const response = await apiClient.get<ApiResponse<AttendanceSummary>>(
      `/attendance/event/${eventId}/summary`
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch attendance summary');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Mark attendance for a single student
export const markAttendance = async (
  eventId: string,
  studentId: string,
  status: 'present' | 'absent' | 'not_marked',
  options?: { notes?: string; isHandOffMode?: boolean }
): Promise<AttendanceWithDetails> => {
  try {
    const response = await apiClient.post<ApiResponse<AttendanceWithDetails>>(
      `/attendance/event/${eventId}/student/${studentId}`,
      { status, ...options }
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to mark attendance');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Quick tap to toggle attendance (present <-> not_marked)
export const quickTapAttendance = async (
  eventId: string,
  studentId: string,
  isHandOffMode?: boolean
): Promise<AttendanceWithDetails> => {
  try {
    const response = await apiClient.post<ApiResponse<AttendanceWithDetails>>(
      `/attendance/event/${eventId}/student/${studentId}/tap`,
      { isHandOffMode }
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to toggle attendance');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Bulk mark attendance
export const bulkMarkAttendance = async (
  eventId: string,
  studentIds: string[],
  status: 'present' | 'absent' | 'not_marked',
  notes?: string
): Promise<{ created: number; updated: number; total: number }> => {
  try {
    const response = await apiClient.post<ApiResponse<{ created: number; updated: number; total: number }>>(
      `/attendance/event/${eventId}/bulk`,
      { studentIds, status, notes }
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to bulk mark attendance');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Mark all unmarked students as absent
export const markAllAbsent = async (eventId: string): Promise<{ updated: number }> => {
  try {
    const response = await apiClient.post<ApiResponse<{ updated: number }>>(
      `/attendance/event/${eventId}/mark-all-absent`
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to mark all absent');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Update attendance notes
export const updateAttendanceNotes = async (
  attendanceId: string,
  notes: string
): Promise<AttendanceWithDetails> => {
  try {
    const response = await apiClient.patch<ApiResponse<AttendanceWithDetails>>(
      `/attendance/${attendanceId}/notes`,
      { notes }
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to update notes');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get attendance history for a student
export const getStudentAttendanceHistory = async (
  studentId: string
): Promise<StudentAttendanceResponse> => {
  try {
    const response = await apiClient.get<ApiResponse<StudentAttendanceResponse>>(
      `/attendance/student/${studentId}`
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch student attendance');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Export event attendance as CSV (returns download URL)
export const exportEventAttendanceCSV = (eventId: string): string => {
  return `${process.env.NEXT_PUBLIC_API_URL || '/api'}/attendance/event/${eventId}/export`;
};

// Export attendance report with date range (returns download URL)
export const exportAttendanceReportCSV = (startDate?: string, endDate?: string): string => {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  const queryString = params.toString();
  return `${process.env.NEXT_PUBLIC_API_URL || '/api'}/attendance/export${queryString ? `?${queryString}` : ''}`;
};

