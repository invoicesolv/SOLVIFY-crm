import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Facebook OAuth endpoint - using Facebook Login for Business
export async function GET(request: NextRequest) {
  console.log('🔵 [FACEBOOK OAUTH] Starting OAuth flow...');
  
  const searchParams = request.nextUrl.searchParams;
  const state = searchParams.get('state') || '';
  const forceBusiness = searchParams.get('force_business') === 'true';

  console.log('🔵 [FACEBOOK OAUTH] Request parameters:', {
    state: state,
    forceBusiness: forceBusiness,
    allParams: Object.fromEntries(searchParams.entries())
  });

  // Facebook Graph API
  const clientId = process.env.FACEBOOK_APP_ID;
  const baseUrl = process.env.NEXTAUTH_URL;
  const redirectUri = `${(baseUrl || '').replace(/\/$/, '')}/api/oauth/facebook/callback`;
  
  console.log('🔵 [FACEBOOK OAUTH] Environment check:', {
    hasClientId: !!clientId,
    clientIdPreview: clientId ? clientId.substring(0, 8) + '***' : 'None',
    baseUrl: baseUrl,
    redirectUri: redirectUri
  });
  
  if (!clientId) {
    console.error('🔴 [FACEBOOK OAUTH] Missing FACEBOOK_APP_ID');
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=facebook_config_missing`));
  }
  
  // ALWAYS request business permissions since app is live and approved
  // Note: instagram_basic is handled through separate Instagram API configuration
  const scope = [
    'public_profile',            // Default permission (always granted)
    'email',                     // User's email address
    'pages_show_list',           // List user's pages
    'pages_read_engagement',     // Read page engagement data (required for Instagram API)
    'pages_manage_posts',        // Create, edit and delete page posts (CRITICAL!)
    'pages_manage_engagement',   // Manage comments and engagement
    'pages_manage_metadata',     // Page settings and webhooks
    'pages_read_user_content',   // Read user-generated content on pages
    'business_management',       // Business Manager API access
    'read_insights'             // Page insights and analytics
  ].join(',');
  
  // Use Facebook Business Login endpoint with latest API version
  const authUrl = new URL('https://www.facebook.com/v23.0/dialog/oauth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);
  
  // Add extra_scopes for business features
  authUrl.searchParams.set('extras', JSON.stringify({
    feature: 'login_for_business'
  }));

  // Force re-authorization if this is an upgrade from basic to business permissions
  if (forceBusiness) {
    authUrl.searchParams.set('auth_type', 'rerequest');
    console.log('Facebook OAuth: Forcing business permission rerequest');
  }

  console.log('🔵 [FACEBOOK OAUTH] Generated OAuth URL:', authUrl.toString());
  console.log('🔵 [FACEBOOK OAUTH] Redirecting user to Facebook...');
  return NextResponse.redirect(authUrl.toString());
} 