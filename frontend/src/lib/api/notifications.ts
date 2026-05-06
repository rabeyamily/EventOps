import apiClient, { ApiResponse, handleApiError } from '../api-client';
import { PaginatedResponse } from '@/types';

export interface Notification {
  id: string;
  staffId: string;
  type: 'strike_warning' | 'strike_blocked' | 'event_reminder' | 'attendance_alert' | 'system';
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferences {
  strikeAlerts: boolean;
  eventReminders: boolean;
  dailySummary: boolean;
  attendanceAlerts: boolean;
}

export interface NotificationsResponse {
  data: Notification[];
  pagination: any;
  unreadCount: number;
}

// Get notifications
export const getNotifications = async (
  unreadOnly: boolean = false,
  page: number = 1,
  limit: number = 20
): Promise<NotificationsResponse> => {
  try {
    const params = new URLSearchParams();
    if (unreadOnly) params.append('unreadOnly', 'true');
    params.append('page', page.toString());
    params.append('limit', limit.toString());

    const response = await apiClient.get<any>(`/notifications?${params.toString()}`);

    if (response.data.success) {
      return {
        data: response.data.data || [],
        pagination: response.data.pagination,
        unreadCount: response.data.unreadCount || 0,
      };
    }
    throw new Error('Failed to fetch notifications');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Mark notification as read
export const markAsRead = async (notificationId: string): Promise<Notification> => {
  try {
    const response = await apiClient.patch<ApiResponse<Notification>>(
      `/notifications/${notificationId}/read`
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to mark notification as read');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Mark all notifications as read
export const markAllAsRead = async (): Promise<void> => {
  try {
    const response = await apiClient.post<ApiResponse<null>>('/notifications/mark-all-read');
    if (!response.data.success) {
      throw new Error('Failed to mark all as read');
    }
  } catch (error) {
    throw handleApiError(error);
  }
};

// Delete notification
export const deleteNotification = async (notificationId: string): Promise<void> => {
  try {
    const response = await apiClient.delete<ApiResponse<null>>(`/notifications/${notificationId}`);
    if (!response.data.success) {
      throw new Error('Failed to delete notification');
    }
  } catch (error) {
    throw handleApiError(error);
  }
};

// Get notification preferences
export const getPreferences = async (): Promise<NotificationPreferences> => {
  try {
    const response = await apiClient.get<ApiResponse<NotificationPreferences>>(
      '/notifications/preferences'
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch preferences');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Update notification preferences
export const updatePreferences = async (
  preferences: Partial<NotificationPreferences>
): Promise<NotificationPreferences> => {
  try {
    const response = await apiClient.put<ApiResponse<NotificationPreferences>>(
      '/notifications/preferences',
      preferences
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to update preferences');
  } catch (error) {
    throw handleApiError(error);
  }
};

// Generate daily summary (admin only)
export const generateDailySummary = async (): Promise<void> => {
  try {
    const response = await apiClient.post<ApiResponse<null>>('/notifications/daily-summary');
    if (!response.data.success) {
      throw new Error('Failed to generate daily summary');
    }
  } catch (error) {
    throw handleApiError(error);
  }
};

// Generate student attention alerts (admin only)
export const generateStudentAlerts = async (): Promise<void> => {
  try {
    const response = await apiClient.post<ApiResponse<null>>('/notifications/student-alerts');
    if (!response.data.success) {
      throw new Error('Failed to generate student alerts');
    }
  } catch (error) {
    throw handleApiError(error);
  }
};

