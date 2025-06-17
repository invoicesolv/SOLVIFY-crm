import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { campaignId: string; contactId: string } }
) {
  const { campaignId, contactId } = params;
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  try {
    if (!targetUrl) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Record the click
    await supabase
      .from('email_campaign_clicks')
      .insert({
        campaign_id: campaignId,
        contact_id: contactId,
        url: targetUrl,
        clicked_at: new Date().toISOString(),
        user_agent: request.headers.get('user-agent') || '',
        ip_address: request.ip || request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
      });

    // Update campaign stats
    const { data: campaign } = await supabase
      .from('email_campaigns')
      .select('clicked_count')
      .eq('id', campaignId)
      .single();

    if (campaign) {
      await supabase
        .from('email_campaigns')
        .update({
          clicked_count: (campaign.clicked_count || 0) + 1
        })
        .eq('id', campaignId);
    }

    // Update contact engagement (clicks are worth more than opens)
    await supabase
      .from('email_contacts')
      .update({
        last_clicked: new Date().toISOString(),
        engagement_score: supabase.rpc('increment_engagement_score', { 
          contact_id: contactId, 
          points: 10 
        })
      })
      .eq('id', contactId);

    // Redirect to the target URL
    return NextResponse.redirect(targetUrl);

  } catch (error) {
    console.error('Error tracking email click:', error);
    
    // Still redirect even if tracking fails
    return NextResponse.redirect(targetUrl || new URL('/', request.url));
  }
} 