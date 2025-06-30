import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// X (Twitter) OAuth endpoint
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const state = searchParams.get('state') || '';

  // Use development URL when in development mode
  const baseUrl = process.env.NODE_ENV === 'development' 
    ? process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'
    : process.env.NEXT_PUBLIC_SITE_URL;

  // X (Twitter) App credentials - use OAuth 2.0 Client ID for OAuth flow
  const clientId = process.env.TWITTER_CLIENT_ID;
  const redirectUri = `${baseUrl}/api/oauth/twitter/callback`;
  
  if (!clientId) {
    console.error('X OAuth error: Missing TWITTER_CLIENT_ID');
    return NextResponse.redirect(new URL(`${baseUrl}/settings?error=twitter_config_missing`));
  }
  
  console.log('X OAuth: Using base URL:', baseUrl);
  console.log('X OAuth: Redirect URI:', redirectUri);
  
  // X OAuth 2.0 scopes for posting tweets
  const scope = 'tweet.read tweet.write users.read offline.access';
  
  // Generate code challenge for PKCE
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  
  // Store code verifier in session/state for later use
  let stateObj = {};
  try {
    // The state parameter might be URL encoded, so decode it first
    const decodedState = decodeURIComponent(state);
    stateObj = decodedState ? JSON.parse(decodedState) : {};
  } catch (error) {
    console.error('X OAuth: Failed to parse state parameter:', error);
    // If parsing fails, start with empty object
    stateObj = {};
  }
  
  const stateWithVerifier = JSON.stringify({
    ...stateObj,
    codeVerifier
  });
  
  const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('state', stateWithVerifier);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  
  console.log('X OAuth URL:', authUrl.toString());
  return NextResponse.redirect(authUrl.toString());
}

// Generate code verifier for PKCE
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, Array.from(array)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Generate code challenge from verifier
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
} 