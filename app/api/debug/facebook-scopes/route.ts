import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const clientId = process.env.FACEBOOK_APP_ID;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/oauth/facebook/callback`;
  
  if (!clientId) {
    return NextResponse.json({ error: 'Missing FACEBOOK_APP_ID' }, { status: 500 });
  }

  // Test different scope combinations
  const basicScopes = ['public_profile', 'email'];
  const pageScopes = ['pages_show_list', 'pages_manage_posts'];
  const businessScopes = ['business_management', 'read_insights'];
  const engagementScopes = ['pages_read_engagement', 'pages_manage_engagement', 'pages_manage_metadata', 'pages_read_user_content'];

  const allScopes = [...basicScopes, ...pageScopes, ...businessScopes, ...engagementScopes];

  const testConfigurations = [
    { name: 'Basic Only', scopes: basicScopes },
    { name: 'Basic + Pages', scopes: [...basicScopes, ...pageScopes] },
    { name: 'Basic + Business', scopes: [...basicScopes, ...businessScopes] },
    { name: 'All Scopes', scopes: allScopes },
  ];

  const results = testConfigurations.map(config => {
    const scope = config.scopes.join(',');
    const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', JSON.stringify({ test: config.name }));

    return {
      name: config.name,
      scopes: config.scopes,
      url: authUrl.toString()
    };
  });

  return NextResponse.json({
    debug: 'Facebook Scopes Test',
    appId: clientId,
    redirectUri: redirectUri,
    configurations: results,
    notes: [
      'Try each configuration to see which scopes cause the error',
      'Start with Basic Only and work your way up',
      'Check if your Facebook app is in Live mode',
      'Verify business verification status'
    ]
  });
} 