import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from "@/lib/auth";
import { supabase } from '@/lib/supabase';
import { getRefreshedGoogleToken, handleTokenRefreshOnError } from '@/lib/token-refresh';

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

interface QueryDataItem {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
  weightedPosition: number;
}

interface DeviceDataItem {
  device: string;
  clicks: number;
  impressions: number;
}

interface CountryDataItem {
  country: string;
  clicks: number;
  impressions: number;
}

interface CombinedQueryItem {
  query: string;
  clicks: number;
  impressions: number;
  ctr: string;
  position: string;
}

interface CombinedResults {
  overview: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    weightedPosition: number;
  };
  queryData: Record<string, QueryDataItem>;
  deviceData: Record<string, DeviceDataItem>;
  countryData: Record<string, CountryDataItem>;
  combinedQueries: CombinedQueryItem[];
  combinedDevices: DeviceDataItem[];
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
    console.log('[Search Console API] Starting POST request handler');
    const { startDate, endDate, siteUrl } = await request.json();
    
    console.log('[Search Console API] Request parameters:', {
      startDate,
      endDate,
      siteUrl,
      requestUrl: request.url
    });
    
    // Get user from session
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      console.error('[Search Console API] Authentication error: No valid user ID in session');
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

    // Get the access token with proactive token refresh if needed
    const freshToken = await getRefreshedGoogleToken(userId, 'google-searchconsole');
    
    // Get the current token from database
    const { data: integration, error: tokenError } = await supabase
        .from('integrations')
        .select('access_token, refresh_token, expires_at')
        .eq('service_name', 'google-searchconsole')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);
      
    if (tokenError || !integration || integration.length === 0) {
      console.error('[Search Console API] No Search Console integration found:', tokenError);
      return NextResponse.json(
        { 
          error: 'Search Console integration not found',
          details: 'Please connect your Google Search Console account in settings',
          sites: []
        },
        { status: 400 }
      );
    }
    
    // Use the freshly refreshed token if available, otherwise use the stored token
    const accessToken = freshToken || integration[0].access_token;

    if (!accessToken) {
      console.error('[Search Console API] No valid access token available');
      return NextResponse.json(
        { 
          error: 'Not authenticated with Search Console',
          details: 'No valid token found',
          sites: []
        },
        { status: 401 }
      );
    }

    try {
      console.log('[Search Console API] Fetching sites with accessToken');
      const sites = await fetchSearchConsoleSites(accessToken);
      
      if (!siteUrl && sites.length > 0) {
        // No site URL provided, return just the list of sites
        return NextResponse.json({
          sites,
          message: 'Please select a site'
        });
      }
      
      if (!siteUrl) {
        return NextResponse.json({
          error: 'No site URL provided and no sites available',
          sites: []
        });
    }

      // Fetch the actual search console data
      console.log(`[Search Console API] Fetching data for site: ${siteUrl}`);
      const searchData = await fetchSearchConsoleData(
        accessToken,
        dates.startDate,
        dates.endDate,
        siteUrl
      );

      console.log('[Search Console API] Search Console data successfully retrieved');
      
      return NextResponse.json({
        sites,
        searchData,
        message: 'Search Console data retrieved successfully'
        });
    } catch (apiError: any) {
      // Try refreshing token on auth error and retry
      try {
        return await handleTokenRefreshOnError(
          apiError,
          userId,
          'google-searchconsole',
          async (refreshedToken) => {
            const sites = await fetchSearchConsoleSites(refreshedToken);
            
            if (!siteUrl && sites.length > 0) {
              return NextResponse.json({
                sites,
                message: 'Please select a site'
              });
            }
            
            const searchData = await fetchSearchConsoleData(
              refreshedToken,
              dates.startDate,
              dates.endDate,
              siteUrl || sites[0].url
            );
            
            return NextResponse.json({
              sites,
              searchData,
              message: 'Search Console data retrieved with refreshed token'
            });
          }
        );
      } catch (refreshError) {
        console.error('[Search Console API] Error after token refresh attempt:', refreshError);
        return NextResponse.json(
          { 
            error: 'Failed to retrieve Search Console data',
            details: (refreshError as Error).message || 'Unknown error',
            sites: []
          },
          { status: 500 }
        );
      }
    }
  } catch (error) {
    console.error('[Search Console API] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: (error as Error).message || 'Unknown error',
        sites: []
      },
      { status: 500 }
    );
  }
}

async function fetchSearchConsoleSites(accessToken: string) {
  const response = await fetch(
    'https://www.googleapis.com/webmasters/v3/sites',
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to fetch Search Console sites:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText
    });
    throw new Error(`Failed to fetch sites: ${response.statusText}`);
  }

  const sitesData = await response.json();
  return sitesData.siteEntry?.map((site: any) => ({
    url: site.siteUrl,
    permissionLevel: site.permissionLevel || 'unknown'
  })) || [];
}

async function fetchSearchConsoleData(accessToken: string, startDate: string, endDate: string, siteUrl: string): Promise<SearchConsoleResult> {
  console.log(`[Search Console API] Fetching data for site: ${siteUrl}, dates: ${startDate} to ${endDate}`);
    
  // Initialize empty result structure
  const result: SearchConsoleResult = {
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
          
  // Fetch overview data (no dimensions)
          const overviewResponse = await fetch(
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
        rowLimit: 1
              })
      }
    );

          if (!overviewResponse.ok) {
            const errorText = await overviewResponse.text();
    console.error('Failed to fetch overview data:', {
              status: overviewResponse.status,
      statusText: overviewResponse.statusText,
      error: errorText
      });
    throw new Error(`Failed to fetch overview data: ${overviewResponse.statusText}`);
          }
          
          const overviewData = await overviewResponse.json();
  if (overviewData.rows && overviewData.rows.length > 0) {
    const row = overviewData.rows[0];
    result.overview = {
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr ? row.ctr * 100 : 0, // Convert to percentage
      position: row.position || 0
    };
          }
          
  // Fetch query data (dimension: query)
  const queryResponse = await fetch(
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
        rowLimit: 20 // Get top 20 queries
              })
            }
          );

  if (!queryResponse.ok) {
    console.error('Failed to fetch query data:', queryResponse.statusText);
    // Continue with other requests instead of throwing
  } else {
    const queryData = await queryResponse.json();
    if (queryData.rows && queryData.rows.length > 0) {
      result.topQueries = queryData.rows.map((row: any) => ({
        query: row.keys[0],
        page: '', // Will fill this with page data in a separate request
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr ? (row.ctr * 100).toFixed(2) + '%' : '0%',
        position: row.position ? row.position.toFixed(1) : '0',
        device: '', // Will be filled later
        country: '' // Will be filled later
      }));
            }
          }
          
  // Fetch device data (dimension: device)
          const deviceResponse = await fetch(
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
                dimensions: ['device'],
                rowLimit: 10
              })
            }
          );
          
  if (!deviceResponse.ok) {
    console.error('Failed to fetch device data:', deviceResponse.statusText);
    // Continue with other requests instead of throwing
  } else {
            const deviceData = await deviceResponse.json();
            if (deviceData.rows && deviceData.rows.length > 0) {
              deviceData.rows.forEach((row: any) => {
                const device = row.keys[0];
        result.byDevice[device] = {
          clicks: row.clicks || 0,
          impressions: row.impressions || 0
        };
              });
            }
          }
          
  // Fetch country data (dimension: country)
          const countryResponse = await fetch(
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
                dimensions: ['country'],
                rowLimit: 10
              })
            }
          );
          
  if (!countryResponse.ok) {
    console.error('Failed to fetch country data:', countryResponse.statusText);
    // Continue instead of throwing
  } else {
            const countryData = await countryResponse.json();
            if (countryData.rows && countryData.rows.length > 0) {
              countryData.rows.forEach((row: any) => {
        const country = row.keys[0];
        result.byCountry[country] = {
          clicks: row.clicks || 0,
          impressions: row.impressions || 0
        };
              });
            }
          }

  // Fetch detailed query data with pages (dimensions: query, page)
  try {
    const queryPageResponse = await fetch(
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
          dimensions: ['query', 'page'],
          rowLimit: 100 // Get more data to match queries with pages
        })
      }
    );

    if (queryPageResponse.ok) {
      const queryPageData = await queryPageResponse.json();
      if (queryPageData.rows && queryPageData.rows.length > 0) {
        // Create a map of query to page
        const queryPageMap = new Map();
        
        queryPageData.rows.forEach((row: any) => {
          const query = row.keys[0];
          const page = row.keys[1];
          
          // Only update if this page has more clicks for this query
          if (!queryPageMap.has(query) || queryPageMap.get(query).clicks < row.clicks) {
            queryPageMap.set(query, { 
              page, 
              clicks: row.clicks 
        });
      }
    });
    
        // Update topQueries with page information
        result.topQueries = result.topQueries.map(query => {
          const pageInfo = queryPageMap.get(query.query);
          if (pageInfo) {
            return {
              ...query,
              page: pageInfo.page
            };
          }
          return query;
        });
      }
    }
  } catch (error) {
    console.error('Error fetching query page data:', error);
    // Continue without page data
  }

  return result;
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