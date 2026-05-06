import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';

// Resolve API host for both localhost and LAN testing sessions.
// This helper remains useful for fallback behavior and diagnostics.
const getApiUrl = () => {
  // Explicit env config always wins.
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // When opened from another device on the same network, reuse that host.
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // If accessing via IP address (not localhost), use that IP for API
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:3001`;
    }
  }
  
  // Safe local default for dev.
  return 'http://localhost:3001';
};

// Shared axios client with conservative defaults for UI responsiveness.
const apiClient: AxiosInstance = axios.create({
  withCredentials: true, // Important for session cookies
  // Prevent tabs from hanging forever on stalled network/auth requests.
  timeout: 15000,
  timeoutErrorMessage: 'Request timed out. Please try again.',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Compute base URL per request so tab host changes are reflected immediately.
apiClient.interceptors.request.use(
  (config) => {
    // Read hostname at request time to avoid stale closures after navigation.
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const apiUrl = hostname !== 'localhost' && hostname !== '127.0.0.1'
      ? `http://${hostname}:3001`
      : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
    
    config.baseURL = `${apiUrl}/api`;
    
    // Cookie-based auth relies on credentials for every call.
    config.withCredentials = true;
    
    // Verbose logging in dev helps debug mixed localhost/LAN environments.
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('🔗 API URL:', apiUrl);
      console.log('🌐 Current hostname:', hostname);
      console.log('📤 Making request to:', config.method?.toUpperCase(), config.baseURL + (config.url || ''));
    }
    
    // Don't set Content-Type for FormData (let browser set it with boundary)
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    // Keep response logging local to development sessions.
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('✅ Response received:', response.config.method?.toUpperCase(), response.config.url, response.status);
    }
    return response;
  },
  async (error: AxiosError) => {
    // Surface actionable context for network/auth troubleshooting.
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ API Error:', {
        message: error.message,
        code: (error as any).code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        fullUrl: (error.config?.baseURL || '') + (error.config?.url || ''),
        data: error.response?.data,
        request: {
          method: error.config?.method,
          headers: error.config?.headers,
          withCredentials: error.config?.withCredentials,
        },
      });
      
      // Safari on iOS can fail differently on local network setups.
      if (typeof window !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
        console.error('📱 iPhone detected - Error details:', {
          userAgent: navigator.userAgent,
          hostname: window.location.hostname,
          protocol: window.location.protocol,
        });
      }
    }

    // Route guards decide how to react to auth expiration.
    if (error.response?.status === 401) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Received 401 response; skipping global redirect and deferring to route guards.');
      }
    }

    // Permission failures are expected in role-restricted views.
    if (error.response?.status === 403) {
      console.error('Permission denied');
    }

    // Surface throttling separately so UI can suggest retry behavior.
    if (error.response?.status === 429) {
      console.error('Rate limit exceeded');
    }

    // No response means transport/CORS/connectivity failure before API logic.
    if (!error.response) {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      const apiUrl = hostname !== 'localhost' && hostname !== '127.0.0.1'
        ? `http://${hostname}:3001`
        : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
      
      console.error('🌐 Network Error - Check if backend is accessible at:', apiUrl);
      console.error('Error details:', error.message);
      console.error('Error code:', (error as any).code);
      console.error('Current hostname:', hostname);
      console.error('Full error:', error);
      
      // Keep iOS-specific hinting close to the failure path.
      if (typeof window !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
        console.error('📱 iPhone detected - Check Safari settings and network connectivity');
      }
    }

    return Promise.reject(error);
  }
);

// Standard success envelope returned by backend endpoints.
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

// Standard error envelope returned by backend endpoints.
export interface ApiError {
  error: string;
  message?: string;
  details?: any;
}

// Normalize unknown errors into a consistent shape for UI consumption.
export const handleApiError = (error: unknown): ApiError => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiError>;
    return {
      error: axiosError.response?.data?.error || 'An error occurred',
      message: axiosError.response?.data?.message,
      details: axiosError.response?.data?.details,
    };
  }
  return {
    error: 'An unexpected error occurred',
  };
};

export default apiClient;

