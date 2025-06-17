import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Instagram OAuth endpoint
export async function GET(request: NextRequest) {
  console.log('🔵 [INSTAGRAM OAUTH] Starting OAuth flow...');
  
  const searchParams = request.nextUrl.searchParams;
  const state = searchParams.get('state') || '';

  console.log('🔵 [INSTAGRAM OAUTH] Request parameters:', {
    state: state,
    allParams: Object.fromEntries(searchParams.entries())
  });

  const clientId = process.env.FACEBOOK_APP_ID;
  
  // Use localhost for development
  const baseUrl = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000' 
    : (process.env.NEXTAUTH_URL || 'https://crm.solvify.se');
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const redirectUri = `${cleanBaseUrl}/api/oauth/instagram/callback`;
  
  if (!clientId) {
    console.error('🔴 [INSTAGRAM OAUTH] Missing FACEBOOK_APP_ID');
    return NextResponse.json({ error: 'Missing Facebook App ID' }, { status: 500 });
  }

  console.log('🔵 [INSTAGRAM OAUTH] Environment check:', {
    clientId: clientId ? `${clientId.substring(0, 8)}***` : 'NOT SET',
    redirectUri: redirectUri,
    baseUrl: cleanBaseUrl
  });

  // Use Facebook Login for Business with your NEW Instagram Graph API configuration
  // New Configuration ID from your Facebook Developer Console (without instagram_basic)
  const configId = '1778850556365268'; // Your NEW Instagram Graph API configuration
    
    const authUrl = new URL('https://www.facebook.com/v23.0/dialog/oauth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('config_id', configId); // Use config_id instead of scope
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);

  console.log('🔵 [INSTAGRAM OAUTH] Redirecting to Facebook Login for Business:', {
    url: authUrl.toString(),
    configId: configId,
    redirectUri: redirectUri
  });

    return NextResponse.redirect(authUrl.toString());
} 