import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// LinkedIn OAuth endpoint
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const state = searchParams.get('state') || '';

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/oauth/linkedin/callback`;
  
  if (!clientId) {
    console.error('LinkedIn OAuth error: Missing LINKEDIN_CLIENT_ID');
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=linkedin_config_missing`));
  }
  
  // LinkedIn OAuth 2.0 scopes for posting and profile access
  // Note: r_organization_admin requires special LinkedIn approval - removed for now
  const scope = 'openid profile email w_member_social';
  
  const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', scope);

  return NextResponse.redirect(authUrl.toString());
} 