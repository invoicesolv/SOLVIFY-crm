import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { supabase } from '@/lib/supabase';

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
    const { startDate, endDate, propertyId, siteUrl } = await request.json();
    
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

    console.log('[Analytics API] Request received:', {
      startDate: dates.startDate,
      endDate: dates.endDate,
      propertyId,
      siteUrl,
      userId,
      isPropertyIdProvided: !!propertyId
    });

    // Get required tokens
    const requiredTokens = ['google-analytics', 'google-searchconsole'] as const;
    type ServiceName = typeof requiredTokens[number];
    const tokens: Record<ServiceName, string> = {
      'google-analytics': '',
      'google-searchconsole': ''
    };
    const missingTokens: string[] = [];

    for (const service of requiredTokens) {
      console.log(`[Analytics API] Fetching token for service: ${service}`);
      const { data: integrations, error } = await supabase
        .from('integrations')
        .select('access_token, refresh_token, expires_at, created_at, scopes')
        .eq('service_name', service)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error || !integrations || integrations.length === 0) {
        console.error(`[Analytics API] Token fetch error for ${service}:`, error);
        missingTokens.push(service);
        continue;
      }

      // Get the most recent token
      const latestIntegration = integrations[0];
      console.log(`[Analytics API] Found token for ${service}, expires at: ${latestIntegration.expires_at}, scopes:`, latestIntegration.scopes);
      tokens[service] = latestIntegration.access_token;
    }

    if (missingTokens.length > 0) {
      console.log('[Analytics API] Missing access tokens for:', missingTokens.join(', '));
      return NextResponse.json(
        { 
          error: 'Not authenticated with required services',
          missingServices: missingTokens,
          properties: [] // Return empty properties array when missing tokens
        },
        { status: 401 }
      );
    }

    // Try fetching Analytics properties first
    let properties = [];
    try {
      console.log('[Analytics API] Fetching analytics properties...');
      properties = await fetchAnalyticsProperties(tokens['google-analytics']);
      console.log('[Analytics API] Found properties:', properties);
    } catch (error: any) {
      console.error('[Analytics API] Error fetching properties:', error);
      return NextResponse.json(
        { 
          error: 'Failed to fetch properties',
          details: error.message,
          properties: []
        },
        { status: 500 }
      );
    }

    // Try fetching Analytics data
    let analyticsData = null;
    let analyticsError = null;
    try {
      console.log('Fetching analytics data for property:', propertyId);
      analyticsData = await fetchAnalyticsData(tokens['google-analytics'], dates.startDate, dates.endDate, propertyId);
      console.log('Analytics data overview:', analyticsData?.overview);
    } catch (error: any) {
      analyticsError = error.message;
      console.error('Analytics fetch error:', {
        error: error.message,
        stack: error.stack,
        propertyId,
        startDate: dates.startDate,
        endDate: dates.endDate
      });
    }
    
    // Then try fetching Search Console data, but only if siteUrl is provided
    let searchData = null;
    let searchError = null;
    let sites = null;
    try {
      console.log('Fetching search console sites...');
      sites = await fetchSearchConsoleSites(tokens['google-searchconsole']);
      console.log('Found sites:', sites);
      
      if (siteUrl) {
        console.log('Fetching search console data for site:', siteUrl);
        searchData = await fetchSearchConsoleData(tokens['google-searchconsole'], dates.startDate, dates.endDate, siteUrl);
        console.log('Search console data overview:', searchData?.overview);
      } else {
        console.log('No site URL provided, skipping search console data fetch');
      }
    } catch (error: any) {
      searchError = error.message;
      console.error('Search Console fetch error:', {
        error: error.message,
        stack: error.stack,
        siteUrl,
        startDate: dates.startDate,
        endDate: dates.endDate
      });
    }

    // Return all data
    const response = {
      analytics: analyticsData,
      searchConsole: searchData,
      properties,
      sites,
      errors: {
        analytics: analyticsError,
        searchConsole: searchError
      }
    };

    console.log('API response summary:', {
      hasAnalytics: !!analyticsData,
      hasSearchData: !!searchData,
      propertiesCount: properties?.length || 0,
      sitesCount: sites?.length || 0,
      hasErrors: !!(analyticsError || searchError),
      propertyId
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Fatal API error:', {
      error: error.message,
      stack: error.stack
    });
    return NextResponse.json(
      { 
        error: 'Failed to fetch data',
        details: error.message
      },
      { status: 500 }
    );
  }
}

async function fetchAnalyticsProperties(accessToken: string) {
  try {
    console.log('[Analytics API] Starting to fetch GA4 properties');
    
    // First try to list accounts to ensure we have access
    const accountsResponse = await fetch(
      'https://analyticsadmin.googleapis.com/v1beta/accounts',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (!accountsResponse.ok) {
      const errorData = await accountsResponse.json().catch(() => null);
      console.error('[Analytics API] GA4 Accounts API error:', {
        status: accountsResponse.status,
        statusText: accountsResponse.statusText,
        error: errorData
      });
      throw new Error(`Failed to fetch GA4 accounts: ${accountsResponse.statusText}`);
    }

    const accountsData = await accountsResponse.json();
    console.log('[Analytics API] GA4 Accounts found:', {
      accountsCount: accountsData.accounts?.length || 0,
      accounts: accountsData.accounts?.map((a: any) => ({ name: a.name, displayName: a.displayName }))
    });

    if (!accountsData.accounts || accountsData.accounts.length === 0) {
      console.warn('[Analytics API] No GA4 accounts found');
      return [];
    }

    // Get properties for all accounts
    const allProperties = [];
    for (const account of accountsData.accounts) {
      try {
        console.log(`[Analytics API] Fetching properties for account: ${account.displayName || account.name}`);
        
        const response = await fetch(
          `https://analyticsadmin.googleapis.com/v1beta/properties?filter=parent:${account.name}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            }
          }
        );

        if (!response.ok) {
          console.warn(`[Analytics API] Failed to fetch properties for account ${account.name}:`, response.statusText);
          continue;
        }

        const data = await response.json();
        console.log(`[Analytics API] Properties found for account ${account.displayName || account.name}:`, {
          propertiesCount: data.properties?.length || 0,
          properties: data.properties?.map((p: any) => ({
            id: p.name.split('/').pop(),
            name: p.displayName || p.name
          }))
        });

        if (data.properties) {
          allProperties.push(...data.properties.map((prop: any) => ({
            id: prop.name.split('/').pop(),
            name: prop.displayName || prop.name,
            createTime: prop.createTime,
            updateTime: prop.updateTime,
            parent: prop.parent,
            propertyType: prop.propertyType
          })));
        }
      } catch (error) {
        console.warn(`[Analytics API] Error fetching properties for account ${account.name}:`, error);
      }
    }

    console.log('[Analytics API] All properties found:', {
      totalProperties: allProperties.length,
      properties: allProperties.map(p => ({ id: p.id, name: p.name }))
    });

    return allProperties;
  } catch (error) {
    console.error('[Analytics API] Error in fetchAnalyticsProperties:', error);
    throw error;
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

interface PageData {
  path: string;
  views: number;
  duration: number;
  sessions: number;
  bounceRate: number;
  conversions: number;
  revenue: number;
}

interface DateMetrics {
  date: string;
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  pageViews: number;
  sessions: number;
}

interface SourceMetrics {
  users: number;
  sessions: number;
  pageViews: number;
}

interface DeviceMetrics {
  users: number;
  sessions: number;
  pageViews: number;
  conversions: number;
}

interface ConversionEvent {
  name: string;
  count: number;
  value: number;
}

interface AnalyticsResult {
  overview: {
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    pageViews: number;
    sessions: number;
    avgSessionDuration: number;
    bounceRate: number;
    engagementRate: number;
    conversions: number;
    revenue: number;
    conversionRate: number;
    conversionEvents: Array<{
      name: string;
      count: number;
      value: number;
    }>;
  };
  byDate: DateMetrics[];
  bySource: Record<string, SourceMetrics>;
  byDevice: Record<string, DeviceMetrics>;
  byConversion: Record<string, {
    count: number;
    value: number;
    byDevice: Record<string, { count: number; value: number; }>;
    bySource: Record<string, { count: number; value: number; }>;
  }>;
  metadata?: {
    timeZone: string;
    currencyCode: string;
    dateRange: {
      start: string;
      end: string;
    };
  };
}

async function fetchAnalyticsData(accessToken: string, startDate: string, endDate: string, propertyId: string): Promise<AnalyticsResult> {
  console.log('[Analytics API] Fetching analytics data:', { propertyId, startDate, endDate });

  // Overview report
  const overviewResponse = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'activeUsers' },
          { name: 'newUsers' },
          { name: 'screenPageViews' },
          { name: 'sessions' },
          { name: 'bounceRate' },
          { name: 'userEngagementDuration' },
          { name: 'engagementRate' }
        ]
      })
    }
  );

  if (!overviewResponse.ok) {
    const errorData = await overviewResponse.json().catch(() => null);
    console.error('[Analytics API] Overview report error:', {
      status: overviewResponse.status,
      statusText: overviewResponse.statusText,
      error: errorData
    });
    throw new Error(`Failed to fetch overview report: ${overviewResponse.statusText}`);
  }

  const overviewData = await overviewResponse.json();
  console.log('[Analytics API] Overview data received:', overviewData);

  // Conversion events report (preserved from existing code)
  const conversionResponse = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'eventName' }],
        metrics: [
          { name: 'eventCount' },
          { name: 'eventValue' },
          { name: 'totalRevenue' }
        ]
      })
    }
  );

  if (!conversionResponse.ok) {
    const errorData = await conversionResponse.json().catch(() => null);
    console.error('[Analytics API] Conversion report error:', {
      status: conversionResponse.status,
      statusText: conversionResponse.statusText,
      error: errorData
    });
    throw new Error(`Failed to fetch conversion report: ${conversionResponse.statusText}`);
  }

  const conversionData = await conversionResponse.json();
  console.log('[Analytics API] Conversion data received:', conversionData);

  // Process overview metrics
  const overviewMetrics = overviewData.rows[0].metricValues;
  const [
    totalUsers,
    activeUsers,
    newUsers,
    pageViews,
    sessions,
    bounceRate,
    engagementDuration,
    engagementRate
  ] = overviewMetrics.map((m: { value: string }) => parseFloat(m.value));

  // Get device breakdown data
  const deviceResponse = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' }
        ]
      })
    }
  );

  if (!deviceResponse.ok) {
    throw new Error(`Failed to fetch device data: ${deviceResponse.statusText}`);
  }

  const deviceData = await deviceResponse.json();
  console.log('[Analytics API] Device data received:', deviceData);

  // Process device data
  const byDevice: Record<string, DeviceMetrics> = {};
  deviceData.rows?.forEach((row: any) => {
    const device = row.dimensionValues[0].value;
    byDevice[device] = {
      users: parseInt(row.metricValues[0].value),
      sessions: parseInt(row.metricValues[1].value),
      pageViews: parseInt(row.metricValues[2].value),
      conversions: 0 // Will be updated with conversion data
    };
  });

  // Process conversion events (preserved from existing code)
  const conversionEvents: ConversionEvent[] = conversionData.rows
    .filter((row: any) => {
      const eventName = row.dimensionValues[0].value;
      return eventName.includes('conversion') || 
             eventName.includes('purchase') || 
             eventName === 'generate_lead';
    })
    .map((row: any) => ({
      name: row.dimensionValues[0].value,
      count: parseInt(row.metricValues[0].value, 10),
      value: parseFloat(row.metricValues[1].value) || parseFloat(row.metricValues[2].value) || 0
    }));

  const totalConversions = conversionEvents.reduce((sum, event) => sum + event.count, 0);
  const totalRevenue = conversionEvents.reduce((sum, event) => sum + event.value, 0);
  const conversionRate = totalUsers > 0 ? (totalConversions / totalUsers) * 100 : 0;

  // Get conversion data by device
  const conversionByDeviceResponse = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'deviceCategory' },
          { name: 'eventName' }
        ],
        metrics: [
          { name: 'eventCount' },
          { name: 'eventValue' }
        ]
      })
    }
  );

  if (!conversionByDeviceResponse.ok) {
    throw new Error(`Failed to fetch conversion by device data: ${conversionByDeviceResponse.statusText}`);
  }

  const conversionByDeviceData = await conversionByDeviceResponse.json();
  console.log('[Analytics API] Conversion by device data received:', conversionByDeviceData);

  // Process conversion events and create byConversion structure
  const byConversion: Record<string, {
    count: number;
    value: number;
    byDevice: Record<string, { count: number; value: number }>;
    bySource: Record<string, { count: number; value: number }>;
  }> = {};

  conversionEvents.forEach(event => {
    byConversion[event.name] = {
      count: event.count,
      value: event.value,
      byDevice: {},
      bySource: {}
    };
  });

  // Update conversion by device data
  conversionByDeviceData.rows?.forEach((row: any) => {
    const device = row.dimensionValues[0].value;
    const eventName = row.dimensionValues[1].value;
    const count = parseInt(row.metricValues[0].value);
    const value = parseFloat(row.metricValues[1].value) || 0;

    if (
      (eventName.includes('conversion') || 
      eventName.includes('purchase') || 
      eventName === 'generate_lead') &&
      byConversion[eventName]
    ) {
      // Update byConversion device stats
      byConversion[eventName].byDevice[device] = {
        count,
        value
      };

      // Update byDevice conversion count
      if (byDevice[device]) {
        byDevice[device].conversions += count;
      }
    }
  });

  // Get source breakdown data
  const sourceResponse = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'sessionSource' },
          { name: 'eventName' }
        ],
        metrics: [
          { name: 'eventCount' },
          { name: 'eventValue' }
        ]
      })
    }
  );

  if (!sourceResponse.ok) {
    throw new Error(`Failed to fetch source data: ${sourceResponse.statusText}`);
  }

  const sourceData = await sourceResponse.json();
  console.log('[Analytics API] Source data received:', sourceData);

  // Process source data
  const bySource: Record<string, SourceMetrics> = {};
  sourceData.rows?.forEach((row: any) => {
    const source = row.dimensionValues[0].value || '(direct)';
    const eventName = row.dimensionValues[1].value;
    const count = parseInt(row.metricValues[0].value);
    const value = parseFloat(row.metricValues[1].value) || 0;

    if (!bySource[source]) {
      bySource[source] = {
        users: 0,
        sessions: 0,
        pageViews: 0
      };
    }

    if (
      (eventName.includes('conversion') || 
      eventName.includes('purchase') || 
      eventName === 'generate_lead') &&
      byConversion[eventName]
    ) {
      byConversion[eventName].bySource[source] = {
        count,
        value
      };
    }
  });

  // Return combined results
  return {
    overview: {
      totalUsers,
      activeUsers,
      newUsers,
      pageViews,
      sessions,
      bounceRate,
      engagementRate,
      avgSessionDuration: engagementDuration / sessions,
      conversions: totalConversions,
      revenue: totalRevenue,
      conversionRate,
      conversionEvents
    },
    byDate: [], // These will be populated by other reports if needed
    bySource,
    byDevice,
    byConversion,
    metadata: {
      timeZone: overviewData.metadata?.timeZone || 'UTC',
      currencyCode: overviewData.metadata?.currencyCode || 'USD',
      dateRange: {
        start: startDate,
        end: endDate
      }
    }
  };
}

async function fetchSearchConsoleData(accessToken: string, startDate: string, endDate: string, siteUrl: string) {
  try {
    console.log('Fetching search data for site:', siteUrl, 'from', startDate, 'to', endDate);

    // Ensure dates are in YYYY-MM-DD format
    const formattedStartDate = startDate === 'today' ? formatDate(new Date()) : startDate;
    const formattedEndDate = endDate === 'today' ? formatDate(new Date()) : endDate;

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
          dimensions: ['query', 'page', 'device', 'country'],
          rowLimit: 20,
          startRow: 0
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('Search Console API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        request: {
          siteUrl,
          startDate: formattedStartDate,
          endDate: formattedEndDate
        }
      });
      throw new Error(`Search Console API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Search Console raw data:', data);

    // Handle empty data case
    if (!data.rows || data.rows.length === 0) {
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

    // Calculate totals and breakdowns
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

      // Device breakdown
      const device = row.keys[2];
      if (!byDevice[device]) {
        byDevice[device] = { clicks: 0, impressions: 0 };
      }
      byDevice[device].clicks += row.clicks;
      byDevice[device].impressions += row.impressions;

      // Country breakdown
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
    console.error('Error in fetchSearchConsoleData:', error);
    throw error;
  }
} 