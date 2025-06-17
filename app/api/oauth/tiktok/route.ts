import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// TikTok OAuth endpoint
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const state = searchParams.get('state') || '';

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  // Use production URL for TikTok OAuth to match app settings
  const redirectUri = process.env.NODE_ENV === 'development' 
    ? 'https://crm.solvify.se/api/oauth/tiktok/callback'
    : `${process.env.NEXTAUTH_URL}/api/oauth/tiktok/callback`;
  
  if (!clientKey) {
    console.error('TikTok OAuth error: Missing TIKTOK_CLIENT_KEY');
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=tiktok_config_missing`));
  }
  
  // Generate CSRF state and code verifier for PKCE
  const csrfState = crypto.randomBytes(32).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  
  // TikTok OAuth 2.0 scopes for business API
  const scope = 'user.info.basic,video.list,video.upload';
  
  // Combine our state with TikTok's CSRF state
  const combinedState = JSON.stringify({
    csrf: csrfState,
    original: state,
    codeVerifier: codeVerifier
  });
  
  const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
  authUrl.searchParams.set('client_key', clientKey);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', combinedState);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  console.log('TikTok OAuth: Redirecting to:', authUrl.toString());
  return NextResponse.redirect(authUrl.toString());
} 