import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const clientId = process.env.FACEBOOK_APP_ID;
  const baseUrl = process.env.NEXTAUTH_URL || 'https://crm.solvify.se';
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const redirectUri = `${cleanBaseUrl}/api/oauth/instagram/callback`;
  
  // Current configuration ID
  const configId = '1778850556365268';
  
  // Build the OAuth URL
  const authUrl = new URL('https://www.facebook.com/v23.0/dialog/oauth');
  authUrl.searchParams.set('client_id', clientId || '');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('config_id', configId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', 'debug-test');

  return NextResponse.json({
    status: 'Instagram OAuth Configuration Check',
    environment: {
      clientId: clientId ? `${clientId.substring(0, 8)}***` : 'NOT SET',
      baseUrl: cleanBaseUrl,
      redirectUri: redirectUri
    },
    configuration: {
      configId: configId,
      note: 'This configuration should NOT contain instagram_basic permission'
    },
    oauthUrl: authUrl.toString(),
    instructions: [
      '1. Verify that Facebook configuration ' + configId + ' does NOT contain instagram_basic',
      '2. Configuration should only have: business_management, email, pages_*, read_insights',
      '3. Test the OAuth URL above in a browser',
      '4. If you still get "Invalid Scopes: instagram_basic", the Facebook config still contains it'
    ],
    validPermissions: [
      'business_management',
      'email', 
      'pages_manage_engagement',
      'pages_manage_metadata',
      'pages_manage_posts',
      'pages_read_engagement',
      'pages_read_user_content',
      'pages_show_list',
      'read_insights'
    ],
    invalidPermissions: [
      'instagram_basic (DEPRECATED - REMOVE THIS)'
    ]
  });
} 