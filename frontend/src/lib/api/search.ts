import apiClient, { ApiResponse, handleApiError } from '../api-client';
import { Student, Event, Staff } from '@/types';
import { getStudents } from './students';
import { getEvents } from './events';
import { getAllStaff } from './staff';

export interface SearchResult {
  students: Student[];
  events: Event[];
  staff: Staff[];
}

// Global search across all entities
export const globalSearch = async (query: string, limit: number = 5): Promise<SearchResult> => {
  try {
    if (!query || query.trim().length === 0) {
      return { students: [], events: [], staff: [] };
    }

    // Search all entities in parallel
    const [studentsResponse, eventsResponse, staffResponse] = await Promise.all([
      getStudents({ search: query, limit, page: 1 }).catch(() => ({ data: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } })),
      getEvents({ search: query, limit, page: 1 }).catch(() => ({ data: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } })),
      getAllStaff({ search: query, limit, page: 1 }).catch(() => ({ data: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } })),
    ]);

    return {
      students: studentsResponse.data || [],
      events: eventsResponse.data || [],
      staff: staffResponse.data || [],
    };
  } catch (error) {
    throw handleApiError(error);
  }
};
