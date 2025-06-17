import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const clientId = process.env.FACEBOOK_APP_ID;
  const baseUrl = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000' 
    : (process.env.NEXTAUTH_URL || 'https://crm.solvify.se');
  const redirectUri = `${baseUrl}/api/oauth/instagram/callback`;
  
  // Test the fallback approach with individual scopes
  const scopes = [
    'business_management',
    'email',
    'pages_manage_engagement',
    'pages_manage_metadata', 
    'pages_manage_posts',
    'pages_read_engagement',
    'pages_read_user_content',
    'pages_show_list',
    'read_insights'
  ];
  
  const authUrl = new URL('https://www.facebook.com/v23.0/dialog/oauth');
  authUrl.searchParams.set('client_id', clientId || '');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scopes.join(','));
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', 'debug-test-flow');
  
  return NextResponse.json({
    status: 'Instagram OAuth Flow Test',
    environment: {
      clientId: clientId ? `${clientId.substring(0, 8)}***` : 'MISSING',
      baseUrl: baseUrl,
      redirectUri: redirectUri,
      nodeEnv: process.env.NODE_ENV
    },
    oauth_url: authUrl.toString(),
    scopes_used: scopes,
    instructions: [
      '1. Copy the oauth_url and paste it in your browser',
      '2. Complete the Facebook OAuth flow',
      '3. Check the terminal logs for the callback processing',
      '4. You should be redirected back to /settings with success or error'
    ],
    note: 'This uses individual scopes instead of config_id to avoid the instagram_basic issue'
  });
} 