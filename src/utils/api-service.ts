import { browserEnv } from '../config/browser-env';
import AuthService from './auth-service';
import toast from 'react-hot-toast';

// API Gateway URL
const apiUrl = browserEnv.VITE_AWS_API_GATEWAY_URL || '';

// Default request headers
const getDefaultHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  // Add authorization header if user is authenticated
  const token = AuthService.getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

/**
 * Generic API request method
 * @param endpoint The API endpoint
 * @param method The HTTP method
 * @param data The request body data
 * @param customHeaders Additional headers
 * @returns Promise with response data
 */
export async function apiRequest<T = any>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: any,
  customHeaders?: Record<string, string>
): Promise<T> {
  try {
    // Validate API URL
    if (!apiUrl) {
      throw new Error('API Gateway URL is not configured');
    }

    // Prepare request options
    const headers = {
      ...getDefaultHeaders(),
      ...customHeaders
    };

    const options: RequestInit = {
      method,
      headers,
      credentials: 'include'
    };

    // Add request body for non-GET requests
    if (method !== 'GET' && data) {
      options.body = JSON.stringify(data);
    }

    // Make the request
    const url = `${apiUrl}${endpoint}`;
    const response = await fetch(url, options);

    // Handle non-2xx responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Request failed with status ${response.status}`);
    }

    // Parse response
    const responseData = await response.json();
    return responseData as T;
  } catch (error) {
    console.error(`API request error (${endpoint}):`, error);
    
    // Show error toast
    const errorMessage = error instanceof Error ? error.message : 'API request failed';
    toast.error(errorMessage);
    
    throw error;
  }
}

/**
 * API service with convenience methods for different HTTP methods
 */
export const ApiService = {
  /**
   * Make a GET request
   * @param endpoint The API endpoint
   * @param customHeaders Additional headers
   * @returns Promise with response data
   */
  get<T = any>(endpoint: string, customHeaders?: Record<string, string>): Promise<T> {
    return apiRequest<T>(endpoint, 'GET', undefined, customHeaders);
  },

  /**
   * Make a POST request
   * @param endpoint The API endpoint
   * @param data The request body data
   * @param customHeaders Additional headers
   * @returns Promise with response data
   */
  post<T = any>(endpoint: string, data?: any, customHeaders?: Record<string, string>): Promise<T> {
    return apiRequest<T>(endpoint, 'POST', data, customHeaders);
  },

  /**
   * Make a PUT request
   * @param endpoint The API endpoint
   * @param data The request body data
   * @param customHeaders Additional headers
   * @returns Promise with response data
   */
  put<T = any>(endpoint: string, data?: any, customHeaders?: Record<string, string>): Promise<T> {
    return apiRequest<T>(endpoint, 'PUT', data, customHeaders);
  },

  /**
   * Make a DELETE request
   * @param endpoint The API endpoint
   * @param customHeaders Additional headers
   * @returns Promise with response data
   */
  delete<T = any>(endpoint: string, customHeaders?: Record<string, string>): Promise<T> {
    return apiRequest<T>(endpoint, 'DELETE', undefined, customHeaders);
  },

  // Specific API endpoints for common operations
  
  /**
   * Submit an assignment
   * @param assignmentId The ID of the assignment
   * @param file The file to submit
   * @returns Promise with submission result
   */
  submitAssignment(assignmentId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('assignmentId', assignmentId);
    
    return fetch(`${apiUrl}/assignments/${assignmentId}/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AuthService.getAccessToken()}`
      },
      body: formData
    }).then(response => {
      if (!response.ok) {
        throw new Error(`Submission failed with status ${response.status}`);
      }
      return response.json();
    });
  },
  
  /**
   * Send a notification
   * @param notificationData The notification data
   * @returns Promise with notification result
   */
  sendNotification(notificationData: any) {
    return this.post('/notifications', notificationData);
  },

  /**
   * Get user profile
   * @param userId The ID of the user
   * @returns Promise with user profile data
   */
  getUserProfile(userId: string) {
    return this.get(`/users/${userId}`);
  },

  /**
   * Update user profile
   * @param userId The ID of the user
   * @param userData The user data to update
   * @returns Promise with updated user profile
   */
  updateUserProfile(userId: string, userData: any) {
    return this.put(`/users/${userId}`, userData);
  },

  /**
   * Get chat messages for a conversation
   * @param conversationId The ID of the conversation
   * @returns Promise with messages array
   */
  getChatMessages(conversationId: string) {
    return this.get(`/chat/messages/${conversationId}`);
  },

  /**
   * Send a chat message
   * @param messageData The message data
   * @returns Promise with sent message
   */
  sendChatMessage(messageData: {
    conversationId: string;
    senderId: string;
    senderName?: string;
    content: string;
    contentType?: string;
    metadata?: any;
  }) {
    return this.post('/chat/messages', messageData);
  }
};

export default ApiService; 