import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Provide top search terms data for the dashboard
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized: No valid session' }, { status: 401 });
  }

  try {
    // Get the user's ID
    const userId = session.user.id;

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

    // Get user's configured Search Console site
    const { data: searchSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('default_search_console_site')
      .eq('user_id', userId)
      .maybeSingle();

    // Fallback site URL if none configured
    const siteUrl = searchSettings?.default_search_console_site || 'sc-domain:code.demo';
    
    console.log('Using Search Console site URL for terms:', siteUrl);
    
    // Use the Google Search Console API to fetch real data
    const accessToken = integration.access_token;
    
    // Set date range (last 30 days by default)
    const endDate = new Date().toISOString().split('T')[0]; // Today in YYYY-MM-DD
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 days ago
    
    try {
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
        
        // Return empty array rather than error to avoid breaking the dashboard
        return NextResponse.json({ terms: [] });
      }

      const data = await response.json();
      console.log('Search terms API response received');

      // Process the response
      if (!data.rows || data.rows.length === 0) {
        console.log('No search terms data rows returned');
        return NextResponse.json({ terms: [] });
      }

      // Transform rows to required format
      const terms = data.rows
        .filter((row: any) => row.clicks > 0) // Only include terms with clicks
        .sort((a: any, b: any) => b.clicks - a.clicks) // Sort by clicks desc
        .slice(0, 10) // Take top 10
        .map((row: any) => ({
          term: row.keys[0],
          clicks: row.clicks
        }));

      return NextResponse.json({ terms });
    } catch (apiError) {
      console.error('Search Console terms API call error:', apiError);
      
      // Fallback to empty array to keep the dashboard working
      return NextResponse.json({ terms: [] });
    }
  } catch (error) {
    console.error('Error in search-console/terms:', error);
    
    // Ensure we always return a valid response
    return NextResponse.json({ terms: [] }, { status: 200 }); // Return 200 with empty data
  }
} 