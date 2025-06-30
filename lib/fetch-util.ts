/**
 * Global fetch request handler with error handling
 * @param url The URL to fetch
 * @param options Fetch options
 * @returns The fetch response JSON
 */
export async function safeFetch(url: string, options?: RequestInit) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error in fetch request to ${url}:`, error);
    throw error;
  }
}

/**
 * Error handler for API fetch requests
 * Can be used to standardize error reporting across the app
 */
export function handleFetchError(error: any, context: string = 'API request') {
  // Log the error with context
  console.error(`Error ${context}:`, error);
  
  // Return a formatted error message
  return {
    error: true,
    message: error.message || `An error occurred during ${context}`,
  };
}

// Authenticated fetch helper that automatically includes Supabase JWT tokens
export async function authenticatedFetch(url: string, options: RequestInit = {}, session?: any): Promise<Response> {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add Authorization header if session is provided
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  return fetch(url, {
    ...options,
    headers,
  });
} 