import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/global-auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * API endpoint to get member count for a chat channel
 */
export const GET = withAuth(async (req: NextRequest, { user, params }) => {
  try {
    const channelId = params?.channelId as string;
    
    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 });
    }

    console.log('[Chat Channel Members GET] Fetching member count for channel:', channelId);

    // Verify user has access to this channel
    const { data: channelAccess } = await supabaseAdmin
      .from('chat_channel_members')
      .select('channel_id')
      .eq('channel_id', channelId)
      .eq('user_id', user.id)
      .single();

    if (!channelAccess) {
      return NextResponse.json({ error: 'Access denied to channel' }, { status: 403 });
    }

    // Get member count
    const { data, error, count } = await supabaseAdmin
      .from('chat_channel_members')
      .select('user_id', { count: 'exact' })
      .eq('channel_id', channelId);

    if (error) {
      console.error('Error fetching channel member count:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      count: count || 0,
      members: data || []
    });

  } catch (error) {
    console.error("Error in chat channel members API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
});
