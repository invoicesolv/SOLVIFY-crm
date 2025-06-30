import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getRefreshedGoogleToken, handleTokenRefreshOnError } from '@/lib/token-refresh';

export const dynamic = 'force-dynamic';

// Helper function to get user from Supabase JWT token
async function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return null;
    }
    return user;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

// Provide search console overview data for the dashboard
export async function GET(request: NextRequest) {
  try {
    // Get user from JWT token
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the user's ID
    const userId = user.id;

    // Proactively refresh token if needed
    const freshToken = await getRefreshedGoogleToken(userId, 'google-searchconsole');

    // Get the access token from the integrations table
    const { data: integration, error: tokenError } = await supabaseAdmin
      .from('integrations')
      .select('access_token')
      .eq('user_id', userId)
      .eq('service_name', 'google-searchconsole')
      .maybeSingle();

    if (tokenError || !integration?.access_token) {
      console.error('No Search Console integration found for user:', userId);
      return NextResponse.json({
        searchConsole: {
          clicks: 0,
          impressions: 0,
          ctr: 0,
          position: 0
        }
      });
    }

    // Use the refreshed token if available, otherwise use stored token
    const accessToken = freshToken || integration.access_token;

    // Get user's configured Search Console site
    const { data: searchSettings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('default_search_console_site')
      .eq('user_id', userId)
      .maybeSingle();

    // Fallback site URL if none configured
    const siteUrl = searchSettings?.default_search_console_site || 'sc-domain:code.demo';
    
    console.log('Using Search Console site URL:', siteUrl);
    
    // Set date range (last 30 days by default)
    const endDate = new Date().toISOString().split('T')[0]; // Today in YYYY-MM-DD
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 days ago
    
    try {
      const searchConsole = await fetchSearchConsoleOverview(accessToken, siteUrl, startDate, endDate);
      return NextResponse.json({ searchConsole });
    } catch (apiError: any) {
      // Attempt token refresh on error
      try {
        return await handleTokenRefreshOnError(
          apiError,
          userId,
          'google-searchconsole',
          async (refreshedToken) => {
            const searchConsole = await fetchSearchConsoleOverview(refreshedToken, siteUrl, startDate, endDate);
            return NextResponse.json({ searchConsole });
          }
        );
      } catch (refreshError) {
        console.error('Search Console overview API refresh error:', refreshError);
        // Fallback to empty data to avoid breaking dashboard
        return NextResponse.json({
          searchConsole: {
            clicks: 0,
            impressions: 0,
            ctr: 0,
            position: 0
          }
        });
      }
    }
  } catch (error) {
    console.error('Error in search-console/overview:', error);
    
    // Ensure we always return a valid response
    return NextResponse.json({
      searchConsole: {
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0
      }
    }, { status: 200 }); // Return 200 with empty data to keep dashboard working
  }
}

async function fetchSearchConsoleOverview(accessToken: string, siteUrl: string, startDate: string, endDate: string) {
      // Call the Search Console API
      const response = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            startDate,
            endDate,
            rowLimit: 100
          })
        }
      );

      console.log('Search Console API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Search Console API error:', {
          status: response.status, 
          statusText: response.statusText,
          body: errorText
        });
        
    throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
  console.log('Search Console API response received');

      // Process the response
      if (!data.rows || data.rows.length === 0) {
        console.log('No Search Console data rows returned');
    return {
            clicks: 0,
            impressions: 0,
            ctr: 0,
            position: 0
    };
      }

      // Calculate totals
      const totals = data.rows.reduce(
        (acc: any, row: any) => {
          acc.clicks += row.clicks || 0;
          acc.impressions += row.impressions || 0;
          acc.ctr += row.ctr || 0;
          acc.position += row.position || 0;
          return acc;
        },
        { clicks: 0, impressions: 0, ctr: 0, position: 0 }
      );

      // Calculate averages for ctr and position
      const rowCount = data.rows.length;
      if (rowCount > 0) {
        totals.ctr = (totals.ctr / rowCount) * 100; // Convert to percentage
        totals.position = totals.position / rowCount;
      }

  return totals;
} 