/**
 * API Client Configuration
 * Production-ready API client with environment-based URLs
 */

// Always use the current origin so the APK works regardless of port
export const API_URL = import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '');

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL;

/**
 * Make an API request with automatic base URL handling
 */
export async function apiRequest(
  method: string,
  endpoint: string,
  body?: any,
  headers?: HeadersInit
): Promise<Response> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
  
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    return response;
  } catch (error) {
    console.error('❌ [API] Request failed:', error);
    throw error;
  }
}

/**
 * GET request helper
 */
export async function get(endpoint: string, headers?: HeadersInit): Promise<Response> {
  return apiRequest('GET', endpoint, undefined, headers);
}

/**
 * POST request helper
 */
export async function post(endpoint: string, body?: any, headers?: HeadersInit): Promise<Response> {
  return apiRequest('POST', endpoint, body, headers);
}

/**
 * PUT request helper
 */
export async function put(endpoint: string, body?: any, headers?: HeadersInit): Promise<Response> {
  return apiRequest('PUT', endpoint, body, headers);
}

/**
 * PATCH request helper
 */
export async function patch(endpoint: string, body?: any, headers?: HeadersInit): Promise<Response> {
  return apiRequest('PATCH', endpoint, body, headers);
}

/**
 * DELETE request helper
 */
export async function del(endpoint: string, headers?: HeadersInit): Promise<Response> {
  return apiRequest('DELETE', endpoint, undefined, headers);
}
