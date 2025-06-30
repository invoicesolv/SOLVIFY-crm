import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth-utils';
import { supabaseClient as supabase } from '@/lib/supabase-client';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaignId = params.id;

    // First check if campaign exists and is currently sending
    const { data: campaign, error: fetchError } = await supabase
      .from('email_campaigns')
      .select('id, workspace_id, status, name')
      .eq('id', campaignId)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Only allow aborting campaigns that are currently sending
    if (campaign.status !== 'sending') {
      return NextResponse.json({ 
        error: 'Campaign is not currently being sent and cannot be aborted' 
      }, { status: 400 });
    }

    // Update campaign status to paused to abort sending
    const { error: updateError } = await supabase
      .from('email_campaigns')
      .update({ 
        status: 'paused',
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    if (updateError) {
      console.error('Error aborting campaign:', updateError);
      return NextResponse.json({ error: 'Failed to abort campaign' }, { status: 500 });
    }

    // Log the abort action (optional - you can add to a campaign_logs table if you have one)
    console.log(`Campaign ${campaignId} (${campaign.name}) sending aborted by user ${user.id}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Campaign sending aborted successfully',
      campaign: {
        ...campaign,
        status: 'paused'
      }
    });
  } catch (error) {
    console.error('Error in POST /api/email-marketing/campaigns/[id]/abort:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 