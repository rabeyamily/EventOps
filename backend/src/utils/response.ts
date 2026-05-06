import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Success response helper
export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  message?: string
): void => {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  
  if (message) {
    response.message = message;
  }
  
  res.status(statusCode).json(response);
};

// Error response helper
export const sendError = (
  res: Response,
  error: string,
  statusCode: number = 400,
  message?: string
): void => {
  const response: ApiResponse = {
    success: false,
    error,
  };
  
  if (message) {
    response.message = message;
  }
  
  res.status(statusCode).json(response);
};

// Paginated response helper
export const sendPaginated = <T>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  extra?: Record<string, any>,
  statusCode: number = 200,
): void => {
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  
  const response: ApiResponse<T[]> = {
    success: true,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages,
    },
    ...extra, // Include extra fields like summary
  };
  
  res.status(statusCode).json(response);
};

