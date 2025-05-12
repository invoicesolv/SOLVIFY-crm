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