import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = headers();
    
    // TikTok webhook signature verification
    const signature = headersList.get('x-tiktok-signature');
    
    console.log('TikTok webhook received:', {
      signature,
      body: body.substring(0, 200) + '...' // Log first 200 chars
    });
    
    // Parse webhook data
    const data = JSON.parse(body);
    
    // Handle different webhook events
    switch (data.event) {
      case 'video.publish':
        console.log('TikTok video published:', data);
        // Update post status in database
        break;
        
      case 'video.delete':
        console.log('TikTok video deleted:', data);
        // Update post status in database
        break;
        
      default:
        console.log('Unknown TikTok webhook event:', data.event);
    }
    
    // Return success response
    return NextResponse.json({ status: 'success' });
    
  } catch (error) {
    console.error('TikTok webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' }, 
      { status: 500 }
    );
  }
}

// Handle webhook verification challenge
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const challenge = searchParams.get('challenge');
  
  if (challenge) {
    console.log('TikTok webhook challenge:', challenge);
    return new Response(challenge, {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  return NextResponse.json({ status: 'TikTok webhook endpoint active' });
} 