import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Provide search console overview data for the dashboard
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
      return NextResponse.json({
        searchConsole: {
          clicks: 0,
          impressions: 0,
          ctr: 0,
          position: 0
        }
      });
    }

    // Get user's configured Search Console site
    const { data: searchSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('default_search_console_site')
      .eq('user_id', userId)
      .maybeSingle();

    // Fallback site URL if none configured
    const siteUrl = searchSettings?.default_search_console_site || 'sc-domain:code.demo';
    
    console.log('Using Search Console site URL:', siteUrl);
    
    // Use the Google Search Console API to fetch real data
    const accessToken = integration.access_token;
    
    // Set date range (last 30 days by default)
    const endDate = new Date().toISOString().split('T')[0]; // Today in YYYY-MM-DD
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 days ago
    
    try {
      // Call the Search Console API
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
            rowLimit: 100
          })
        }
      );

      console.log('Search Console API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Search Console API error:', {
          status: response.status, 
          statusText: response.statusText,
          body: errorText
        });
        
        // Return empty data rather than error to avoid breaking the dashboard
        return NextResponse.json({
          searchConsole: {
            clicks: 0,
            impressions: 0,
            ctr: 0,
            position: 0
          }
        });
      }

      const data = await response.json();
      console.log('Search Console API response:', data);

      // Process the response
      if (!data.rows || data.rows.length === 0) {
        console.log('No Search Console data rows returned');
        return NextResponse.json({
          searchConsole: {
            clicks: 0,
            impressions: 0,
            ctr: 0,
            position: 0
          }
        });
      }

      // Calculate totals
      const totals = data.rows.reduce(
        (acc: any, row: any) => {
          acc.clicks += row.clicks || 0;
          acc.impressions += row.impressions || 0;
          acc.ctr += row.ctr || 0;
          acc.position += row.position || 0;
          return acc;
        },
        { clicks: 0, impressions: 0, ctr: 0, position: 0 }
      );

      // Calculate averages for ctr and position
      const rowCount = data.rows.length;
      if (rowCount > 0) {
        totals.ctr = (totals.ctr / rowCount) * 100; // Convert to percentage
        totals.position = totals.position / rowCount;
      }

      return NextResponse.json({ searchConsole: totals });
    } catch (apiError) {
      console.error('Search Console API call error:', apiError);
      
      // Fallback to dummy data to keep the dashboard working
      return NextResponse.json({
        searchConsole: {
          clicks: 0,
          impressions: 0,
          ctr: 0,
          position: 0
        }
      });
    }
  } catch (error) {
    console.error('Error in search-console/overview:', error);
    
    // Ensure we always return a valid response
    return NextResponse.json({
      searchConsole: {
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0
      }
    }, { status: 200 }); // Return 200 with empty data to keep dashboard working
  }
} 