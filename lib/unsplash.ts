import { createApi } from 'unsplash-js';
import nodeFetch from 'node-fetch';

let unsplashApi: ReturnType<typeof createApi> | null = null;

// Initialize the Unsplash API client
export function getUnsplashApi() {
  if (unsplashApi) return unsplashApi;
  
  // First try to get the key from environment variables
  let accessKey = process.env.UNSPLASH_ACCESS_KEY;
  
  if (!accessKey) {
    console.warn('UNSPLASH_ACCESS_KEY environment variable is missing - attempting to load from workspace settings');
    // Since we're in a server context, we can't access workspace settings directly
    // The key should be passed from the component or API route that needs images
    return null;
  }
  
  console.log(`Initializing Unsplash API with key: ${accessKey.substring(0, 4)}...${accessKey.length > 8 ? accessKey.substring(accessKey.length - 4) : '****'}`);
  
  try {
    // Create the Unsplash API client with node-fetch for server-side usage
    unsplashApi = createApi({
      accessKey,
      fetch: nodeFetch as unknown as typeof fetch,
    });
    
    return unsplashApi;
  } catch (error) {
    console.error('Failed to initialize Unsplash API:', error);
    return null;
  }
}

// Fallback image map for different categories
const FALLBACK_IMAGES = {
  crm: '/blog/sales-performance.jpg',
  business: '/blog/integration.jpg',
  sales: '/blog/sales-performance.jpg',
  customer: '/blog/data-management.jpg',
  management: '/blog/integration.jpg',
  software: '/blog/automation.jpg',
  productivity: '/blog/automation.jpg',
  default: '/blog/sales-performance.jpg'
};

/**
 * Manual initialization with provided API key - useful when key is stored in DB settings
 * @param apiKey - The Unsplash API key
 */
export function initializeWithApiKey(apiKey: string): boolean {
  if (!apiKey || apiKey.trim() === '') {
    console.error('Cannot initialize Unsplash API with empty key');
    return false;
  }
  
  console.log(`Manually initializing Unsplash API with key: ${apiKey.substring(0, 4)}...${apiKey.length > 8 ? apiKey.substring(apiKey.length - 4) : '****'}`);
  
  try {
    unsplashApi = createApi({
      accessKey: apiKey,
      fetch: nodeFetch as unknown as typeof fetch,
    });
    return true;
  } catch (error) {
    console.error('Failed to initialize Unsplash API with provided key:', error);
    return false;
  }
}

/**
 * Fetches a random image from Unsplash based on a search query
 * @param {string} query - The search query (e.g., "crm", "business", "productivity")
 * @param {string} customApiKey - Optional API key to use for this request only
 * @returns {Promise<UnsplashImage | null>} - The image data or null if not found
 */
export async function getRandomImage(query: string = 'business', customApiKey?: string): Promise<UnsplashImage | null> {
  // Try to use a custom API key if provided
  let api = unsplashApi;
  if (!api && customApiKey) {
    console.log('Using custom API key for this request');
    const initialized = initializeWithApiKey(customApiKey);
    if (initialized) {
      api = unsplashApi;
    }
  } else if (!api) {
    // Try the regular initialization
    api = getUnsplashApi();
  }
  
  if (!api) {
    console.warn('No Unsplash API client available - returning fallback image');
    // Return a fallback local image when Unsplash API is not available
    const fallbackPath = FALLBACK_IMAGES[query as keyof typeof FALLBACK_IMAGES] || FALLBACK_IMAGES.default;
    return {
      id: 'local-fallback',
      url: fallbackPath,
      small_url: fallbackPath,
      download_url: '',
      alt_text: `Image related to ${query}`,
      author: {
        name: 'Solvify CRM',
        username: 'solvify',
        link: 'https://crm.solvify.se',
      },
      width: 1200,
      height: 800,
    };
  }
  
  try {
    console.log(`Fetching random Unsplash image for query: "${query}"`);
    const result = await api.photos.getRandom({
      query,
      count: 1,
      orientation: 'landscape',
    });
    
    if (result.errors) {
      console.error('Unsplash API returned errors:', result.errors);
      throw new Error(`Unsplash API error: ${JSON.stringify(result.errors)}`);
    }
    
    if (!result.response || (Array.isArray(result.response) && result.response.length === 0)) {
      console.warn('Unsplash API returned empty response');
      // Return fallback on API error
      const fallbackPath = FALLBACK_IMAGES[query as keyof typeof FALLBACK_IMAGES] || FALLBACK_IMAGES.default;
      return {
        id: 'local-fallback',
        url: fallbackPath,
        small_url: fallbackPath,
        download_url: '',
        alt_text: `Image related to ${query}`,
        author: {
          name: 'Solvify CRM',
          username: 'solvify',
          link: 'https://crm.solvify.se',
        },
        width: 1200,
        height: 800,
      };
    }
    
    const photo = Array.isArray(result.response) 
      ? result.response[0] 
      : result.response;
    
    console.log(`Successfully fetched Unsplash image: ${photo.id}`);
    
    return {
      id: photo.id,
      url: photo.urls.regular,
      small_url: photo.urls.small,
      download_url: photo.links.download_location || photo.links.download, // Use download_location for proper tracking
      alt_text: photo.alt_description || `Image related to ${query}`,
      author: {
        name: photo.user.name,
        username: photo.user.username,
        link: photo.user.links.html,
      },
      width: photo.width,
      height: photo.height,
    };
  } catch (error) {
    console.error('Error fetching image from Unsplash:', error);
    // Return fallback on any exception
    const fallbackPath = FALLBACK_IMAGES[query as keyof typeof FALLBACK_IMAGES] || FALLBACK_IMAGES.default;
    return {
      id: 'local-fallback',
      url: fallbackPath,
      small_url: fallbackPath,
      download_url: '',
      alt_text: `Image related to ${query}`,
      author: {
        name: 'Solvify CRM',
        username: 'solvify',
        link: 'https://crm.solvify.se',
      },
      width: 1200,
      height: 800,
    };
  }
}

/**
 * Fetches a list of images from Unsplash based on a search query
 * @param {string} query - The search query (e.g., "crm", "business", "productivity")
 * @param {number} count - Number of images to fetch (max 30)
 * @returns {Promise<UnsplashImage[] | null>} - Array of image data or null if not found
 */
export async function searchImages(query: string = 'business', count: number = 5): Promise<UnsplashImage[] | null> {
  const api = getUnsplashApi();
  if (!api) return null;
  
  try {
    // Limit count to prevent abuse
    const safeCount = Math.min(count, 30);
    
    const result = await api.search.getPhotos({
      query,
      perPage: safeCount,
      orientation: 'landscape',
    });
    
    if (result.errors || !result.response) {
      console.error('Unsplash API error:', result.errors);
      return null;
    }
    
    return result.response.results.map(photo => ({
      id: photo.id,
      url: photo.urls.regular,
      small_url: photo.urls.small,
      download_url: photo.links.download_location || photo.links.download,
      alt_text: photo.alt_description || `Image related to ${query}`,
      author: {
        name: photo.user.name,
        username: photo.user.username,
        link: photo.user.links.html,
      },
      width: photo.width,
      height: photo.height,
    }));
  } catch (error) {
    console.error('Error searching images from Unsplash:', error);
    return null;
  }
}

/**
 * Fetches a collection of featured images for blog posts
 * - Gets various business/CRM related images for use across the blog
 * @returns {Promise<UnsplashImage[] | null>} - Array of featured images
 */
export async function getFeaturedImages(): Promise<UnsplashImage[] | null> {
  // Search for multiple queries to get a diverse set of images
  const queries = ['crm', 'business meeting', 'office', 'productivity', 'sales'];
  const imagesPerQuery = 2;
  
  const api = getUnsplashApi();
  if (!api) return null;
  
  try {
    const allImages: UnsplashImage[] = [];
    
    for (const query of queries) {
      const images = await searchImages(query, imagesPerQuery);
      if (images && images.length > 0) {
        allImages.push(...images);
      }
    }
    
    return allImages.length > 0 ? allImages : null;
  } catch (error) {
    console.error('Error fetching featured images:', error);
    return null;
  }
}

// Track Unsplash downloads to stay compliant with their API terms
export async function trackDownload(id: string): Promise<void> {
  // Skip tracking for local fallback images
  if (id === 'local-fallback') return;
  
  const api = getUnsplashApi();
  if (!api) {
    console.warn('Cannot track download - Unsplash API not initialized');
    return;
  }
  
  try {
    console.log(`Tracking download for Unsplash image: ${id}`);
    await api.photos.trackDownload({
      downloadLocation: `https://api.unsplash.com/photos/${id}/download`,
    });
    console.log('Successfully tracked download');
  } catch (error) {
    console.error('Error tracking download:', error);
  }
}

// Types
export interface UnsplashImage {
  id: string;
  url: string;
  small_url: string;
  download_url: string;
  alt_text: string;
  author: {
    name: string;
    username: string;
    link: string;
  };
  width: number;
  height: number;
} 