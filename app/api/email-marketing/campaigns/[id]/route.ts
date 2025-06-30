import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth-utils';
import { supabaseClient as supabase } from '@/lib/supabase-client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaignId = params.id;

    // Get campaign details
    const { data: campaign, error } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (error) {
      console.error('Error fetching campaign:', error);
      return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 });
    }

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error('Error in GET /api/email-marketing/campaigns/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaignId = params.id;

    // First check if campaign exists and belongs to user's workspace
    const { data: campaign, error: fetchError } = await supabase
      .from('email_campaigns')
      .select('id, workspace_id, status')
      .eq('id', campaignId)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Prevent deletion of campaigns that are currently sending
    if (campaign.status === 'sending') {
      return NextResponse.json({ 
        error: 'Cannot delete campaign that is currently being sent' 
      }, { status: 400 });
    }

    // Delete the campaign
    const { error: deleteError } = await supabase
      .from('email_campaigns')
      .delete()
      .eq('id', campaignId);

    if (deleteError) {
      console.error('Error deleting campaign:', deleteError);
      return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Campaign deleted successfully' 
    });
  } catch (error) {
    console.error('Error in DELETE /api/email-marketing/campaigns/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaignId = params.id;
    const body = await request.json();

    // Update campaign
    const { data: campaign, error } = await supabase
      .from('email_campaigns')
      .update(body)
      .eq('id', campaignId)
      .select()
      .single();

    if (error) {
      console.error('Error updating campaign:', error);
      return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
    }

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error('Error in PUT /api/email-marketing/campaigns/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 