import apiClient, { ApiResponse, handleApiError } from '../api-client';
import { Event, PaginatedResponse, AttendanceMode } from '@/types';

export interface EventFilters {
  search?: string;
  attendanceMode?: AttendanceMode;
  isLocked?: boolean;
  startDate?: string;
  endDate?: string;
  upcoming?: boolean;
  past?: boolean;
  semester?: string;
  academicYear?: number;
  page?: number;
  limit?: number;
}

export interface CreateEventPayload {
  name: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  leadOrganizerId: string;
  leadOrganizer2Id?: string | null;
  leadOrganizer3Id?: string | null;
  leadOrganizerIds?: string[];
  assignedGeoIds?: string[];
  attendanceMode?: AttendanceMode;
  notes?: string;
}

export interface UpdateEventPayload extends Partial<CreateEventPayload> {
  isLocked?: boolean;
}

// Get all events with filters
export const getEvents = async (
  filters?: EventFilters
): Promise<PaginatedResponse<Event>> => {
  try {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.attendanceMode) params.append('attendanceMode', filters.attendanceMode);
    if (filters?.isLocked !== undefined) params.append('isLocked', String(filters.isLocked));
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.upcoming) params.append('upcoming', 'true');
    if (filters?.past) params.append('past', 'true');
    if (filters?.semester) params.append('semester', filters.semester);
    if (filters?.academicYear) params.append('academicYear', filters.academicYear.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await apiClient.get<any>(`/events?${params.toString()}`);
    
    if (response.data.success) {
      // Backend returns { success, data: [...], pagination: {...} }
      return {
        data: response.data.data || [],
        pagination: response.data.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
    }
    throw new Error('Failed to fetch events');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get event by ID
export const getEventById = async (id: string): Promise<Event> => {
  try {
    const response = await apiClient.get<ApiResponse<Event>>(`/events/${id}`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch event');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get calendar events
export const getCalendarEvents = async (
  year: number,
  month: number,
  semester?: string,
  academicYear?: number
): Promise<Event[]> => {
  try {
    let url = `/events/calendar?year=${year}&month=${month}`;
    if (semester && academicYear) {
      url += `&semester=${semester}&academicYear=${academicYear}`;
    }
    const response = await apiClient.get<ApiResponse<Event[]>>(url);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch calendar events');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get upcoming events
export const getUpcomingEvents = async (limit: number = 5): Promise<Event[]> => {
  try {
    const response = await apiClient.get<ApiResponse<Event[]>>(
      `/events/upcoming?limit=${limit}`
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch upcoming events');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Create event (Admin only)
export const createEvent = async (eventData: CreateEventPayload): Promise<Event> => {
  try {
    const response = await apiClient.post<ApiResponse<Event>>('/events', eventData);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to create event');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Update event (Admin only)
export const updateEvent = async (
  id: string,
  eventData: UpdateEventPayload
): Promise<Event> => {
  try {
    const response = await apiClient.put<ApiResponse<Event>>(
      `/events/${id}`,
      eventData
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to update event');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Delete event (Admin only)
export const deleteEvent = async (id: string): Promise<void> => {
  try {
    await apiClient.delete(`/events/${id}`);
  } catch (error) {
    throw handleApiError(error);
  }
};

// Lock event
export const lockEvent = async (id: string, reason?: string): Promise<Event> => {
  try {
    const response = await apiClient.post<ApiResponse<Event>>(`/events/${id}/lock`, { reason });
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to lock event');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Unlock event (Admin only)
export const unlockEvent = async (id: string): Promise<Event> => {
  try {
    const response = await apiClient.post<ApiResponse<Event>>(`/events/${id}/unlock`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to unlock event');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Mark event as departed
export const markEventDeparted = async (id: string): Promise<Event> => {
  try {
    const response = await apiClient.post<ApiResponse<Event>>(`/events/${id}/depart`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to mark event as departed');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Import events from CSV
export const importEventsCSV = async (file: File, year: number = new Date().getFullYear()): Promise<any> => {
  try {
    const formData = new FormData();
    formData.append('csv', file);
    formData.append('year', year.toString());

    const response = await apiClient.post<ApiResponse<any>>(
      '/events/import',
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
    throw new Error('Failed to import events');
  } catch (error) {
    throw handleApiError(error);
  }
};

