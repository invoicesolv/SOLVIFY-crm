import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import authOptions from "@/lib/auth";

// Define the Session user type with expected properties
interface SessionUser {
  id?: string;
  name?: string;
  email?: string;
  image?: string;
}

// Extend the Session type
declare module "next-auth" {
  interface Session {
    user: SessionUser;
    access_token: string;
    refresh_token: string;
  }
}

export async function GET() {
  try {
    // Get the current user from NextAuth session
    const session: any = await getServerSession(authOptions);
    const userId = session?.user?.id;

    // No userId, no events
    if (!userId) {
      console.log("[Calendar] No user ID found in session");
      return NextResponse.json([]);
    }

    // Use admin client directly to avoid JWT issues
    const { data: events, error } = await supabaseAdmin
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: true });

    if (error) {
      console.error("[Calendar] Error fetching events:", error);
      throw error;
    }

    return NextResponse.json(events || []);
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  console.log('[Calendar Events API] Received POST request');
  try {
    const body = await request.json();
    console.log('[Calendar Events API] Request body:', body);
    const { title, start, end } = body;

    // Get the current user from NextAuth session
    console.log('[Calendar Events API] Attempting to get session via getServerSession...');
    let session: any = null;
    let sessionError = null;
    try {
      session = await getServerSession(authOptions);
      console.log('[Calendar Events API] getServerSession result:', session ? `User ID: ${session.user?.id}` : 'null or undefined session');
    } catch (e: any) {
      sessionError = e;
      console.error('[Calendar Events API] Error calling getServerSession:', e);
    }
    
    if (sessionError || !session?.user?.id) {
      console.log(`[Calendar Events API] Unauthorized - No session user ID. Session: ${JSON.stringify(session)}, Error: ${sessionError}`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    console.log(`[Calendar Events API] User ID successfully retrieved: ${userId}`);

    // Prepare data for insertion
    const eventToInsert = {
          title,
          start_time: start,
          end_time: end,
      user_id: userId,
          is_synced: false
    };
    console.log('[Calendar Events API] Event data to insert:', eventToInsert);

    // Use admin client directly
    console.log('[Calendar Events API] Inserting event using admin client...');
    const { data, error } = await supabaseAdmin
      .from('calendar_events')
      .insert([eventToInsert])
      .select()
      .single();

    if (error) {
      console.error("[Calendar Events API] Supabase admin insert error:", error);
      throw new Error(`Supabase error: ${error.message} (Hint: ${error.hint}, Details: ${error.details})`);
    }

    console.log('[Calendar Events API] Event inserted successfully:', data);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Calendar Events API] Error creating event:', error.message || error);
    return NextResponse.json({ error: 'Failed to create event', details: error.message }, { status: 500 });
  }
}

// Add DELETE endpoint to handle event deletion
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const eventId = url.searchParams.get('id');
    
    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }
    
    // Get the current user from NextAuth session
    const session: any = await getServerSession(authOptions);
    const userId = session?.user?.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Use the admin client for direct database access
    const { error } = await supabaseAdmin
      .from('calendar_events')
      .delete()
      .eq('id', eventId)
      .eq('user_id', userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
} 