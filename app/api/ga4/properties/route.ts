import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth-utils';
import { supabaseClient } from '@/lib/supabase-client';
import { supabaseAdmin } from '@/lib/supabase';
import { getRefreshedGoogleToken, handleTokenRefreshOnError } from '@/lib/token-refresh';

// Add proper type definition for the session with access_token
interface ExtendedSession {
  user?: {
    id?: string;
    name?: string;
    email?: string;
  };
  access_token?: string;
  expires?: string;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[GA4 API] Getting user Google token...');
    
    // Check if analytics token needs to be refreshed
    const refreshedToken = await getRefreshedGoogleToken(user.id, 'google-analytics');
    if (refreshedToken) {
      console.log('[GA4 API] Using refreshed Analytics token');
      // Use refreshed token for the API call
      const properties = await fetchGA4PropertiesWithToken(refreshedToken);
      return NextResponse.json({ properties });
    }
    
    // Get Google access token from integrations table
    let googleToken: string | null = null;
    
    // Try each of the known Google service names to find a valid token
    const googleServices = ['google-analytics', 'google', 'google-gmail', 'google-searchconsole'];
    
    for (const serviceName of googleServices) {
      const { data, error } = await supabaseAdmin
        .from('integrations')
        .select('access_token, expires_at')
        .eq('user_id', user.id)
        .eq('service_name', serviceName)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (!error && data && data.length > 0) {
        // Check if token is expired
        const expiresAt = new Date(data[0].expires_at);
        if (expiresAt > new Date()) {
          googleToken = data[0].access_token;
          console.log(`[GA4 API] Found valid token for service: ${serviceName}`);
          break;
        } else {
          console.log(`[GA4 API] Found expired token for service: ${serviceName}`);
        }
      }
    }
    
    // If still no token, try from session
    if (!googleToken && user.access_token) {
      console.log('[GA4 API] Using access token from session');
      googleToken = user.access_token;
    }
    
    if (!googleToken) {
      console.log('[GA4 API] No valid Google token found');
      return NextResponse.json(
        { error: 'Google authentication required. Please connect Google in settings.' },
        { status: 401 }
      );
    }

    try {
      const properties = await fetchGA4PropertiesWithToken(googleToken);
      return NextResponse.json({ properties });
    } catch (apiError: any) {
      // Handle token refresh on API error
      try {
        return await handleTokenRefreshOnError(
          apiError,
          user.id,
          'google-analytics',
          async (newToken) => {
            console.log('[GA4 API] Retrying with refreshed token');
            const properties = await fetchGA4PropertiesWithToken(newToken);
    return NextResponse.json({ properties });
          }
        );
      } catch (retryError) {
        console.error('[GA4 API] Error even after token refresh:', retryError);
        return NextResponse.json(
          { error: 'Failed to fetch GA4 properties' },
          { status: 500 }
        );
      }
    }
  } catch (error) {
    console.error('[GA4 API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GA4 properties' },
        { status: 500 }
    );
  }
}

// Helper function to fetch GA4 properties with a token
async function fetchGA4PropertiesWithToken(accessToken: string) {
  console.log('[GA4 API] Creating Google API client with user token');
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const analyticsAdmin = google.analyticsadmin({
    version: 'v1beta',
    auth
  });

  // Fetch account summaries (includes properties)
  const response = await analyticsAdmin.accountSummaries.list({});
  
  // Get all GA4 properties from account summaries
  const properties = (response.data.accountSummaries || []).flatMap(account => {
    return (account.propertySummaries || []).map(property => {
      const propertyData = {
        id: property.property || '',
        displayName: property.displayName || property.property || 'Unnamed Property',
        accountName: account.displayName || '',
        accountId: account.account || '',
        propertyType: 'GA4'
      };
      
      console.log('[GA4 API] Property data:', {
        originalProperty: property,
        processedProperty: propertyData
      });
      
      return propertyData;
    });
  });

  console.log(`[GA4 API] Found ${properties.length} GA4 properties`);
  return properties;
} 