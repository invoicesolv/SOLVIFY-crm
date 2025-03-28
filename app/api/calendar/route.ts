import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    console.log('Looking up calendar integration for user ID:', userId);

    // Get access token from database
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('service_name', 'google-calendar');

    console.log('Integration lookup result:', { 
      count: integration?.length, 
      integration: integration?.[0] ? {
        ...integration[0],
        access_token: integration[0].access_token ? 'present' : 'absent',
        refresh_token: integration[0].refresh_token ? 'present' : 'absent'
      } : null,
      error: integrationError
    });

    if (integrationError) {
      console.error('Failed to get integration:', integrationError);
      return NextResponse.json(
        { error: 'Not authenticated with Google Calendar' },
        { status: 401 }
      );
    }

    if (!integration || integration.length === 0) {
      console.error('No integration found for user:', userId);
      return NextResponse.json(
        { error: 'Not authenticated with Google Calendar' },
        { status: 401 }
      );
    }

    const activeIntegration = integration[0];

    // Check if token is expired
    if (new Date(activeIntegration.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Google Calendar token expired, please re-authenticate' },
        { status: 401 }
      );
    }

    const accessToken = activeIntegration.access_token;

    // Try to get events from Supabase first
    const { data: localEvents, error: localError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId);

    if (localEvents && localEvents.length > 0) {
      // Return cached events from Supabase
      return NextResponse.json({
        items: localEvents.map(event => ({
          id: event.id,
          summary: event.title,
          description: event.description,
          location: event.location,
          start: { dateTime: event.start_time },
          end: { dateTime: event.end_time }
        }))
      });
    }

    // Fetch from Google Calendar
    console.log('Attempting to fetch from Google Calendar with token:', accessToken.substring(0, 20) + '...');
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?' + new URLSearchParams({
        timeMin: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString(),
        timeMax: new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
      }),
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Calendar API error details:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        error: errorText
      });
      throw new Error(`Failed to fetch calendar events: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    // Save Google Calendar events to Supabase
    if (data.items?.length > 0) {
      const eventsToInsert = data.items.map((event: any) => ({
        id: event.id,
        user_id: userId,
        title: event.summary,
        description: event.description,
        location: event.location,
        start_time: event.start.dateTime || event.start.date,
        end_time: event.end.dateTime || event.end.date
      }));

      const { error: insertError } = await supabase
        .from('calendar_events')
        .upsert(eventsToInsert, { onConflict: 'id' });

      if (insertError) {
        console.error('Error saving events to Supabase:', insertError);
      }
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in calendar API route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar data', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    console.log('Looking up calendar integration for POST, user ID:', userId);

    // Get access token from database
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('service_name', 'google-calendar');

    console.log('Integration lookup result for POST:', { 
      count: integration?.length, 
      integration: integration?.[0] ? {
        ...integration[0],
        access_token: integration[0].access_token ? 'present' : 'absent',
        refresh_token: integration[0].refresh_token ? 'present' : 'absent'
      } : null,
      error: integrationError
    });

    if (integrationError) {
      console.error('Failed to get integration for POST:', integrationError);
      return NextResponse.json(
        { error: 'Not authenticated with Google Calendar' },
        { status: 401 }
      );
    }

    if (!integration || integration.length === 0) {
      console.error('No integration found for POST, user:', userId);
      return NextResponse.json(
        { error: 'Not authenticated with Google Calendar' },
        { status: 401 }
      );
    }

    const activeIntegration = integration[0];

    // Check if token is expired
    if (new Date(activeIntegration.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Google Calendar token expired, please re-authenticate' },
        { status: 401 }
      );
    }

    const accessToken = activeIntegration.access_token;
    const eventData = await request.json();

    // Create event in Google Calendar
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('Google Calendar API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      throw new Error(`Failed to create calendar event: ${response.statusText}`);
    }

    const data = await response.json();

    // Save to Supabase
    const { error: insertError } = await supabase
      .from('calendar_events')
      .insert({
        id: data.id,
        user_id: userId,
        title: data.summary,
        description: data.description,
        location: data.location,
        start_time: data.start.dateTime || data.start.date,
        end_time: data.end.dateTime || data.end.date
      });

    if (insertError) {
      console.error('Error saving event to Supabase:', insertError);
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in calendar API route:', error);
    return NextResponse.json(
      { error: 'Failed to create calendar event', details: error.message },
      { status: 500 }
    );
  }
} 