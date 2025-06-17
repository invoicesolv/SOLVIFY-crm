import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Instagram OAuth fallback endpoint using individual scopes
export async function GET(request: NextRequest) {
  console.log('🔵 [INSTAGRAM FALLBACK] Starting OAuth flow with individual scopes...');
  
  const searchParams = request.nextUrl.searchParams;
  const state = searchParams.get('state') || '';

  const clientId = process.env.FACEBOOK_APP_ID;
  
  // Use localhost for development
  const baseUrl = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000' 
    : (process.env.NEXTAUTH_URL || 'https://crm.solvify.se');
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const redirectUri = `${cleanBaseUrl}/api/oauth/instagram/callback`;

  if (!clientId) {
    console.error('🔴 [INSTAGRAM FALLBACK] Missing FACEBOOK_APP_ID');
    return NextResponse.json({ error: 'Missing Facebook App ID' }, { status: 500 });
  }

  // Use the clean configuration ID that doesn't contain instagram_basic
  const configId = '1778850556365268'; // This should be the clean config without instagram_basic
  
  const authUrl = new URL('https://www.facebook.com/v23.0/dialog/oauth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('config_id', configId); // Instagram Business requires config_id
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);

  console.log('🔵 [INSTAGRAM FALLBACK] Redirecting with config_id:', {
    url: authUrl.toString(),
    configId: configId,
    redirectUri: redirectUri
  });

  return NextResponse.redirect(authUrl.toString());
} 