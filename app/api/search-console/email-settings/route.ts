import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const siteUrl = request.nextUrl.searchParams.get('siteUrl');
    if (!siteUrl) {
      return NextResponse.json(
        { error: 'Site URL is required' },
        { status: 400 }
      );
    }

    // Get settings from Supabase
    const { data, error } = await supabase
      .from('search_console_email_settings')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('site_url', siteUrl)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
      console.error('Error fetching email settings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: data || {
        enabled: false,
        recipients: [],
        frequency: 'weekly',
        send_day: 'monday',
        send_time: '09:00'
      }
    });
  } catch (error) {
    console.error('Error in email settings API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { siteUrl, settings } = await request.json();
    console.log('Received email settings request:', { siteUrl, settings });

    if (!siteUrl) {
      return NextResponse.json(
        { error: 'Site URL is required' },
        { status: 400 }
      );
    }

    // Save email settings
    const { data: emailSettings, error: emailError } = await supabase
      .from('search_console_email_settings')
      .upsert({
        user_id: session.user.id,
        site_url: siteUrl,
        enabled: settings.enabled,
        recipients: settings.recipients,
        send_day: settings.send_day,
        send_time: settings.send_time,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,site_url'
      })
      .select();

    if (emailError) {
      console.error('Error saving email settings:', emailError);
      return NextResponse.json(
        { error: 'Failed to save settings' },
        { status: 500 }
      );
    }

    // Calculate next run time
    const nextRun = calculateNextRunTime(settings.send_day, settings.send_time);
    console.log('Next run time calculated:', nextRun.toISOString());

    // Update cron job
    if (settings.enabled) {
      const { data: cronJob, error: cronError } = await supabase
        .from('cron_jobs')
        .upsert({
          user_id: session.user.id,
          property_id: null,  // Explicitly set to null for Search Console
          site_url: siteUrl,
          job_type: 'search_console_report',
          status: 'active',
          next_run: nextRun.toISOString(),
          settings: {
            recipients: settings.recipients,
            send_day: settings.send_day,
            send_time: settings.send_time
          },
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,site_url,job_type'
        })
        .select();

      if (cronError) {
        console.error('Error updating cron job:', cronError);
        return NextResponse.json(
          { error: 'Failed to update cron job' },
          { status: 500 }
        );
      }

      console.log('Cron job created/updated:', cronJob);
    } else {
      // Disable existing cron job if settings are disabled
      const { error: disableError } = await supabase
        .from('cron_jobs')
        .update({
          status: 'disabled',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', session.user.id)
        .eq('site_url', siteUrl)
        .eq('job_type', 'search_console_report');

      if (disableError) {
        console.error('Error disabling cron job:', disableError);
      }
    }

    return NextResponse.json({ success: true, data: emailSettings });
  } catch (error) {
    console.error('Error in email settings API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculateNextRunTime(sendDay: string, sendTime: string): Date {
  const [hours, minutes] = sendTime.split(':').map(Number);
  const now = new Date();
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDay = daysOfWeek.indexOf(sendDay.toLowerCase());
  const currentDay = now.getDay();
  
  let daysUntilNext = targetDay - currentDay;
  if (daysUntilNext <= 0) {
    daysUntilNext += 7;
  }

  const nextRun = new Date(now);
  nextRun.setDate(nextRun.getDate() + daysUntilNext);
  nextRun.setHours(hours, minutes, 0, 0);

  // If the calculated time is in the past, add 7 days
  if (nextRun < now) {
    nextRun.setDate(nextRun.getDate() + 7);
  }

  return nextRun;
} 