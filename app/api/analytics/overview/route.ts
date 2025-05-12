import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { google } from 'googleapis';

// Provide analytics overview data for the dashboard
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
      return NextResponse.json({
        analytics: {
          pageviews: 0,
          visitors: 0,
          bounce_rate: 0,
          avg_session_duration: 0
        }
      });
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
    
    // Call the Google Analytics Data API
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
          metrics: [
            { name: 'screenPageViews' },
            { name: 'totalUsers' },
            { name: 'bounceRate' },
            { name: 'userEngagementDuration' },
            { name: 'sessions' }
          ]
        })
      }
    );

    if (!response.ok) {
      console.error('Google Analytics API error:', response.status, response.statusText);
      return NextResponse.json({ 
        error: 'Failed to fetch data from Google Analytics', 
        status: response.status 
      }, { status: 500 });
    }

    const data = await response.json();
    console.log('Analytics API response:', data);

    // Process the response
    if (!data.rows || data.rows.length === 0) {
      return NextResponse.json({
        analytics: {
          pageviews: 0,
          visitors: 0,
          bounce_rate: 0,
          avg_session_duration: 0
        }
      });
    }

    // Extract metrics from response
    const metrics = data.rows[0].metricValues;
    const sessions = parseFloat(metrics[4]?.value || '0');
    
    const analyticsData = {
      pageviews: parseInt(metrics[0]?.value || '0'),
      visitors: parseInt(metrics[1]?.value || '0'),
      bounce_rate: parseFloat(metrics[2]?.value || '0'),
      avg_session_duration: sessions > 0 
        ? parseFloat(metrics[3]?.value || '0') / sessions 
        : 0
    };

    return NextResponse.json({ analytics: analyticsData });
  } catch (error) {
    console.error('Error in analytics/overview:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 