import apiClient, { ApiResponse, handleApiError } from '../api-client';

export interface User {
  id: string;
  email: string;
  fullName: string;
  preferredName?: string;
  role: 'staff' | 'admin';
  phone?: string;
}

export type UserRole = User['role'];

export interface AuthResponse {
  user: User;
}

export const getCurrentUser = async (): Promise<User> => {
  try {
    const response = await apiClient.get<ApiResponse<AuthResponse>>('/auth/me');
    if (response.data.success && response.data.data?.user) {
      return response.data.data.user;
    }
    throw new Error('Failed to get user');
  } catch (error) {
    throw handleApiError(error);
  }
};

export const signUp = async (data: {
  email: string;
  password: string;
  fullName?: string;
  role?: 'staff' | 'admin';
}): Promise<{ user: User; message: string }> => {
  try {
    const response = await apiClient.post<ApiResponse<{ user: User; message: string }>>('/auth/signup', data);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Sign up failed');
  } catch (error) {
    throw handleApiError(error);
  }
};

export const login = async (data: { email: string; password: string; role: 'staff' | 'admin' }): Promise<User> => {
  try {
    const response = await apiClient.post<ApiResponse<AuthResponse>>('/auth/login', data);
    if (response.data.success && response.data.data?.user) {
      return response.data.data.user;
    }
    throw new Error('Login failed');
  } catch (error) {
    throw handleApiError(error);
  }
};

export const lookupRoleByEmail = async (email: string): Promise<UserRole | null> => {
  try {
    const response = await apiClient.get<ApiResponse<{ role: UserRole | null }>>('/auth/lookup-role', {
      params: { email },
    });

    if (response.data.success) {
      return response.data.data?.role ?? null;
    }

    throw new Error('Failed to look up role');
  } catch (error) {
    throw handleApiError(error);
  }
};

export const logout = async (): Promise<void> => {
  try {
    await apiClient.post('/auth/logout');
  } catch (error) {
    throw handleApiError(error);
  }
};

export const deleteAccount = async (password?: string): Promise<void> => {
  try {
    await apiClient.delete('/auth/delete-account', { data: { password } });
  } catch (error) {
    throw handleApiError(error);
  }
};
