import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to ensure this is called by the cron service
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const currentHour = new Date().getHours();

    // Get all email settings where sending is enabled and matches current day/hour
    const { data: settings, error } = await supabase
      .from('analytics_email_settings')
      .select(`
        id,
        property_id,
        recipients,
        user_id
      `)
      .eq('enabled', true)
      .eq('send_day', currentDay)
      .eq('send_time', `${currentHour}:00`);

    if (error) {
      console.error('Error fetching email settings:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!settings || settings.length === 0) {
      return NextResponse.json({ message: 'No reports to send' });
    }

    // Send reports for each setting
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://crm.solvify.se';
    const sendPromises = settings.map(async (setting) => {
      try {
        // Get user's Google Analytics token
        const { data: tokens, error: tokenError } = await supabase
          .from('user_connections')
          .select('access_token, refresh_token')
          .eq('user_id', setting.user_id)
          .eq('provider', 'google')
          .single();

        if (tokenError || !tokens) {
          throw new Error(`No valid Google Analytics token found for user ${setting.user_id}`);
        }

        // Fetch analytics data for the property using the user's token
        const analyticsResponse = await fetch(`${baseUrl}/api/analytics?propertyId=${setting.property_id}`, {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
            'X-Refresh-Token': tokens.refresh_token
          }
        });

        if (!analyticsResponse.ok) {
          throw new Error(`Failed to fetch analytics data for property ${setting.property_id}`);
        }

        const analyticsData = await analyticsResponse.json();

        // Send the report
        const response = await fetch(`${baseUrl}/api/analytics/send-report`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CRON_SECRET}`
          },
          body: JSON.stringify({
            propertyId: setting.property_id,
            recipients: setting.recipients,
            analyticsData: analyticsData,
            userId: setting.user_id
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to send report for property ${setting.property_id}: ${response.statusText}`);
        }

        return { success: true, propertyId: setting.property_id };
      } catch (error) {
        console.error(`Error sending report for property ${setting.property_id}:`, error);
        return { success: false, propertyId: setting.property_id, error };
      }
    });

    const results = await Promise.all(sendPromises);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    // Update last_run and next_run times for successful jobs
    const updatePromises = results.filter(r => r.success).map(async (result) => {
      const setting = settings.find(s => s.property_id === result.propertyId);
      if (!setting) return;

      // Calculate next run time
      const now = new Date();
      const nextRun = new Date(now);
      nextRun.setDate(now.getDate() + 7); // Add 7 days for weekly reports

      return supabase
        .from('cron_jobs')
        .update({
          last_run: now.toISOString(),
          next_run: nextRun.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('property_id', setting.property_id)
        .eq('job_type', 'analytics_report');
    });

    await Promise.all(updatePromises);

    return NextResponse.json({
      message: `Processed ${results.length} reports`,
      successful,
      failed,
      results
    });
  } catch (error) {
    console.error('Error in cron job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 