import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/global-auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * API endpoint to get unread message count for a chat channel
 */
export const GET = withAuth(async (req: NextRequest, { user, params }) => {
  try {
    const channelId = params?.channelId as string;
    const url = new URL(req.url);
    const userId = url.searchParams.get('user_id') || user.id;
    
    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 });
    }

    console.log('[Chat Channel Unread GET] Fetching unread count for channel:', channelId, 'user:', userId);

    // Verify user has access to this channel
    const { data: channelAccess } = await supabaseAdmin
      .from('chat_channel_members')
      .select('channel_id, last_read_at')
      .eq('channel_id', channelId)
      .eq('user_id', userId)
      .single();

    if (!channelAccess) {
      return NextResponse.json({ error: 'Access denied to channel' }, { status: 403 });
    }

    // Get unread message count
    let query = supabaseAdmin
      .from('chat_messages')
      .select('id', { count: 'exact' })
      .eq('channel_id', channelId)
      .neq('user_id', userId); // Don't count own messages

    // If user has a last_read_at timestamp, only count messages after that
    if (channelAccess.last_read_at) {
      query = query.gt('created_at', channelAccess.last_read_at);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching channel unread count:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      count: count || 0,
      last_read_at: channelAccess.last_read_at
    });

  } catch (error) {
    console.error("Error in chat channel unread API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
});
