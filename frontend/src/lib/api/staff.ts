import apiClient, { ApiResponse, handleApiError } from '../api-client';
import { Staff, PaginatedResponse } from '@/types';

export interface StaffFilters {
  search?: string;
  role?: 'staff' | 'admin';
  page?: number;
  limit?: number;
}

export interface StaffActivity {
  staff: Staff;
  stats: {
    eventsOrganized: number;
    attendanceMarked: number;
  };
  organizedEvents: any[];
  recentActivity: any[];
}

export interface StaffProfile extends Staff {
  stats: {
    eventsOrganized: number;
    attendanceMarked: number;
  };
}

// Get all staff members
export const getAllStaff = async (filters?: StaffFilters): Promise<PaginatedResponse<Staff>> => {
  try {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.role) params.append('role', filters.role);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await apiClient.get<any>(`/staff?${params.toString()}`);

    if (response.data.success) {
      return {
        data: response.data.data || [],
        pagination: response.data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
    }
    throw new Error('Failed to fetch staff');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get staff by ID
export const getStaffById = async (staffId: string): Promise<Staff> => {
  try {
    const response = await apiClient.get<ApiResponse<Staff>>(`/staff/${staffId}`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch staff member');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get staff activity
export const getStaffActivity = async (staffId: string): Promise<StaffActivity> => {
  try {
    const response = await apiClient.get<ApiResponse<StaffActivity>>(`/staff/${staffId}/activity`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch staff activity');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Create staff
export const createStaff = async (data: {
  fullName: string;
  preferredName?: string;
  email: string;
  nyuEmail?: string;
  classYear?: string;
  major?: string;
  minor?: string;
  notes?: string;
  role?: 'staff' | 'admin';
  position?: string;
  phone?: string;
  whatsapp?: string;
  uaePhone?: string;
  password?: string;
}): Promise<Staff> => {
  try {
    const response = await apiClient.post<ApiResponse<Staff>>('/staff', data);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to create staff member');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Update staff
export const updateStaff = async (
  staffId: string,
  data: { 
    fullName?: string;
    preferredName?: string;
    nyuEmail?: string;
    classYear?: string;
    major?: string;
    minor?: string;
    notes?: string;
    email?: string; 
    role?: 'staff' | 'admin'; 
    position?: string;
    phone?: string; 
    whatsapp?: string; 
    uaePhone?: string;
  }
): Promise<Staff> => {
  try {
    const response = await apiClient.put<ApiResponse<Staff>>(`/staff/${staffId}`, data);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to update staff member');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Delete staff
export const deleteStaff = async (staffId: string): Promise<void> => {
  try {
    const response = await apiClient.delete<ApiResponse<null>>(`/staff/${staffId}`);
    if (!response.data.success) {
      throw new Error('Failed to delete staff member');
    }
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get current user profile
export const getCurrentProfile = async (): Promise<StaffProfile> => {
  try {
    const response = await apiClient.get<ApiResponse<StaffProfile>>('/staff/me');
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch profile');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Update current user's own profile
export const updateCurrentProfile = async (data: {
  preferredName?: string;
  phone?: string;
  whatsapp?: string;
  uaePhone?: string;
  nyuEmail?: string;
  classYear?: string;
  major?: string;
  minor?: string;
  notes?: string;
}): Promise<StaffProfile> => {
  try {
    const response = await apiClient.put<ApiResponse<StaffProfile>>('/staff/me', data);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to update profile');
  } catch (error) {
    throw handleApiError(error);
  }
};

/** Import staff / GEO directory entries from CSV (admin only). */
export const importStaffCSV = async (file: File): Promise<any> => {
  try {
    const formData = new FormData();
    formData.append('csv', file);

    const response = await apiClient.post<ApiResponse<any>>('/staff/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to import CSV');
  } catch (error) {
    throw handleApiError(error);
  }
};
