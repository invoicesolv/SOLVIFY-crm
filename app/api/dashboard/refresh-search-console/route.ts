import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth-utils';
import { supabaseClient as supabase } from '@/lib/supabase-client';

export const dynamic = 'force-dynamic';

/**
 * API endpoint to refresh Search Console data
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting Search Console refresh');
    // Get user settings to find the default Search Console site
    console.log('Fetching user settings');
    const { data: userSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('default_search_console_site')
      .eq('user_id', user.id)
      .maybeSingle();

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error('Error fetching user settings:', settingsError);
      return NextResponse.json({ error: 'Failed to fetch user settings' }, { status: 500 });
    }

    // Use default if no setting exists
    const siteUrl = userSettings?.default_search_console_site || 'sc-domain:code.demo';
    
    if (!siteUrl) {
      console.warn('No default Search Console site configured for user');
      return NextResponse.json({ error: 'No default Search Console site configured' }, { status: 400 });
    }

    console.log('Search Console site from user settings:', siteUrl);
    
    // Get the access token from integrations
    console.log('Fetching Search Console integration token');
    const { data: integration, error: tokenError } = await supabase
      .from('integrations')
      .select('access_token, refresh_token, expires_at')
      .eq('service_name', 'google-searchconsole')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (tokenError || !integration || integration.length === 0) {
      console.error('Error fetching Search Console token:', tokenError);
      return NextResponse.json({ 
        error: 'Not authenticated with Search Console',
        details: tokenError ? tokenError.message : 'No integration found'
      }, { status: 401 });
    }

    const accessToken = integration[0].access_token;
    console.log('Access token retrieved');
    
    // Calculate date range - last 28 days
    const endDate = new Date().toISOString().split('T')[0]; // Today
    const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 28 days ago
    
    console.log('Date range:', { startDate, endDate });
    
    // Fetch metrics (overview data)
    console.log('Fetching Search Console metrics');
    
    // Format the site URL for the API correctly
    const apiSiteUrl = encodeURIComponent(siteUrl);
    console.log('Encoded site URL:', apiSiteUrl);
    
    // Get overview metrics
    const overviewResponse = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${apiSiteUrl}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions: []
        })
      }
    );
    
    console.log('Overview response status:', overviewResponse.status);
    
    if (!overviewResponse.ok) {
      const errorText = await overviewResponse.text();
      console.error('Error fetching Search Console overview data:', {
        status: overviewResponse.status,
        statusText: overviewResponse.statusText,
        body: errorText
      });
      return NextResponse.json({ 
        error: 'Failed to fetch Search Console data',
        details: `API error: ${overviewResponse.status} ${overviewResponse.statusText}`
      }, { status: 500 });
    }
    
    const overviewData = await overviewResponse.json();
    console.log('Overview data received:', overviewData.rows ? 'Has data' : 'No data rows');
    
    // Get top queries
    console.log('Fetching top queries data');
    const queriesResponse = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${apiSiteUrl}/searchAnalytics/query`,
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
    
    console.log('Queries response status:', queriesResponse.status);
    
    if (!queriesResponse.ok) {
      const errorText = await queriesResponse.text();
      console.error('Error fetching Search Console queries data:', {
        status: queriesResponse.status,
        statusText: queriesResponse.statusText,
        body: errorText
      });
      // Continue with overview data even if queries fail
      console.log('Continuing with overview data only');
    }
    
    let queriesData: any = null;
    try {
      queriesData = await queriesResponse.json();
      console.log('Queries data received:', queriesData?.rows ? 'Has data' : 'No data rows');
    } catch (parseError) {
      console.error('Error parsing queries response:', parseError);
    }
    
    // Format the response with both overview and queries data
    const searchConsoleData = {
      overview: overviewData.rows?.[0] || { 
        clicks: 0, 
        impressions: 0, 
        ctr: 0, 
        position: 0 
      },
      queries: queriesData?.rows || [],
      timestamp: new Date().toISOString(),
      siteUrl
    };
    
    console.log('Search Console data refresh completed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Search Console data refreshed successfully',
      data: searchConsoleData
    });
    
  } catch (error: any) {
    console.error('Error in Search Console refresh API:', error);
    return NextResponse.json({ 
      error: 'Failed to refresh Search Console data',
      details: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 