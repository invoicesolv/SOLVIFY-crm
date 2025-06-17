import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('=== INSTAGRAM OAUTH DEBUG ===');
  
  // Check environment variables
  const nextAuthUrl = process.env.NEXTAUTH_URL;
  const facebookAppId = process.env.FACEBOOK_APP_ID;
  const facebookAppSecret = process.env.FACEBOOK_APP_SECRET;
  const metaClientSecret = process.env.META_CLIENT_SECRET;
  
  // Generate the redirect URI that Instagram OAuth is trying to use
  const baseUrl = nextAuthUrl || 'https://crm.solvify.se';
  const cleanBaseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  const instagramRedirectUri = `${cleanBaseUrl}/api/oauth/instagram/callback`;
  
  // Also check what Facebook OAuth uses for comparison
  const facebookRedirectUri = `${cleanBaseUrl}/api/oauth/facebook/callback`;
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment_check: {
      NEXTAUTH_URL: nextAuthUrl || 'NOT SET',
      FACEBOOK_APP_ID: facebookAppId ? `${facebookAppId.substring(0, 8)}***` : 'NOT SET',
      FACEBOOK_APP_SECRET: facebookAppSecret ? 'SET' : 'NOT SET',
      META_CLIENT_SECRET: metaClientSecret ? 'SET' : 'NOT SET',
      NODE_ENV: process.env.NODE_ENV
    },
    generated_redirect_uris: {
      instagram: instagramRedirectUri,
      facebook: facebookRedirectUri,
      base_url_used: cleanBaseUrl
    },
    facebook_app_configuration_needed: {
      app_id: facebookAppId,
      redirect_uris_to_add: [
        instagramRedirectUri,
        facebookRedirectUri,
        // Development URIs if needed
        'http://localhost:3000/api/oauth/instagram/callback',
        'http://localhost:3000/api/oauth/facebook/callback'
      ],
      facebook_developer_console: 'https://developers.facebook.com/apps/',
      instructions: [
        '1. Go to Facebook Developer Console',
        '2. Select your app',
        '3. Go to Facebook Login > Settings',
        '4. Add the redirect URIs above to "Valid OAuth Redirect URIs"',
        '5. Save changes'
      ]
    },
    current_request_info: {
      host: request.headers.get('host'),
      protocol: request.headers.get('x-forwarded-proto') || 'http',
      full_url: request.url,
      user_agent: request.headers.get('user-agent')
    }
  });
} 