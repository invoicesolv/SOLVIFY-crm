import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Threads OAuth endpoint
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const state = searchParams.get('state') || '';

  // Threads uses Facebook App credentials
  const clientId = process.env.FACEBOOK_APP_ID;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/oauth/threads/callback`;
  
  if (!clientId) {
    console.error('Threads OAuth error: Missing FACEBOOK_APP_ID');
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=threads_config_missing`));
  }
  
  // Threads permissions - using approved Facebook permissions since Threads uses Facebook infrastructure
  const scope = [
    'public_profile',
    'email',
    'pages_manage_posts',
    'pages_read_engagement', 
    'pages_manage_engagement',
    'pages_show_list',
    'read_insights',
    'business_management'
  ].join(',');
  
  // For now, Threads OAuth goes through Facebook since Threads API is limited
  // This may need to be updated when Threads API becomes more mature
  const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('config_id', 'threads'); // Additional parameter for Threads

  return NextResponse.redirect(authUrl.toString());
} 