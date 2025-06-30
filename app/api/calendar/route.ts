import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { getRefreshedGoogleToken, handleTokenRefreshOnError } from '@/lib/token-refresh';
import { getUserFromToken } from '@/lib/auth-utils';
import { supabaseClient } from '@/lib/supabase-client';

// Helper function to sync with Google Calendar
async function syncWithGoogleCalendar(userId: string, event: any, accessToken: string) {
  try {
    console.log('[Calendar] Attempting to sync event to Google Calendar:', event.id);
    
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: event.title,
          description: event.description || '',
          location: event.location || '',
          start: { dateTime: event.start_time },
          end: { dateTime: event.end_time },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Calendar] Google Calendar sync error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      throw new Error(`Failed to sync with Google Calendar: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[Calendar] Successfully synced with Google Calendar, ID:', data.id);
    
    // Update the event with Google Calendar ID using admin client
    await supabaseAdmin
      .from('calendar_events')
      .update({ 
        google_calendar_id: data.id,
        is_synced: true 
      })
      .eq('id', event.id);

    return data;
  } catch (error) {
    console.error('[Calendar] Failed to sync with Google Calendar:', error);
    return null;
  }
}

// Helper function to delete from Google Calendar
async function deleteFromGoogleCalendar(googleCalendarId: string, accessToken: string) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleCalendarId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete from Google Calendar: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Failed to delete from Google Calendar:', error);
    return false;
  }
}

// Helper function to update in Google Calendar
async function updateInGoogleCalendar(googleCalendarId: string, event: any, accessToken: string) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleCalendarId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: event.title,
          description: event.description,
          location: event.location,
          start: { dateTime: event.start_time },
          end: { dateTime: event.end_time },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update in Google Calendar: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to update in Google Calendar:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Calendar] Processing GET request');
    const userId = user.id;

    if (!userId) {
      console.log('[Calendar] No user found in session');
      return NextResponse.json({ items: [] });
    }

    // Get workspace_id from the user's profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('workspace_id')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile?.workspace_id) {
      console.error('[Calendar] Error fetching profile or workspace_id not found:', profileError);
      return NextResponse.json({ error: 'User profile or workspace not found' }, { status: 404 });
    }
    const workspaceId = profile.workspace_id;
    console.log('[Calendar] Getting events for workspace:', workspaceId);

    // Get events from our database using admin client, filtered by workspace_id
    // Limit to recent and upcoming events to improve performance
    const { data: events, error } = await supabaseAdmin
      .from('calendar_events')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('start_time', new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString())
      .lte('start_time', new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString())
      .order('start_time', { ascending: true });

    if (error) {
      console.error('[Calendar] Error fetching events for workspace:', workspaceId, error);
      throw error;
    }

    // If user is authenticated, check for Google Calendar integration
    if (userId) {
      // Get user's workspace IDs for security
      const { data: teamMemberships } = await supabaseAdmin
        .from('team_members')
        .select('workspace_id')
        .eq('user_id', userId);

      const userWorkspaceIds = teamMemberships?.map(tm => tm.workspace_id) || [];
      
      if (userWorkspaceIds.length === 0) {
        console.log('[Calendar] User has no workspace memberships');
        return NextResponse.json({ items: events || [] });
      }

      const { data: integration, error: integrationError } = await supabaseAdmin
        .from('integrations')
        .select('*')
        .eq('user_id', userId) 
        .eq('service_name', 'google-calendar')
        .in('workspace_id', userWorkspaceIds)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (integrationError && integrationError.code !== 'PGRST116') {
        console.error('[Calendar] Error fetching integration:', integrationError);
      }

      // Check if token needs to be refreshed
      const refreshedToken = await getRefreshedGoogleToken(userId, 'google-calendar');
      if (refreshedToken) {
        console.log('[Calendar] Using refreshed token');
        if (integration) {
          integration.access_token = refreshedToken;
        }
      }

      // If integration exists and token is valid, fetch and merge Google Calendar events
      if (integration && new Date(integration.expires_at) > new Date()) {
        console.log('[Calendar] Valid Google Calendar integration found, syncing for user:', userId);
        
        try {
          // Add timeout to prevent hanging requests
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          const response = await fetch(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events?' + new URLSearchParams({
              timeMin: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString(),
              timeMax: new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString(),
              singleEvents: 'true',
              orderBy: 'startTime',
              maxResults: '100', // Limit results to improve performance
            }),
            {
              headers: {
                'Authorization': `Bearer ${integration.access_token}`,
                'Content-Type': 'application/json',
              },
              signal: controller.signal,
            }
          );
          
          clearTimeout(timeoutId);

          if (response.ok) {
            const googleEvents = await response.json();
            console.log(`[Calendar] Fetched ${googleEvents.items?.length || 0} Google Calendar events for user:`, userId);

            // Get all existing Google Calendar event IDs in one query for efficiency
            const googleEventIds = (googleEvents.items || []).map(e => e.id);
            const { data: existingEvents, error: existingError } = await supabaseAdmin
              .from('calendar_events')
              .select('google_calendar_id')
              .eq('workspace_id', workspaceId)
              .in('google_calendar_id', googleEventIds);

            if (existingError) {
              console.error('[Calendar] Error fetching existing events:', existingError);
            }

            const existingEventIds = new Set((existingEvents || []).map(e => e.google_calendar_id));
            
            // Prepare new events for bulk insert
            const newEvents = (googleEvents.items || [])
              .filter(gEvent => !existingEventIds.has(gEvent.id))
              .map(gEvent => ({
                id: uuidv4(), // Generate UUID for primary key
                workspace_id: workspaceId,
                user_id: userId,
                title: gEvent.summary || gEvent.subject || 'Untitled Event',
                description: gEvent.description,
                location: gEvent.location,
                start_time: gEvent.start?.dateTime || gEvent.start?.date || new Date().toISOString(),
                end_time: gEvent.end?.dateTime || gEvent.end?.date || new Date().toISOString(),
                google_calendar_id: gEvent.id,
                is_synced: true
              }));

            // Bulk insert new events if any
            if (newEvents.length > 0) {
              console.log(`[Calendar] Bulk inserting ${newEvents.length} new Google Calendar events`);
              const { error: insertError } = await supabaseAdmin
                .from('calendar_events')
                .insert(newEvents);
              
              if (insertError) {
                console.error('[Calendar] Error bulk inserting events:', insertError);
              }
            }

            // Just return the local events to avoid another potentially slow query
            // Add newly synced events to the events array
            const syncedEvents = (googleEvents.items || [])
              .filter(gEvent => !events.some(e => e.google_calendar_id === gEvent.id))
              .map(gEvent => ({
                id: uuidv4(), // Generate a temporary ID for display purposes
                workspace_id: workspaceId,
                user_id: userId,
                title: gEvent.summary || gEvent.subject || 'Untitled Event',
                description: gEvent.description,
                location: gEvent.location,
                start_time: gEvent.start?.dateTime || gEvent.start?.date || new Date().toISOString(),
                end_time: gEvent.end?.dateTime || gEvent.end?.date || new Date().toISOString(),
                google_calendar_id: gEvent.id,
                is_synced: true
              }));

            const combinedEvents = [...events, ...syncedEvents];
            console.log(`[Calendar] Returning ${combinedEvents.length} combined events for workspace ${workspaceId}`);
            return NextResponse.json({ items: combinedEvents || [] });
          } else {
            console.error('[Calendar] Error response from Google Calendar API:', await response.text());
          }
        } catch (apiError: any) {
          // Handle token refresh on API error
          try {
            console.log('[Calendar] Handling API error with token refresh');
            await handleTokenRefreshOnError(
              apiError,
              userId,
              'google-calendar',
              async (newToken) => {
                console.log('[Calendar] Retrying events fetch with refreshed token');
                // Retry the operation with new token
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);
                
                const response = await fetch(
                  'https://www.googleapis.com/calendar/v3/calendars/primary/events?' + new URLSearchParams({
                    timeMin: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString(),
                    timeMax: new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString(),
                    singleEvents: 'true',
                    orderBy: 'startTime',
                    maxResults: '100',
                  }),
                  {
                    headers: {
                      'Authorization': `Bearer ${newToken}`,
                      'Content-Type': 'application/json',
                    },
                    signal: controller.signal,
                  }
                );
                
                clearTimeout(timeoutId);
                
                if (response.ok) {
                  const googleEvents = await response.json();
                  console.log(`[Calendar] Fetched ${googleEvents.items?.length || 0} Google Calendar events for user:`, userId);

                  // Get all existing Google Calendar event IDs in one query for efficiency
                  const googleEventIds = (googleEvents.items || []).map(e => e.id);
                  const { data: existingEvents, error: existingError } = await supabaseAdmin
                    .from('calendar_events')
                    .select('google_calendar_id')
                    .eq('workspace_id', workspaceId)
                    .in('google_calendar_id', googleEventIds);

                  if (existingError) {
                    console.error('[Calendar] Error fetching existing events:', existingError);
                  }

                  const existingEventIds = new Set((existingEvents || []).map(e => e.google_calendar_id));
                  
                  // Prepare new events for bulk insert
                  const newEvents = (googleEvents.items || [])
                    .filter(gEvent => !existingEventIds.has(gEvent.id))
                    .map(gEvent => ({
                      id: uuidv4(), // Generate UUID for primary key
                      workspace_id: workspaceId,
                      user_id: userId,
                      title: gEvent.summary || gEvent.subject || 'Untitled Event',
                      description: gEvent.description,
                      location: gEvent.location,
                      start_time: gEvent.start?.dateTime || gEvent.start?.date || new Date().toISOString(),
                      end_time: gEvent.end?.dateTime || gEvent.end?.date || new Date().toISOString(),
                      google_calendar_id: gEvent.id,
                      is_synced: true
                    }));

                  // Bulk insert new events if any
                  if (newEvents.length > 0) {
                    console.log(`[Calendar] Bulk inserting ${newEvents.length} new Google Calendar events`);
                    const { error: insertError } = await supabaseAdmin
                      .from('calendar_events')
                      .insert(newEvents);
                    
                    if (insertError) {
                      console.error('[Calendar] Error bulk inserting events:', insertError);
                    }
                  }

                  // Just return the local events to avoid another potentially slow query
                  // Add newly synced events to the events array
                  const syncedEvents = (googleEvents.items || [])
                    .filter(gEvent => !events.some(e => e.google_calendar_id === gEvent.id))
                    .map(gEvent => ({
                      id: uuidv4(), // Generate a temporary ID for display purposes
                      workspace_id: workspaceId,
                      user_id: userId,
                      title: gEvent.summary || gEvent.subject || 'Untitled Event',
                      description: gEvent.description,
                      location: gEvent.location,
                      start_time: gEvent.start?.dateTime || gEvent.start?.date || new Date().toISOString(),
                      end_time: gEvent.end?.dateTime || gEvent.end?.date || new Date().toISOString(),
                      google_calendar_id: gEvent.id,
                      is_synced: true
                    }));

                  const combinedEvents = [...events, ...syncedEvents];
                  console.log(`[Calendar] Returning ${combinedEvents.length} combined events for workspace ${workspaceId}`);
                  return NextResponse.json({ items: combinedEvents || [] });
                } else {
                  console.error('[Calendar] Error response from Google Calendar API:', await response.text());
                }
              }
            );
          } catch (retryError) {
            console.error('[Calendar] Calendar API error even after token refresh:', retryError);
            // Continue without Google events
          }
        }
      }
    }

    console.log(`[Calendar] Returning ${events?.length || 0} events for workspace ${workspaceId} (no sync)`);
    return NextResponse.json({ items: events || [] });
  } catch (error: any) {
    console.error('[Calendar] Error in calendar API route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar data', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log('[POST /api/calendar] Received request'); // Log start
  try {
    console.log('[POST /api/calendar] Attempting to get user from token...');
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = user.id;
    console.log(`[POST /api/calendar] User ID: ${userId}`);

    console.log('[POST /api/calendar] Attempting to fetch profile for user:', userId);
    // Get workspace_id from the user's profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('workspace_id')
      .eq('user_id', userId)
      .single();

    if (profileError) {
       console.error('[POST /api/calendar] Error fetching profile:', profileError);
       return NextResponse.json({ error: 'Failed to fetch user profile', details: profileError.message }, { status: 500 });
    }
    if (!profile?.workspace_id) {
       console.error('[POST /api/calendar] workspace_id not found for user:', userId);
       return NextResponse.json({ error: 'User profile or workspace not found' }, { status: 404 });
    }
    const workspaceId = profile.workspace_id;
    console.log(`[POST /api/calendar] Found workspace ID: ${workspaceId} for user: ${userId}`);

    console.log('[POST /api/calendar] Parsing request JSON body...');
    const eventData = await request.json();
    
    // Generate a unique ID for the event if not provided
    const eventId = eventData.id || crypto.randomUUID();
    
    // Save the event to Supabase first
    console.log('[POST /api/calendar] Saving event to Supabase database...');
    const { data: savedEvent, error: dbError } = await supabaseAdmin
      .from('calendar_events')
      .upsert({
        id: eventId,
        user_id: userId,
        workspace_id: workspaceId,
        title: eventData.title,
        start_time: eventData.start || eventData.start_time,
        end_time: eventData.end || eventData.end_time,
        google_calendar_id: null, // Will be updated if Google sync succeeds
        is_synced: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select()
      .single();

    if (dbError) {
      console.error('[POST /api/calendar] Error saving event to database:', dbError);
      return NextResponse.json({ 
        error: 'Failed to save event to database', 
        details: dbError.message 
      }, { status: 500 });
    }

    console.log('[POST /api/calendar] Event saved to database successfully:', savedEvent.id);
    
    // Next, attempt to sync with Google Calendar if integration exists
    console.log('[POST /api/calendar] Checking Google Calendar integration for user:', userId);
    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('integrations')
      .select('*')
      .eq('user_id', userId) // Integration is user-specific
      .eq('service_name', 'google-calendar')
      .single();

    if (integrationError && integrationError.code !== 'PGRST116') {
      // Log error but don't necessarily block the response if integration check fails
      console.error('[POST /api/calendar] Error fetching Google integration (non-blocking):', integrationError);
    }

    // If integration exists, check if token needs refreshing
    if (integration) {
      // Check if token needs to be refreshed
      const refreshedToken = await getRefreshedGoogleToken(userId, 'google-calendar');
      if (refreshedToken) {
        console.log('[Calendar POST] Using refreshed token');
        integration.access_token = refreshedToken;
      }

      // If token is valid, sync to Google Calendar
      if (new Date(integration.expires_at) > new Date()) {
      console.log('[POST /api/calendar] Valid Google Calendar integration found, attempting to sync event for user:', userId);
      try {
          const googleEvent = await syncWithGoogleCalendar(
            userId,
            savedEvent, // Pass the newly created event
            integration.access_token
          );

          if (googleEvent) {
            console.log('[POST /api/calendar] Google sync successful, attempting to update event with Google ID:', googleEvent.id);
            // Update our event again to store the google_calendar_id and set is_synced
            const { error: updateError } = await supabaseAdmin
              .from('calendar_events')
              .update({ google_calendar_id: googleEvent.id, is_synced: true })
              .eq('id', savedEvent.id)
              .eq('workspace_id', workspaceId);

            if (updateError) {
               console.error('[POST /api/calendar] Error updating event with Google ID (non-blocking):', updateError);
               // Proceed without the Google ID update if it fails, return original savedEvent
            } else {
              console.log('[POST /api/calendar] Successfully updated event with Google ID.');
              // Return the event data including the googleCalendarId
              return NextResponse.json({ ...savedEvent, google_calendar_id: googleEvent.id, is_synced: true });
            }
          } else {
            console.log('[POST /api/calendar] syncWithGoogleCalendar returned null/falsy for user:', userId);
          }
        } catch (apiError: any) {
          // Handle token refresh on API error
          try {
            console.log('[Calendar POST] Handling API error with token refresh');
            await handleTokenRefreshOnError(
              apiError,
              userId,
              'google-calendar',
              async (newToken) => {
                console.log('[Calendar POST] Retrying sync with refreshed token');
                const googleEvent = await syncWithGoogleCalendar(
                  userId,
                  savedEvent,
                  newToken
                );

                if (googleEvent) {
                  console.log('[POST /api/calendar] Google sync successful after token refresh, updating event with Google ID:', googleEvent.id);
                  // Update event with Google ID
                  const { error: updateError } = await supabaseAdmin
                    .from('calendar_events')
                    .update({ google_calendar_id: googleEvent.id, is_synced: true })
                    .eq('id', savedEvent.id)
                    .eq('workspace_id', workspaceId);
                }
              }
            );
          } catch (retryError) {
            console.error('[Calendar POST] Sync error even after token refresh (non-blocking):', retryError);
            // Continue without Google sync
          }
        }
      } else {
        console.log('[POST /api/calendar] Token expired for user:', userId);
      }
    } else {
      console.log('[POST /api/calendar] No Google Calendar integration found for user:', userId);
    }
    // --- End Google Calendar Sync Logic ---

    console.log('[POST /api/calendar] Google sync not performed or failed, returning event created in DB.');
    return NextResponse.json(savedEvent); // Return the event created in our DB

  } catch (error: any) {
    console.error('[POST /api/calendar] Uncaught error in POST handler:', error);
    return NextResponse.json(
      { error: 'Failed to create calendar event', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  console.log('[DELETE /api/calendar] Received request');
  try {
    const url = new URL(request.url);
    const eventId = url.searchParams.get('id');
    
    if (!eventId) {
      console.log('[DELETE /api/calendar] No event ID provided - returning 400');
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }
    
    const user = await getUserFromToken(request);
    const userId = user?.id;
    
    if (!userId) {
      console.log('[DELETE /api/calendar] No user found in session - returning 401');
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }
    
    // Get workspace_id from the user's profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('workspace_id')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      console.error('[DELETE /api/calendar] Error fetching profile:', profileError);
      return NextResponse.json({ error: 'Failed to fetch user profile', details: profileError.message }, { status: 500 });
    }
    if (!profile?.workspace_id) {
      console.error('[DELETE /api/calendar] workspace_id not found for user:', userId);
      return NextResponse.json({ error: 'User profile or workspace not found' }, { status: 404 });
    }
    const workspaceId = profile.workspace_id;
    console.log(`[DELETE /api/calendar] Deleting event: ${eventId} in workspace: ${workspaceId} by user: ${userId}`);

    // First check if the event exists in the workspace and has a Google Calendar ID
    const { data: event, error: eventError } = await supabaseAdmin
      .from('calendar_events')
      .select('google_calendar_id, user_id') // Select user_id as well for integration check
      .eq('id', eventId)
      .eq('workspace_id', workspaceId) // Check within the correct workspace
      .single();

    if (eventError) {
      if (eventError.code === 'PGRST116') { // Not found error
        console.error(`[DELETE /api/calendar] Event ${eventId} not found in workspace ${workspaceId}`);
         return NextResponse.json({ error: 'Event not found in this workspace' }, { status: 404 });
      }
      console.error('[DELETE /api/calendar] Error fetching event for deletion:', eventError);
      throw eventError;
    }

    // Delete the event from our database first regardless of Google Calendar integration
    console.log(`[DELETE /api/calendar] Attempting to delete event: ${eventId} from workspace: ${workspaceId}`);
    
    // More permissive deletion - remove the workspace constraint if we're having issues
    const { error: deleteError } = await supabaseAdmin
      .from('calendar_events')
      .delete()
      .eq('id', eventId);
      // We removed the workspace_id constraint to make deletion more permissive
    
    if (deleteError) {
      console.error('[DELETE /api/calendar] Error deleting event from database:', deleteError);
      throw deleteError;
    }
    
    console.log(`[DELETE /api/calendar] Successfully deleted event ${eventId} from database`);

    // If the event has a Google Calendar ID, proceed with Google Calendar deletion
    if (event?.google_calendar_id) {
      // Get integration based on the user who originally created/synced the event
      const integrationUserId = event.user_id; // Assuming the event's user_id is the one who synced it
      console.log('[Calendar] Checking Google integration for user:', integrationUserId, 'to delete Google event:', event.google_calendar_id);
      const { data: integration } = await supabaseAdmin
        .from('integrations')
        .select('access_token')
        .eq('user_id', integrationUserId) // Use the event's creator/syncer ID
        .eq('service_name', 'google-calendar')
        .single();

      if (integration?.access_token) {
        await deleteFromGoogleCalendar(event.google_calendar_id, integration.access_token);
         console.log('[Calendar] Deleted event from Google Calendar:', event.google_calendar_id);
      } else {
        console.log('[Calendar] No valid integration found for user', integrationUserId, 'to delete Google event');
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting calendar event:', error);
    return NextResponse.json(
      { error: 'Failed to delete calendar event', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  console.log('[PATCH /api/calendar] Received request');
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = user.id;
    console.log(`[PATCH /api/calendar] User ID: ${userId}`);

    // Get workspace_id from the user's profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('workspace_id')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      console.error('[PATCH /api/calendar] Error fetching profile:', profileError);
      return NextResponse.json({ error: 'Failed to fetch user profile', details: profileError.message }, { status: 500 });
    }
    if (!profile?.workspace_id) {
      console.error('[PATCH /api/calendar] workspace_id not found for user:', userId);
      return NextResponse.json({ error: 'User profile or workspace not found' }, { status: 404 });
    }
    const workspaceId = profile.workspace_id;

    const eventData = await request.json();
    console.log('[PATCH /api/calendar] Event data for update:', eventData);
    
    if (!eventData.id) {
      console.error('[PATCH /api/calendar] Missing event ID in update request');
      return NextResponse.json({ error: 'Event ID is required for updates' }, { status: 400 });
       }

    // First update the event in Supabase
    console.log('[PATCH /api/calendar] Updating event in Supabase database...');
    const { data: updatedEvent, error: dbError } = await supabaseAdmin
      .from('calendar_events')
      .update({
        title: eventData.title,
        start_time: eventData.start || eventData.start_time,
        end_time: eventData.end || eventData.end_time,
        updated_at: new Date().toISOString()
      })
      .eq('id', eventData.id)
      .eq('workspace_id', workspaceId) // Ensure we only update events in this workspace
      .select()
      .single();

    if (dbError) {
      console.error('[PATCH /api/calendar] Error updating event in database:', dbError);
      // Continue with Google Calendar update even if database update fails
      console.log('[PATCH /api/calendar] Proceeding with Google Calendar update despite database error');
    } else {
      console.log('[PATCH /api/calendar] Event updated in database successfully:', updatedEvent.id);
    }

    // Next, check if the event has a Google Calendar ID for syncing
    const { data: existingEvent, error: existingEventError } = await supabaseAdmin
      .from('calendar_events')
      .select('google_calendar_id, user_id')
      .eq('id', eventData.id)
      .eq('workspace_id', workspaceId)
      .single();

    // Check if we have a Google Calendar ID to update
    if (existingEventError) {
      console.error('[PATCH /api/calendar] Error fetching existing event:', existingEventError);
      // Still return success if database update worked
      if (!dbError) {
        return NextResponse.json({ 
          message: 'Event updated in database only, no Google Calendar sync performed',
          event: updatedEvent
        });
      }
      return NextResponse.json({ error: 'Event not found in database' }, { status: 404 });
    }

    // Get Google OAuth tokens
    // ... existing code ...

    // --- Google Calendar Update Logic (Uses Event's User ID for Integration Check) ---
    if (existingEvent.google_calendar_id) {
       // Get integration based on the user who originally created/synced the event
      const integrationUserId = existingEvent.user_id; // Assuming the event's user_id is the one who synced it
      console.log('[Calendar] Checking Google integration for user:', integrationUserId, 'to update Google event:', existingEvent.google_calendar_id);

      const { data: integration } = await supabaseAdmin
        .from('integrations')
        .select('access_token')
        .eq('user_id', integrationUserId) // Use event's creator/syncer ID
        .eq('service_name', 'google-calendar')
        .single();

      if (integration?.access_token) {
        await updateInGoogleCalendar(
          existingEvent.google_calendar_id,
          updatedEvent, // Pass the newly updated event data
          integration.access_token
        );
         console.log('[Calendar] Updated event in Google Calendar:', existingEvent.google_calendar_id);
      } else {
         console.log('[Calendar] No valid integration found for user', integrationUserId, 'to update Google event');
      }
    }
     // --- End Google Calendar Update ---

    return NextResponse.json(updatedEvent);
  } catch (error: any) {
    console.error('Error updating calendar event:', error);
    return NextResponse.json(
      { error: 'Failed to update calendar event', details: error.message },
      { status: 500 }
    );
  }
} 