import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Instagram OAuth endpoint
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const state = searchParams.get('state') || '';

  const clientId = process.env.FACEBOOK_APP_ID;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/oauth/instagram/callback`;
  
  if (!clientId) {
    console.error('Instagram OAuth error: Missing FACEBOOK_APP_ID');
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=instagram_config_missing`));
  }
  
  // Try Instagram Basic Display first, but if that fails we can fall back to Facebook OAuth
  // Instagram Basic Display API scope
  const scope = 'user_profile,user_media';
  
  // Try using Facebook OAuth with Instagram permissions as alternative
  // This works if Instagram Business API is enabled on the Facebook app
  const useFacebookFlow = true; // Set to false to try direct Instagram OAuth
  
  if (useFacebookFlow) {
    // Use Facebook Login for Business with Instagram Configuration ID
    // This replaces the need for individual scope permissions
    const configId = '1781404066114378'; // Instagram configuration ID
    
    const authUrl = new URL('https://www.facebook.com/v23.0/dialog/oauth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('config_id', configId); // Use config_id instead of scope
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('_t', Date.now().toString()); // Cache busting parameter
    
    console.log('Instagram OAuth (via Facebook) URL:', authUrl.toString());
    return NextResponse.redirect(authUrl.toString());
  } else {
    // Direct Instagram Basic Display API (requires separate Instagram app setup)
    const authUrl = new URL('https://api.instagram.com/oauth/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);

    console.log('Instagram OAuth (direct) URL:', authUrl.toString());
    return NextResponse.redirect(authUrl.toString());
  }
} 