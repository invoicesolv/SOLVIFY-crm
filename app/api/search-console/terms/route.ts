import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth-utils';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { getRefreshedGoogleToken, handleTokenRefreshOnError } from '@/lib/token-refresh';

export const dynamic = 'force-dynamic';

// Provide top search terms data for the dashboard
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized: No valid session' }, { status: 401 });
  }

  try {
    // Get the user's ID
    const userId = user.id;

    // Proactively refresh token if needed
    const freshToken = await getRefreshedGoogleToken(userId, 'google-searchconsole');

    // Get the access token from the integrations table
    const { data: integration, error: tokenError } = await supabase
      .from('integrations')
      .select('access_token')
      .eq('user_id', userId)
      .eq('service_name', 'google-searchconsole')
      .maybeSingle();

    if (tokenError || !integration?.access_token) {
      console.error('No Search Console integration found for user:', userId);
      return NextResponse.json({ terms: [] });
    }

    // Use the refreshed token if available, otherwise use stored token
    const accessToken = freshToken || integration.access_token;

    // Get user's configured Search Console site
    const { data: searchSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('default_search_console_site')
      .eq('user_id', userId)
      .maybeSingle();

    // Fallback site URL if none configured
    const siteUrl = searchSettings?.default_search_console_site || 'sc-domain:code.demo';
    
    console.log('Using Search Console site URL for terms:', siteUrl);
    
    // Set date range (last 30 days by default)
    const endDate = new Date().toISOString().split('T')[0]; // Today in YYYY-MM-DD
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 days ago
    
    try {
      const terms = await fetchSearchTerms(accessToken, siteUrl, startDate, endDate);
      return NextResponse.json({ terms });
    } catch (apiError: any) {
      // Attempt token refresh on error
      try {
        return await handleTokenRefreshOnError(
          apiError,
          userId,
          'google-searchconsole',
          async (refreshedToken) => {
            const terms = await fetchSearchTerms(refreshedToken, siteUrl, startDate, endDate);
            return NextResponse.json({ terms });
          }
        );
      } catch (refreshError) {
        console.error('Search Console terms API refresh error:', refreshError);
        // Fallback to empty array to avoid breaking dashboard
        return NextResponse.json({ terms: [] });
      }
    }
  } catch (error) {
    console.error('Error in search-console/terms:', error);
    
    // Ensure we always return a valid response
    return NextResponse.json({ terms: [] }, { status: 200 }); // Return 200 with empty data
  }
}

async function fetchSearchTerms(accessToken: string, siteUrl: string, startDate: string, endDate: string) {
      // Call the Search Console API for top search terms with simplified parameters
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
            dimensions: ['query'],
            rowLimit: 10
          })
        }
      );

      console.log('Search Console terms API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Search Console terms API error:', {
          status: response.status, 
          statusText: response.statusText,
          body: errorText
        });
        
    throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Search terms API response received');

      // Process the response
      if (!data.rows || data.rows.length === 0) {
        console.log('No search terms data rows returned');
    return [];
      }

      // Transform rows to required format
  return data.rows
        .filter((row: any) => row.clicks > 0) // Only include terms with clicks
        .sort((a: any, b: any) => b.clicks - a.clicks) // Sort by clicks desc
        .slice(0, 10) // Take top 10
        .map((row: any) => ({
          term: row.keys[0],
          clicks: row.clicks
        }));
} 