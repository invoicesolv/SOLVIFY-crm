import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Threads OAuth endpoint
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const state = searchParams.get('state') || '';

  // Threads uses Facebook App credentials but has its own API endpoints
  const clientId = process.env.FACEBOOK_APP_ID;
  const baseUrl = process.env.NEXTAUTH_URL || 'https://crm.solvify.se';
  const redirectUri = `${baseUrl}/api/oauth/threads/callback`;
  
  if (!clientId) {
    console.error('Threads OAuth error: Missing FACEBOOK_APP_ID');
    return NextResponse.redirect(new URL(`${baseUrl}/settings?error=threads_config_missing`));
  }
  
  console.log('🧵 [THREADS OAUTH] Starting Threads OAuth flow:', {
    clientId: clientId ? `${clientId.substring(0, 8)}***` : 'NOT SET',
    redirectUri: redirectUri,
    state: state
  });
  
  // Use the same approach as Instagram Business - use a configuration ID instead of scope
  // This avoids permission issues and uses your existing Facebook App configuration
  const authUrl = new URL('https://www.facebook.com/v23.0/dialog/oauth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);
  
  // Use your existing General Configuration ID (same as Instagram Business)
  // This should have the required permissions already approved
  authUrl.searchParams.set('config_id', '2197969850643897');

  console.log('🧵 [THREADS OAUTH] Redirecting to Threads OAuth:', {
    url: authUrl.toString(),
    configId: '2197969850643897'
  });

  return NextResponse.redirect(authUrl.toString());
} 