import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    
    console.log('=== TIKTOK CREDENTIALS DEBUG ===');
    console.log('Client Key exists:', !!clientKey);
    console.log('Client Secret exists:', !!clientSecret);
    console.log('Client Key length:', clientKey?.length);
    console.log('Client Secret length:', clientSecret?.length);
    console.log('Client Key preview:', clientKey?.substring(0, 10) + '...');
    console.log('Client Secret preview:', clientSecret?.substring(0, 10) + '...');
    
    if (clientKey && clientSecret) {
      console.log('Testing TikTok OAuth configuration...');
      
      // Test the OAuth authorization URL construction
      const redirectUri = `${process.env.NEXTAUTH_URL}/api/oauth/tiktok/callback`;
      const scope = 'user.info.basic,video.list,video.upload';
      
      const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
      authUrl.searchParams.set('client_key', clientKey);
      authUrl.searchParams.set('scope', scope);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('redirect_uri', redirectUri);
      
      return NextResponse.json({
        status: 'debug',
        hasClientKey: !!clientKey,
        hasClientSecret: !!clientSecret,
        clientKeyLength: clientKey?.length,
        clientSecretLength: clientSecret?.length,
        redirectUri: redirectUri,
        scope: scope,
        authUrl: authUrl.toString(),
        note: '✅ TikTok credentials configured correctly',
        endpoint: 'TikTok for Business API configuration ready'
      });
    } else {
      return NextResponse.json({
        status: 'error',
        hasClientKey: !!clientKey,
        hasClientSecret: !!clientSecret,
        note: '❌ Missing TikTok credentials',
        missing: [
          !clientKey ? 'TIKTOK_CLIENT_KEY' : null,
          !clientSecret ? 'TIKTOK_CLIENT_SECRET' : null
        ].filter(Boolean)
      });
    }
  } catch (error) {
    console.error('TikTok credentials debug error:', error);
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      note: '❌ Debug failed'
    }, { status: 500 });
  }
} 