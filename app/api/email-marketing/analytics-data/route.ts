import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getActiveWorkspaceId } from '@/lib/permission';

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

    const workspaceId = await getActiveWorkspaceId(user.id);
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'No active workspace found' }, { status: 404 });
    }

    // Get date range from query params (default to last 30 days)
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Fetch analytics data
    const analyticsResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/analytics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || ''
      },
      body: JSON.stringify({
        startDate,
        endDate,
        // These will be filled from user's connected properties
        propertyId: searchParams.get('propertyId') || undefined,
        siteUrl: searchParams.get('siteUrl') || undefined
      })
    });

    let analyticsData: any = null;
    let searchConsoleData: any = null;

    if (analyticsResponse.ok) {
      const data = await analyticsResponse.json();
      analyticsData = data.analytics;
      searchConsoleData = data.searchConsole;
    }

    // Create template variables object
    const templateVariables = {
      // Analytics variables
      analytics_sessions: analyticsData?.overview?.sessions || 0,
      analytics_users: analyticsData?.overview?.users || 0,
      analytics_pageviews: analyticsData?.overview?.pageviews || 0,
      analytics_bounce_rate: analyticsData?.overview?.bounceRate ? `${(analyticsData.overview.bounceRate * 100).toFixed(1)}%` : '0%',
      analytics_session_duration: analyticsData?.overview?.avgSessionDuration ? `${Math.round(analyticsData.overview.avgSessionDuration / 60)}m` : '0m',
      analytics_conversion_rate: analyticsData?.overview?.conversionRate ? `${(analyticsData.overview.conversionRate * 100).toFixed(2)}%` : '0%',
      
      // Search Console variables
      search_console_clicks: searchConsoleData?.overview?.clicks || 0,
      search_console_impressions: searchConsoleData?.overview?.impressions || 0,
      search_console_ctr: searchConsoleData?.overview?.ctr ? `${searchConsoleData.overview.ctr.toFixed(2)}%` : '0%',
      search_console_position: searchConsoleData?.overview?.position ? searchConsoleData.overview.position.toFixed(1) : '0',
      
      // Top performing content
      top_page: analyticsData?.topPages?.[0]?.page || 'N/A',
      top_page_views: analyticsData?.topPages?.[0]?.pageviews || 0,
      top_search_query: searchConsoleData?.topQueries?.[0]?.query || 'N/A',
      top_query_clicks: searchConsoleData?.topQueries?.[0]?.clicks || 0,
      
      // Device breakdown
      desktop_sessions: analyticsData?.byDevice?.desktop?.sessions || 0,
      mobile_sessions: analyticsData?.byDevice?.mobile?.sessions || 0,
      tablet_sessions: analyticsData?.byDevice?.tablet?.sessions || 0,
      
      // Time period
      report_period: `${days} days`,
      report_start_date: startDate,
      report_end_date: endDate,
      
      // Formatted numbers
      analytics_sessions_formatted: (analyticsData?.overview?.sessions || 0).toLocaleString(),
      analytics_users_formatted: (analyticsData?.overview?.users || 0).toLocaleString(),
      analytics_pageviews_formatted: (analyticsData?.overview?.pageviews || 0).toLocaleString(),
      search_console_clicks_formatted: (searchConsoleData?.overview?.clicks || 0).toLocaleString(),
      search_console_impressions_formatted: (searchConsoleData?.overview?.impressions || 0).toLocaleString()
    };

    return NextResponse.json({ 
      templateVariables,
      rawData: {
        analytics: analyticsData,
        searchConsole: searchConsoleData
      }
    });

  } catch (error) {
    console.error('Error fetching analytics data for templates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 