import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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

    const propertyId = request.nextUrl.searchParams.get('propertyId');
    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }

    // Get settings from Supabase
    const { data, error } = await supabaseAdmin
      .from('analytics_email_settings')
      .select('*')
      .eq('user_id', user.id)
      .eq('property_id', propertyId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
      console.error('Error fetching email settings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      settings: data || {
        enabled: false,
        recipients: ''
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
    // Get user from JWT token
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { propertyId, settings } = await request.json();
    console.log('[API /analytics/email-settings] Request received:', { propertyId, settings });

    if (!propertyId) {
      console.log('[API /analytics/email-settings] Property ID is missing');
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }
    if (!settings) {
      console.log('[API /analytics/email-settings] Settings object is missing');
      return NextResponse.json(
        { error: 'Settings object is required' },
        { status: 400 }
      );
    }

    const analyticsEmailSettingsPayload = {
      user_id: user.id,
      property_id: propertyId,
      enabled: settings.enabled,
      recipients: settings.recipients, // Ensure this is an array of strings
      send_day: settings.send_day,
      send_time: settings.send_time,
      updated_at: new Date().toISOString()
    };
    console.log('[API /analytics/email-settings] Upserting to analytics_email_settings with payload:', analyticsEmailSettingsPayload);

    const { data: emailSettings, error: emailError } = await supabaseAdmin
      .from('analytics_email_settings')
      .upsert(analyticsEmailSettingsPayload, {
        onConflict: 'user_id,property_id'
      })
      .select();

    if (emailError) {
      console.error('[API /analytics/email-settings] Error saving to analytics_email_settings. Full Error:', JSON.stringify(emailError, null, 2));
      return NextResponse.json(
        { error: 'Failed to save email settings. Check server logs for details.' },
        { status: 500 }
      );
    }
    console.log('[API /analytics/email-settings] Successfully saved to analytics_email_settings:', emailSettings);

    let nextRun;
    try {
      nextRun = calculateNextRunTime(settings.send_day, settings.send_time);
      console.log('[API /analytics/email-settings] Next run time calculated:', nextRun.toISOString());
    } catch (calcError: any) {
      console.error('[API /analytics/email-settings] Error calculating next run time:', calcError.message, calcError.stack);
      // Return a 400 if calculation fails due to bad input, as it's a client-provided data issue
      return NextResponse.json(
        { error: `Failed to calculate next run time: ${calcError.message}` },
        { status: 400 }
      );
    }
    
    const nextRunISO = nextRun.toISOString();

    if (settings.enabled) {
      const cronJobPayload = {
        user_id: user.id,
          property_id: propertyId,
          job_type: 'analytics_report',
          status: 'active',
        next_run: nextRunISO,
        settings: { // Ensure this structure matches your cron_jobs.settings column expectations
            recipients: settings.recipients,
            send_day: settings.send_day,
            send_time: settings.send_time
          },
          updated_at: new Date().toISOString()
      };
      console.log('[API /analytics/email-settings] Upserting to cron_jobs with payload:', cronJobPayload);

      const { data: cronJob, error: cronError } = await supabaseAdmin
        .from('cron_jobs')
        .upsert(cronJobPayload, {
          onConflict: 'user_id,property_id,job_type'
        })
        .select();

      if (cronError) {
        console.error('[API /analytics/email-settings] Error upserting to cron_jobs. Full Error:', JSON.stringify(cronError, null, 2));
        // It might be better to inform the user that core settings saved but cron job failed
        return NextResponse.json(
          { error: 'Email settings saved, but failed to update related cron job. Check server logs for details.' },
          { status: 500 }
        );
      }
      console.log('[API /analytics/email-settings] Cron job created/updated:', cronJob);
    } else {
      console.log('[API /analytics/email-settings] Settings disabled, attempting to disable cron job.');
      const { error: disableError } = await supabaseAdmin
        .from('cron_jobs')
        .update({
          status: 'disabled',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('property_id', propertyId)
        .eq('job_type', 'analytics_report');

      if (disableError) {
        console.error('[API /analytics/email-settings] Error disabling cron job. Full Error:', JSON.stringify(disableError, null, 2));
        // Non-critical, but log it. Email settings themselves were saved.
      }
      console.log('[API /analytics/email-settings] Attempted to disable cron job.');
    }

    return NextResponse.json({ success: true, data: emailSettings });
  } catch (error: any) {
    console.error('[API /analytics/email-settings] Unhandled error in POST handler:', error.message, error.stack);
    return NextResponse.json(
      { error: 'Internal server error. Check server logs.' },
      { status: 500 }
    );
  }
}

function calculateNextRunTime(sendDay: string, sendTime: string): Date {
  // Validate sendTime format (HH:MM)
  if (!sendTime || !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(sendTime)) {
    console.error(`Invalid sendTime format: ${sendTime}`);
    throw new Error('Invalid sendTime format. Please use HH:MM.');
  }

  const [hours, minutes] = sendTime.split(':').map(Number);

  // This check is technically covered by the regex, but good for clarity
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    console.error(`Invalid time components: hours=${hours}, minutes=${minutes}`);
    throw new Error('Invalid time components in sendTime.');
  }

  const now = new Date();
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDayIndex = daysOfWeek.indexOf(sendDay?.toLowerCase());

  if (targetDayIndex === -1) {
    console.error(`Invalid sendDay: ${sendDay}`);
    throw new Error('Invalid sendDay. Please provide a valid day of the week.');
  }

  const currentDay = now.getDay();
  let daysUntilNext = targetDayIndex - currentDay;
  
  if (daysUntilNext < 0 || (daysUntilNext === 0 && (now.getHours() > hours || (now.getHours() === hours && now.getMinutes() >= minutes)))) {
    // If target day is in the past this week, or it's today but the time has passed, schedule for next week.
    daysUntilNext += 7;
  }
  // If it's today and time is in the future, daysUntilNext correctly remains 0 or positive from (targetDayIndex - currentDay) if currentDay < targetDayIndex
  // If targetDayIndex === currentDay and time is in the future, daysUntilNext = 0
  // If targetDayIndex > currentDay, daysUntilNext is positive.

  const nextRun = new Date(now);
  nextRun.setDate(now.getDate() + daysUntilNext);
  nextRun.setHours(hours, minutes, 0, 0);

  // Final check to ensure we are not scheduling in the past due to edge cases or clock sync issues
  // (The logic for daysUntilNext should mostly handle this, but this is a safeguard)
  if (nextRun < now && daysUntilNext <=0) { // only add 7 days if we haven't already effectively done so
     console.warn('Next run calculated in the past, adjusting to next week. Initial daysUntilNext:', daysUntilNext);
    nextRun.setDate(nextRun.getDate() + 7);
  }

  // Check if the date is valid before returning
  if (isNaN(nextRun.getTime())) {
    console.error('Calculated nextRun resulted in an Invalid Date');
    throw new Error('Failed to calculate a valid next run time.');
  }

  return nextRun;
} 