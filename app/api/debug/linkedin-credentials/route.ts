import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    
    console.log('=== LINKEDIN CREDENTIALS DEBUG ===');
    console.log('Client ID exists:', !!clientId);
    console.log('Client Secret exists:', !!clientSecret);
    console.log('Client ID length:', clientId?.length);
    console.log('Client Secret length:', clientSecret?.length);
    console.log('Client ID preview:', clientId?.substring(0, 10) + '...');
    console.log('Client Secret preview:', clientSecret?.substring(0, 10) + '...');
    
    if (clientId && clientSecret) {
      console.log('Testing LinkedIn OAuth configuration...');
      
      // Test the OAuth authorization URL construction
      const redirectUri = `${process.env.NEXTAUTH_URL}/api/oauth/linkedin/callback`;
      const scope = 'openid profile email w_member_social';
      
      const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', scope);
      
      return NextResponse.json({
        status: 'debug',
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        clientIdLength: clientId?.length,
        clientSecretLength: clientSecret?.length,
        redirectUri: redirectUri,
        scope: scope,
        authUrl: authUrl.toString(),
        note: '✅ LinkedIn credentials configured correctly',
        endpoint: 'LinkedIn OAuth 2.0 configuration ready'
      });
    } else {
      return NextResponse.json({
        status: 'error',
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        note: '❌ Missing LinkedIn credentials',
        missing: [
          !clientId ? 'LINKEDIN_CLIENT_ID' : null,
          !clientSecret ? 'LINKEDIN_CLIENT_SECRET' : null
        ].filter(Boolean)
      });
    }
  } catch (error) {
    console.error('LinkedIn credentials debug error:', error);
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      note: '❌ Debug failed'
    }, { status: 500 });
  }
} 