import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const clientId = process.env.FACEBOOK_APP_ID;
  const baseUrl = process.env.NEXTAUTH_URL || 'https://crm.solvify.se';
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const redirectUri = `${cleanBaseUrl}/api/oauth/instagram/callback`;
  const configId = '1778850556365268';
  const state = 'debug-test';

  // Generate the exact same URL that the Instagram OAuth route generates
  const authUrl = new URL('https://www.facebook.com/v23.0/dialog/oauth');
  authUrl.searchParams.set('client_id', clientId || 'MISSING');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('config_id', configId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);

  return NextResponse.json({
    title: 'Instagram OAuth URL Debug',
    timestamp: new Date().toISOString(),
    
    environment: {
      FACEBOOK_APP_ID: clientId ? `${clientId.substring(0, 8)}***` : 'NOT SET',
      baseUrl: cleanBaseUrl,
      redirectUri: redirectUri
    },
    
    oauth_parameters: {
      client_id: clientId || 'MISSING',
      redirect_uri: redirectUri,
      config_id: configId,
      response_type: 'code',
      state: state
    },
    
    generated_url: authUrl.toString(),
    
    instructions: [
      '1. Copy the generated_url above',
      '2. Open it in a browser to test the OAuth flow',
      '3. Check if instagram_basic error still appears',
      '4. If error persists, the issue is in your Facebook Developer Console configuration'
    ],
    
    facebook_console_check: [
      'Go to developers.facebook.com/apps',
      'Select your app → Facebook Login for Business → Configurations',
      'Edit Instagram-IG configuration (1781404066114378)',
      'Remove instagram_basic from permissions if it still exists',
      'Save the configuration'
    ]
  });
} 