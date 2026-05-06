import apiClient, { ApiResponse, handleApiError } from '../api-client';

export interface AttendanceSheet {
  id: string;
  eventId: string;
  name: string;
  busNumber: string;
  createdByStaffId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  event?: {
    id: string;
    name: string;
    startDate: string;
  };
  createdBy?: {
    id: string;
    fullName: string;
    email?: string;
  };
}

// Create a new attendance sheet
export const createAttendanceSheet = async (
  eventId: string,
  name: string,
  busNumber: string
): Promise<AttendanceSheet> => {
  try {
    const response = await apiClient.post<ApiResponse<AttendanceSheet>>(
      `/attendance-sheets/event/${eventId}`,
      { name, busNumber }
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to create attendance sheet');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get all attendance sheets for an event
export const getEventAttendanceSheets = async (eventId: string): Promise<AttendanceSheet[]> => {
  try {
    const response = await apiClient.get<ApiResponse<AttendanceSheet[]>>(
      `/attendance-sheets/event/${eventId}`
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch attendance sheets');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get active attendance sheet for an event
export const getActiveAttendanceSheet = async (eventId: string): Promise<AttendanceSheet | null> => {
  try {
    const response = await apiClient.get<ApiResponse<AttendanceSheet | null>>(
      `/attendance-sheets/event/${eventId}/active`
    );

    if (response.data.success) {
      return response.data.data ?? null;
    }
    throw new Error('Failed to fetch active attendance sheet');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Set a sheet as active
export const setActiveAttendanceSheet = async (sheetId: string): Promise<AttendanceSheet> => {
  try {
    const response = await apiClient.post<ApiResponse<AttendanceSheet>>(
      `/attendance-sheets/${sheetId}/activate`
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to activate attendance sheet');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Add a new bus with default sheets (Before Departure, Before Return)
export const addBus = async (eventId: string): Promise<{ busNumber: string; sheets: AttendanceSheet[] }> => {
  try {
    const response = await apiClient.post<ApiResponse<{ busNumber: string; sheets: AttendanceSheet[] }>>(
      `/attendance-sheets/event/${eventId}/add-bus`
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to add bus');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Delete a bus and all its sheets
export const deleteBus = async (eventId: string, busNumber: string): Promise<void> => {
  try {
    const response = await apiClient.delete<ApiResponse<{ deletedCount: number }>>(
      `/attendance-sheets/event/${eventId}/bus/${encodeURIComponent(busNumber)}`
    );

    if (!response.data.success) {
      throw new Error('Failed to delete bus');
    }
  } catch (error) {
    throw handleApiError(error);
  }
};

// Delete a single attendance sheet
export const deleteSheet = async (sheetId: string): Promise<void> => {
  try {
    const response = await apiClient.delete<ApiResponse<{ deleted: boolean }>>(
      `/attendance-sheets/${sheetId}`
    );

    if (!response.data.success) {
      throw new Error('Failed to delete attendance sheet');
    }
  } catch (error) {
    throw handleApiError(error);
  }
};
