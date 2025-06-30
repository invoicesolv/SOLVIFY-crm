import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Instagram Business OAuth endpoint using Instagram Graph API (not deprecated Basic Display API)
export async function GET(request: NextRequest) {
  console.log('🔵 [INSTAGRAM BUSINESS] Starting OAuth flow with Instagram Graph API...');
  
  const searchParams = request.nextUrl.searchParams;
  const state = searchParams.get('state') || '';

  const clientId = process.env.FACEBOOK_APP_ID;
  
  const baseUrl = process.env.NODE_ENV === 'development' 
    ? process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'
    : (process.env.NEXT_PUBLIC_SITE_URL || 'https://crm.solvify.se');
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const redirectUri = `${cleanBaseUrl}/api/oauth/instagram-business/callback`;

  if (!clientId) {
    console.error('🔴 [INSTAGRAM BUSINESS] Missing FACEBOOK_APP_ID');
    return NextResponse.json({ error: 'Missing Facebook App ID' }, { status: 500 });
  }

  // Use the new General Configuration ID (without instagram_basic)
  // Configuration ID 2197969850643897 includes Facebook Pages permissions for Instagram Business:
  // business_management, pages_manage_engagement, pages_manage_posts,
  // pages_read_engagement, pages_read_user_content, pages_show_list, read_insights
  const authUrl = new URL('https://www.facebook.com/v23.0/dialog/oauth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);
  
  // Use the General Configuration ID (avoids instagram_basic scope error)
  authUrl.searchParams.set('config_id', '2197969850643897');

  console.log('🔵 [INSTAGRAM BUSINESS] Redirecting with General Configuration (no instagram_basic):', {
    url: authUrl.toString(),
    configId: '2197969850643897',
    redirectUri: redirectUri
  });

  return NextResponse.redirect(authUrl.toString());
} 