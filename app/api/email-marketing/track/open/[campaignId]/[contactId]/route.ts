import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient as supabase } from '@/lib/supabase-client';

// 1x1 transparent pixel as base64
const TRACKING_PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

export async function GET(
  request: NextRequest,
  { params }: { params: { campaignId: string; contactId: string } }
) {
  const { campaignId, contactId } = params;

  try {
    // Record the email open
    await supabase
      .from('email_campaign_opens')
      .insert({
        campaign_id: campaignId,
        contact_id: contactId,
        opened_at: new Date().toISOString(),
        user_agent: request.headers.get('user-agent') || '',
        ip_address: request.ip || request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
      });

    // Update campaign stats
    const { data: campaign } = await supabase
      .from('email_campaigns')
      .select('opened_count')
      .eq('id', campaignId)
      .single();

    if (campaign) {
      await supabase
        .from('email_campaigns')
        .update({
          opened_count: (campaign.opened_count || 0) + 1
        })
        .eq('id', campaignId);
    }

    // Update contact engagement
    await supabase
      .from('email_contacts')
      .update({
        last_opened: new Date().toISOString(),
        engagement_score: supabase.rpc('increment_engagement_score', { 
          contact_id: contactId, 
          points: 5 
        })
      })
      .eq('id', contactId);

    // Return the tracking pixel
    const buffer = Buffer.from(TRACKING_PIXEL, 'base64');
    
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error('Error tracking email open:', error);
    
    // Still return the pixel even if tracking fails
    const buffer = Buffer.from(TRACKING_PIXEL, 'base64');
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': buffer.length.toString(),
      },
    });
  }
} 