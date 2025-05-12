import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from "@/lib/auth";
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface SearchConsoleData {
  overview: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  topQueries: Array<{
    query: string;
    page: string;
    device: string;
    country: string;
    clicks: number;
    impressions: number;
    ctr: string;
    position: string;
  }>;
  byDevice: {
    [key: string]: {
      clicks: number;
      impressions: number;
    };
  };
  byCountry: {
    [key: string]: {
      clicks: number;
      impressions: number;
    };
  };
  backlinks?: {
    totalBacklinks: number;
    topBacklinks: Array<any>;
    byDomain: Record<string, any>;
    metrics: {
      dofollow: number;
      nofollow: number;
      newBacklinks: number;
      lostBacklinks: number;
    };
  };
  keywords?: {
    totalKeywords: number;
    keywords: Array<{
      keyword: string;
      position: string;
      clicks: number;
      impressions: number;
      ctr: string;
    }>;
    metrics: {
      top3: number;
      top10: number;
      top100: number;
    };
  };
}

interface SearchConsoleResult {
  overview: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  topQueries: any[];
  byDevice: {[key: string]: { clicks: number; impressions: number }};
  byCountry: {[key: string]: { clicks: number; impressions: number }};
}

// Add helper function for date formatting
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDateRange(range: string): { startDate: string; endDate: string } {
  const berlinDate = new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' });
  const endDate = new Date(berlinDate);
  const startDate = new Date(berlinDate);
  
  switch (range) {
    case '7days':
      startDate.setDate(endDate.getDate() - 7);
      break;
    case '14days':
      startDate.setDate(endDate.getDate() - 14);
      break;
    case '28days':
      startDate.setDate(endDate.getDate() - 28);
      break;
    case '30days':
      startDate.setDate(endDate.getDate() - 30);
      break;
    default:
      startDate.setDate(endDate.getDate() - 7);
  }
  
  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate)
  };
}

export async function POST(request: NextRequest) {
  try {
    const { startDate, endDate, siteUrl } = await request.json();
    
    // Get user from session
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Calculate date range based on input
    const dates = typeof startDate === 'string' && startDate.includes('days') 
      ? getDateRange(startDate)
      : { startDate: startDate || formatDate(new Date()), endDate: endDate || formatDate(new Date()) };

    console.log('[Search Console API] Request received:', {
      startDate: dates.startDate,
      endDate: dates.endDate,
      siteUrl,
      userId
    });

    // Get required token
    const { data: integrations, error: tokenError } = await supabase
      .from('integrations')
      .select('access_token, refresh_token, expires_at')
      .eq('service_name', 'google-searchconsole')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (tokenError || !integrations || integrations.length === 0) {
      console.error('[Search Console API] Token fetch error:', tokenError);
      return NextResponse.json(
        { 
          error: 'Not authenticated with Search Console',
          sites: []
        },
        { status: 401 }
      );
    }

    const accessToken = integrations[0].access_token;

    // Try fetching Search Console sites
    let sites = null;
    try {
      console.log('[Search Console API] Fetching sites...');
      sites = await fetchSearchConsoleSites(accessToken);
      console.log('[Search Console API] Found sites:', sites);
    } catch (error: any) {
      console.error('[Search Console API] Error fetching sites:', error);
      return NextResponse.json(
        { 
          error: 'Failed to fetch sites',
          details: error.message,
          sites: []
        },
        { status: 500 }
      );
    }

    // If siteUrl is provided, fetch search data
    let searchData: SearchConsoleResult | null = null;
    if (siteUrl) {
      try {
        console.log('[Search Console API] Fetching search data for site:', siteUrl);
        searchData = await fetchSearchConsoleData(accessToken, dates.startDate, dates.endDate, siteUrl);
        console.log('[Search Console API] Search data fetched successfully');
      } catch (error: any) {
        console.error('[Search Console API] Error fetching search data:', error);
        return NextResponse.json(
          { 
            error: 'Failed to fetch search data',
            details: error.message,
            sites,
            searchConsole: null
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      sites,
      searchConsole: searchData
    });
  } catch (error: any) {
    console.error('[Search Console API] Fatal error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        details: error.message
      },
      { status: 500 }
    );
  }
}

async function fetchSearchConsoleSites(accessToken: string) {
  const response = await fetch(
    'https://www.googleapis.com/webmasters/v3/sites',
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch Search Console sites');
  }

  const data = await response.json();
  return data.siteEntry?.map((site: any) => ({
    url: site.siteUrl,
    permissionLevel: site.permissionLevel
  })) || [];
}

async function fetchSearchConsoleData(accessToken: string, startDate: string, endDate: string, siteUrl: string): Promise<SearchConsoleResult> {
  try {
    console.log('[Search Console API] Fetching search data:', { siteUrl, startDate, endDate });

    // Format dates properly
    const formattedStartDate = getFormattedDate(startDate);
    const formattedEndDate = getFormattedDate(endDate);

    console.log('[Search Console API] Using formatted dates:', { formattedStartDate, formattedEndDate });

    // Handle sc-domain: prefix - don't encode the whole URL if it's a domain property
    const apiSiteUrl = siteUrl.startsWith('sc-domain:') 
      ? encodeURIComponent(siteUrl)  // Just encode the whole thing as is
      : encodeURIComponent(siteUrl);

    console.log('[Search Console API] Using API URL:', `https://www.googleapis.com/webmasters/v3/sites/${apiSiteUrl}/searchAnalytics/query`);

    const requestBody = {
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      dimensions: ['query', 'page', 'device', 'country'],
      rowLimit: 100,
      startRow: 0,
      dimensionFilterGroups: []
    };

    console.log('[Search Console API] Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${apiSiteUrl}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Search Console API] Error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(`Search Console API error: ${errorJson.error?.message || response.statusText}`);
      } catch (e) {
        throw new Error(`Search Console API error: ${response.statusText} - ${errorText}`);
      }
    }

    const data = await response.json();
    console.log('[Search Console API] Received data:', JSON.stringify(data, null, 2));

    if (!data.rows || data.rows.length === 0) {
      console.log('[Search Console API] No data rows returned');
      return {
        overview: {
          clicks: 0,
          impressions: 0,
          ctr: 0,
          position: 0
        },
        topQueries: [],
        byDevice: {},
        byCountry: {}
      };
    }

    const totals = {
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0
    };

    const byDevice: { [key: string]: { clicks: number; impressions: number } } = {};
    const byCountry: { [key: string]: { clicks: number; impressions: number } } = {};

    data.rows.forEach((row: any) => {
      totals.clicks += row.clicks;
      totals.impressions += row.impressions;
      totals.ctr += row.ctr;
      totals.position += row.position;

      const device = row.keys[2];
      if (!byDevice[device]) {
        byDevice[device] = { clicks: 0, impressions: 0 };
      }
      byDevice[device].clicks += row.clicks;
      byDevice[device].impressions += row.impressions;

      const country = row.keys[3];
      if (!byCountry[country]) {
        byCountry[country] = { clicks: 0, impressions: 0 };
      }
      byCountry[country].clicks += row.clicks;
      byCountry[country].impressions += row.impressions;
    });

    return {
      overview: {
        clicks: totals.clicks,
        impressions: totals.impressions,
        ctr: (totals.ctr / data.rows.length) * 100,
        position: totals.position / data.rows.length
      },
      topQueries: data.rows.map((row: any) => ({
        query: row.keys[0],
        page: row.keys[1],
        device: row.keys[2],
        country: row.keys[3],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: (row.ctr * 100).toFixed(2) + '%',
        position: row.position.toFixed(1)
      })),
      byDevice,
      byCountry
    };
  } catch (error) {
    console.error('[Search Console API] Error in fetchSearchConsoleData:', error);
    throw error;
  }
}

async function fetchBacklinksData(accessToken: string, siteUrl: string) {
  try {
    console.log('[Search Console API] Fetching backlinks data:', { siteUrl });

    const response = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch backlinks data');
    }

    const data = await response.json();
    
    // Process backlinks data
    return {
      totalBacklinks: 0, // This will be populated when we implement the full backlinks API
      topBacklinks: [], // This will contain the list of top backlinks
      byDomain: {}, // This will contain backlinks grouped by domain
      metrics: {
        dofollow: 0,
        nofollow: 0,
        newBacklinks: 0,
        lostBacklinks: 0
      }
    };
  } catch (error) {
    console.error('[Search Console API] Error in fetchBacklinksData:', error);
    throw error;
  }
}

async function fetchKeywordRankings(accessToken: string, startDate: string, endDate: string, siteUrl: string) {
  try {
    console.log('[Search Console API] Fetching keyword rankings:', { siteUrl, startDate, endDate });

    const formattedStartDate = getFormattedDate(startDate);
    const formattedEndDate = getFormattedDate(endDate);

    console.log('[Search Console API] Using formatted dates for keywords:', { formattedStartDate, formattedEndDate });

    const response = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: formattedStartDate,
          endDate: formattedEndDate,
          dimensions: ['query'],
          rowLimit: 100,
          startRow: 0,
          dimensionFilterGroups: [
            {
              filters: [
                {
                  dimension: 'position',
                  operator: 'lessThan',
                  expression: '100'
                }
              ]
            }
          ]
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Search Console API] Error response for keywords:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error('Failed to fetch keyword rankings');
    }

    const data = await response.json();
    console.log('[Search Console API] Keyword rankings data:', data);

    return {
      totalKeywords: data.rows?.length || 0,
      keywords: data.rows?.map((row: any) => ({
        keyword: row.keys[0],
        position: row.position.toFixed(1),
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: (row.ctr * 100).toFixed(2) + '%'
      })) || [],
      metrics: {
        top3: data.rows?.filter((row: any) => row.position <= 3).length || 0,
        top10: data.rows?.filter((row: any) => row.position <= 10).length || 0,
        top100: data.rows?.length || 0
      }
    };
  } catch (error) {
    console.error('[Search Console API] Error in fetchKeywordRankings:', error);
    throw error;
  }
}

function getFormattedDate(dateString: string): string {
  if (dateString === 'today') {
    return formatDate(new Date());
  }
  
  if (dateString === '7daysAgo') {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return formatDate(date);
  }
  
  return dateString;
} 