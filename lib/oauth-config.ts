export const OAUTH_CONFIG = {
  // Base URL for the application
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  
  // Google OAuth endpoints
  google: {
    // Main authentication callback (for login/register)
    mainCallback: '/api/auth/callback/google',
    
    // Service-specific callbacks (for additional scopes/permissions)
    serviceCallbacks: {
      analytics: '/api/auth/callback/google-analytics',
      calendar: '/api/auth/callback/google-calendar',
      searchConsole: '/api/auth/callback/google-searchconsole'
    }
  }
};

// Helper to get full callback URLs
export const getCallbackUrl = (service?: keyof typeof OAUTH_CONFIG.google.serviceCallbacks) => {
  if (service) {
    return `${OAUTH_CONFIG.baseUrl}${OAUTH_CONFIG.google.serviceCallbacks[service]}`;
  }
  return `${OAUTH_CONFIG.baseUrl}${OAUTH_CONFIG.google.mainCallback}`;
}; 