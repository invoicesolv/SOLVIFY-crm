import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Provide top websites data for the dashboard
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
      .eq('service_name', 'google-analytics')
      .maybeSingle();

    if (tokenError || !integration?.access_token) {
      console.error('No Analytics integration found for user:', userId);
      return NextResponse.json({ websites: [] });
    }

    // Get user's configured Google Analytics property
    const { data: analyticsSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('default_analytics_property')
      .eq('user_id', userId)
      .maybeSingle();

    const propertyId = analyticsSettings?.default_analytics_property || '313420483'; // Fallback to default
    
    // Use the Google Analytics API to fetch real data
    const accessToken = integration.access_token;
    
    // Set date range (last 30 days by default)
    const endDate = new Date().toISOString().split('T')[0]; // Today in YYYY-MM-DD
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 days ago
    
    // Call the Google Analytics Data API to get top pages
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'pagePath' }],
          metrics: [{ name: 'screenPageViews' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 5
        })
      }
    );

    if (!response.ok) {
      console.error('Google Analytics API error:', response.status, response.statusText);
      return NextResponse.json({ 
        error: 'Failed to fetch website data from Google Analytics', 
        status: response.status 
      }, { status: 500 });
    }

    const data = await response.json();
    console.log('Top websites API response:', data);

    // Process the response
    if (!data.rows || data.rows.length === 0) {
      return NextResponse.json({ websites: [] });
    }

    // Extract website data from response
    const websites = data.rows.map((row: any) => ({
      url: row.dimensionValues[0].value,
      pageviews: parseInt(row.metricValues[0].value || '0')
    }));

    return NextResponse.json({ websites });
  } catch (error) {
    console.error('Error in analytics/websites:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 