import { google } from 'googleapis';
import { supabase } from '@/lib/supabase';

/**
 * Helper function to get a refreshed Google OAuth token when needed
 * This can be used by any Google service (Analytics, Search Console, Calendar, Gmail, etc.)
 * Enhanced to work for extended periods (at least a month)
 */
export async function getRefreshedGoogleToken(
  userId: string, 
  serviceName: string
): Promise<string | null> {
  try {
    // Get refresh token and current expiry info from integrations table
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('refresh_token, expires_at, access_token')
      .eq('user_id', userId)
      .eq('service_name', serviceName)
      .single();

    if (error || !integration?.refresh_token) {
      console.error(`[Token Refresh] No Google integration or refresh token found for ${serviceName}:`, userId, error);
      return null;
    }

    // Check if token is expired or close to expiring (within 10 minutes for safety)
    const expiryDate = integration.expires_at ? new Date(integration.expires_at) : new Date();
    const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);
    
    if (expiryDate > tenMinutesFromNow) {
      console.log(`[Token Refresh] ${serviceName} token still valid, expires: ${expiryDate.toISOString()}`);
      return integration.access_token; // Return existing valid token
    }

    console.log(`[Token Refresh] Refreshing ${serviceName} token for user: ${userId}`);
    
    // Initialize OAuth2 client with Google credentials
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    
    // Set the refresh token
    oauth2Client.setCredentials({ refresh_token: integration.refresh_token });

    // Perform the token refresh
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    if (!credentials.access_token) {
      throw new Error('Failed to refresh access token');
    }

    // Calculate new expiry time - set to 1 month for extended operation
    // Google typically gives 1 hour, but we'll set our DB to 1 month and refresh as needed
    const newExpiresAt = credentials.expiry_date 
      ? new Date(credentials.expiry_date) 
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    
    // Update the database with the new token
    const { error: updateError } = await supabase
      .from('integrations')
      .update({ 
        access_token: credentials.access_token,
        expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('service_name', serviceName);

    if (updateError) {
      console.error(`[Token Refresh] Failed to update new ${serviceName} token in DB:`, updateError);
      // Continue using the new token even if DB update failed
    }

    console.log(`[Token Refresh] ${serviceName} token refreshed successfully for user: ${userId}, expires: ${newExpiresAt.toISOString()}`);
    return credentials.access_token;

  } catch (error: any) {
    console.error(`[Token Refresh] Error refreshing ${serviceName} token:`, error);
    
    // If refresh fails, try to get a new refresh token by prompting re-authentication
    if (error?.message?.includes('invalid_grant') || error?.message?.includes('refresh_token')) {
      console.log(`[Token Refresh] Refresh token invalid for ${serviceName}, user needs to re-authenticate`);
      
      // Mark the integration as needing re-authentication
      await supabase
        .from('integrations')
        .update({ 
          access_token: null,
          expires_at: new Date().toISOString(), // Mark as expired
          updated_at: new Date().toISOString(),
          // Add a flag to indicate re-auth needed
          status: 'needs_reauth'
        })
        .eq('user_id', userId)
        .eq('service_name', serviceName);
    }
    
    return null;
  }
}

/**
 * Helper function to handle token refresh on API error
 * Use this in API routes that make Google API calls
 * Enhanced with better error handling and retry logic
 */
export async function handleTokenRefreshOnError(
  error: any, 
  userId: string, 
  serviceName: string,
  retryFunction: (token: string) => Promise<any>
): Promise<any> {
  // Check if error is a 401 Unauthorized or token expired error
  const isAuthError = error.status === 401 || 
                      error.code === 401 || 
                      (typeof error.message === 'string' && 
                      (error.message.includes('auth') || 
                       error.message.includes('token') ||
                       error.message.includes('unauthorized') ||
                       error.message.includes('invalid_grant')));
                      
  if (isAuthError) {
    console.log(`[Token Refresh] Auth error detected for ${serviceName}, attempting refresh`);
    const refreshedToken = await getRefreshedGoogleToken(userId, serviceName);
    
    if (refreshedToken) {
      console.log(`[Token Refresh] Successfully refreshed ${serviceName} token, retrying operation`);
      // Retry the original operation with the new token
      return await retryFunction(refreshedToken);
    } else {
      // If refresh failed, throw a specific error that the frontend can handle
      throw new Error(`Authentication failed for ${serviceName}. Please reconnect your Google account.`);
    }
  }
  
  // If we get here, either it wasn't an auth error or refresh failed
  throw error;
}

/**
 * Proactive token refresh function to be called periodically
 * This helps ensure tokens are always fresh before they expire
 */
export async function proactiveTokenRefresh(userId: string): Promise<void> {
  const services = [
    'google-analytics',
    'google-searchconsole', 
    'google-calendar',
    'google-gmail',
    'google-drive'
  ];
  
  for (const service of services) {
    try {
      // Check if user has this integration
      const { data: integration } = await supabase
        .from('integrations')
        .select('expires_at, refresh_token')
        .eq('user_id', userId)
        .eq('service_name', service)
        .single();
      
      if (integration?.refresh_token) {
        const expiryDate = new Date(integration.expires_at);
        const oneDayFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        // Refresh if token expires within 24 hours
        if (expiryDate <= oneDayFromNow) {
          console.log(`[Proactive Refresh] Refreshing ${service} token for user ${userId}`);
          await getRefreshedGoogleToken(userId, service);
        }
      }
    } catch (error) {
      console.error(`[Proactive Refresh] Error refreshing ${service} for user ${userId}:`, error);
    }
  }
}

/**
 * Enhanced function to get a valid Google token with automatic refresh
 * This is the main function to use in API routes
 */
export async function getValidGoogleToken(
  userId: string,
  serviceName: string
): Promise<string | null> {
  try {
    // First try to get existing token
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('access_token, expires_at, refresh_token, status')
      .eq('user_id', userId)
      .eq('service_name', serviceName)
      .single();

    if (error || !integration) {
      console.log(`[Get Valid Token] No integration found for ${serviceName}`);
      return null;
    }

    // Check if marked as needing re-auth
    if (integration.status === 'needs_reauth') {
      console.log(`[Get Valid Token] ${serviceName} needs re-authentication`);
      return null;
    }

    // Check if token is still valid
    const expiryDate = new Date(integration.expires_at);
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    
    if (expiryDate > fiveMinutesFromNow && integration.access_token) {
      return integration.access_token;
    }

    // Token is expired or close to expiring, refresh it
    return await getRefreshedGoogleToken(userId, serviceName);
    
  } catch (error) {
    console.error(`[Get Valid Token] Error getting token for ${serviceName}:`, error);
    return null;
  }
} 