export const OAUTH_CONFIG = {
  // Base URL for the application
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://crm.solvify.se'),
  
  // Google OAuth endpoints
  google: {
    // Main authentication callback (for login/register)
    mainCallback: '/api/oauth/google/callback',
    
    // Service-specific callbacks (for additional scopes/permissions)
    serviceCallbacks: {
      analytics: '/api/oauth/google/callback',
      calendar: '/api/oauth/google/callback',
      searchConsole: '/api/oauth/google/callback'
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