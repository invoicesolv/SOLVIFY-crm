import { google, Auth } from 'googleapis';

// --- TYPES (copied from app/api/analytics/route.ts for reference) ---
interface AnalyticsProperty {
  id: string;
  name: string;
  createTime?: string;
  updateTime?: string;
  parent?: string;
  propertyType?: string;
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
  byDatePrevious?: DateMetrics[];
  previousPeriod?: {
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    pageViews: number;
    sessions: number;
    bounceRate: number;
    engagementRate: number;
    avgSessionDuration: number;
    conversions?: number;
    revenue?: number;
    conversionRate?: number;
    dateRange: {
      start: string;
      end: string;
    };
  };
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

interface SearchConsoleSite {
  url: string;
  permissionLevel: string;
}

interface SearchConsoleResult {
  overview: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  topQueries: any[];
  byDevice: Record<string, { clicks: number; impressions: number; }>;
  byCountry: Record<string, { clicks: number; impressions: number; }>;
}
// --- END TYPES ---

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Fetches Google Analytics GA4 Properties using a Service Account Auth Client.
 */
export async function fetchAnalyticsPropertiesSA(authClient: Auth.JWT): Promise<AnalyticsProperty[]> {
  const analyticsAdmin = google.analyticsadmin({ version: 'v1beta', auth: authClient });
  try {
    console.log('[Server Analytics Helper] Fetching GA4 properties using Service Account');
    const accountsResponse = await analyticsAdmin.accounts.list({});
    const accounts = accountsResponse.data.accounts;

    if (!accounts || accounts.length === 0) {
      console.warn('[Server Analytics Helper] No GA4 accounts found for service account.');
      return [];
    }

    const allProperties: AnalyticsProperty[] = [];
    for (const account of accounts) {
      if (account.name) {
        const propertiesResponse = await analyticsAdmin.properties.list({ filter: `parent:${account.name}` });
        if (propertiesResponse.data.properties) {
          const typedProperties: AnalyticsProperty[] = propertiesResponse.data.properties.map((prop: any) => ({
            id: prop.name?.split('/').pop() || '',
            name: prop.displayName || prop.name || '',
            createTime: prop.createTime,
            updateTime: prop.updateTime,
            parent: prop.parent,
            propertyType: prop.propertyType
          }));
          allProperties.push(...typedProperties);
        }
      }
    }
    console.log(`[Server Analytics Helper] Found ${allProperties.length} properties.`);
    return allProperties;
  } catch (error) {
    console.error('[Server Analytics Helper] Error fetching GA4 properties with Service Account:', error);
    throw error;
  }
}

/**
 * Fetches Google Analytics Data using a Service Account Auth Client.
 * This is a simplified version based on fetchAnalyticsData from your API route.
 * You might need to expand this to match all the metrics and dimensions from the original.
 */
export async function fetchAnalyticsDataSA(
  authClient: Auth.JWT, 
  startDate: string, 
  endDate: string, 
  propertyId: string
): Promise<AnalyticsResult> {
  const analyticsData = google.analyticsdata({ version: 'v1beta', auth: authClient });
  console.log('[Server Analytics Helper] Fetching analytics data SA:', { propertyId, startDate, endDate });

  try {
    const reportRequest = {
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: 'totalUsers' }, { name: 'activeUsers' }, { name: 'newUsers' }, 
        { name: 'screenPageViews' }, { name: 'sessions' }, { name: 'bounceRate' }, 
        { name: 'userEngagementDuration' }, { name: 'engagementRate' },
        { name: 'conversions' }, // Ensure your property has 'conversions' as a configured conversion event
        { name: 'totalRevenue' } // Ensure your property tracks revenue
      ],
      dimensions: [{ name: 'date' }], // For byDate, add other dimensions as needed for other breakdowns
      orderBys: [{ dimension: { dimensionName: 'date' } }]
    };

    const response = await analyticsData.properties.runReport(reportRequest);

    console.log('[Server Analytics Helper] Analytics data SA raw response:', response.data);

    // --- Data Processing (simplified, adapt from your original fetchAnalyticsData) ---
    const overviewMetrics = response.data.rows?.[0]?.metricValues || [];
    const byDateMetrics: DateMetrics[] = response.data.rows?.map((row: any) => ({
      date: row.dimensionValues[0].value, // Assuming 'date' is the first dimension
      totalUsers: parseInt(row.metricValues[0].value) || 0,
      activeUsers: parseInt(row.metricValues[1].value) || 0,
      newUsers: parseInt(row.metricValues[2].value) || 0,
      pageViews: parseInt(row.metricValues[3].value) || 0,
      sessions: parseInt(row.metricValues[4].value) || 0,
    })) || [];
    
    const sessions = parseFloat(overviewMetrics[4]?.value || '0');
    const engagementDuration = parseFloat(overviewMetrics[6]?.value || '0');

    // This is a VERY simplified overview. Refer to your original function for full detail.
    const result: AnalyticsResult = {
      overview: {
        totalUsers: parseInt(overviewMetrics[0]?.value || '0'),
        activeUsers: parseInt(overviewMetrics[1]?.value || '0'),
        newUsers: parseInt(overviewMetrics[2]?.value || '0'),
        pageViews: parseInt(overviewMetrics[3]?.value || '0'),
        sessions: parseInt(sessions.toString()),
        bounceRate: parseFloat(overviewMetrics[5]?.value || '0'),
        engagementRate: parseFloat(overviewMetrics[7]?.value || '0'),
        avgSessionDuration: sessions > 0 ? engagementDuration / sessions : 0,
        conversions: parseInt(overviewMetrics[8]?.value || '0'),
        revenue: parseFloat(overviewMetrics[9]?.value || '0'),
        conversionRate: sessions > 0 ? (parseInt(overviewMetrics[8]?.value || '0') / sessions) * 100 : 0,
        conversionEvents: [], // Populate if needed
      },
      byDate: byDateMetrics,
      // byDatePrevious, previousPeriod, bySource, byDevice, byConversion would need more specific queries
      bySource: {},
      byDevice: {},
      byConversion: {},
      metadata: {
        timeZone: response.data.metadata?.timeZone || 'UTC',
        currencyCode: response.data.metadata?.currencyCode || 'USD',
        dateRange: { start: startDate, end: endDate },
      },
    };
    return result;
  } catch (error) {
    console.error('[Server Analytics Helper] Error fetching analytics data with Service Account:', error);
    throw error;
  }
}

/**
 * Fetches Google Search Console Sites using a Service Account Auth Client.
 */
export async function fetchSearchConsoleSitesSA(authClient: Auth.JWT): Promise<SearchConsoleSite[]> {
  const searchConsole = google.searchconsole({ version: 'v1', auth: authClient });
  try {
    console.log('[Server Analytics Helper] Fetching Search Console sites using Service Account');
    const response = await searchConsole.sites.list({});
    return response.data.siteEntry?.map((site: any) => ({
      url: site.siteUrl || '',
      permissionLevel: site.permissionLevel || ''
    })) || [];
  } catch (error) {
    console.error('[Server Analytics Helper] Error fetching Search Console sites with Service Account:', error);
    throw error;
  }
}

/**
 * Fetches Google Search Console Data using a Service Account Auth Client.
 * This is a simplified version.
 */
export async function fetchSearchConsoleDataSA(
  authClient: Auth.JWT, 
  startDate: string, 
  endDate: string, 
  siteUrl: string
): Promise<SearchConsoleResult> {
  const searchConsole = google.searchconsole({ version: 'v1', auth: authClient });
  console.log('[Server Analytics Helper] Fetching Search Console data SA:', { siteUrl, startDate, endDate });

  try {
    const response = await searchConsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: formatDate(new Date(startDate)), // Ensure YYYY-MM-DD
        endDate: formatDate(new Date(endDate)),   // Ensure YYYY-MM-DD
        dimensions: ['query', 'page', 'device', 'country'],
        rowLimit: 10, // Keep it small for scheduled reports initially
      },
    });

    console.log('[Server Analytics Helper] Search Console data SA raw response:', response.data);

    const rows = response.data.rows || [];
    const totals = {
      clicks: rows.reduce((sum, row) => sum + (row.clicks || 0), 0),
      impressions: rows.reduce((sum, row) => sum + (row.impressions || 0), 0),
      ctr: rows.reduce((sum, row) => sum + (row.ctr || 0), 0),
      position: rows.reduce((sum, row) => sum + (row.position || 0), 0),
    };

    const result: SearchConsoleResult = {
      overview: {
        clicks: totals.clicks,
        impressions: totals.impressions,
        ctr: rows.length > 0 ? (totals.ctr / rows.length) * 100 : 0,
        position: rows.length > 0 ? totals.position / rows.length : 0,
      },
      topQueries: rows.map((row: any) => ({
        query: row.keys?.[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: (row.ctr || 0) * 100,
        position: row.position,
      })),
      byDevice: {},
      byCountry: {},
    };
    return result;
  } catch (error) {
    console.error('[Server Analytics Helper] Error fetching Search Console data with Service Account:', error);
    throw error;
  }
} 