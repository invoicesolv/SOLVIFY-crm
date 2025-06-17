import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getActiveWorkspaceId } from '@/lib/permission';
import crypto from 'crypto';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Instagram OAuth callback
export async function GET(request: NextRequest) {
  console.log('🔵 [INSTAGRAM OAUTH] Callback starting...');
  
  const session = await getServerSession(authOptions);
  
  // Use localhost for development
  const baseUrl = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000' 
    : (process.env.NEXTAUTH_URL || 'https://crm.solvify.se');
  
  console.log('🔵 [INSTAGRAM OAUTH] Environment check:', {
    hasSession: !!session,
    userId: session?.user?.id,
    baseUrl: baseUrl
  });
  
  if (!session?.user?.id) {
    console.error('🔴 [INSTAGRAM OAUTH] No user session found');
    return NextResponse.redirect(new URL(`${baseUrl}/login`));
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const state = searchParams.get('state');

  console.log('🔵 [INSTAGRAM OAUTH] Callback parameters:', {
    hasCode: !!code,
    error: error,
    errorDescription: errorDescription,
    state: state
  });

  if (error) {
    console.error('🔴 [INSTAGRAM OAUTH] OAuth error:', { error, errorDescription });
    
    // Handle specific error cases
    if (error === 'access_denied') {
      console.log('🟡 [INSTAGRAM OAUTH] User cancelled the authorization');
      return NextResponse.redirect(new URL(`${baseUrl}/settings?error=instagram_cancelled&details=User cancelled the authorization`));
    }
    
    return NextResponse.redirect(new URL(`${baseUrl}/settings?error=instagram_oauth_error&details=${encodeURIComponent(errorDescription || error)}`));
  }

  if (!code) {
    console.error('🔴 [INSTAGRAM OAUTH] No authorization code received');
    return NextResponse.redirect(new URL(`${baseUrl}/settings?error=instagram_no_code`));
  }

  try {
    const clientId = process.env.FACEBOOK_APP_ID;
    const clientSecret = process.env.FACEBOOK_APP_SECRET;
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    const redirectUri = `${cleanBaseUrl}/api/oauth/instagram/callback`;

    if (!clientId || !clientSecret) {
      console.error('🔴 [INSTAGRAM OAUTH] Missing Facebook credentials');
      return NextResponse.redirect(new URL(`${baseUrl}/settings?error=instagram_config_missing`));
    }

    console.log('🔵 [INSTAGRAM OAUTH] Exchanging code for access token...');

    // Exchange authorization code for access token using Facebook's token endpoint
    const tokenResponse = await fetch('https://graph.facebook.com/v23.0/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code: code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('🔴 [INSTAGRAM OAUTH] Token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText
      });
      return NextResponse.redirect(new URL(`${baseUrl}/settings?error=instagram_token_exchange_failed`));
    }

    const tokenData = await tokenResponse.json();
    console.log('🔵 [INSTAGRAM OAUTH] Token exchange successful:', {
      hasAccessToken: !!tokenData.access_token,
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in
    });

    if (!tokenData.access_token) {
      console.error('🔴 [INSTAGRAM OAUTH] No access token in response');
      return NextResponse.redirect(new URL(`${baseUrl}/settings?error=instagram_no_access_token`));
    }

    // Create appsecret_proof for secure API calls
    const appsecretProof = crypto
      .createHmac('sha256', clientSecret)
      .update(tokenData.access_token)
      .digest('hex');

    console.log('🔵 [INSTAGRAM OAUTH] Fetching user profile...');

    // Get user profile information
    const profileResponse = await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${tokenData.access_token}&appsecret_proof=${appsecretProof}`);

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error('🔴 [INSTAGRAM OAUTH] Profile fetch failed:', errorText);
      return NextResponse.redirect(new URL(`${baseUrl}/settings?error=instagram_profile_fetch_failed`));
    }

    const profileData = await profileResponse.json();
    console.log('🔵 [INSTAGRAM OAUTH] Profile data received:', {
      id: profileData.id,
      name: profileData.name,
      email: profileData.email
    });

    // Check what permissions were actually granted
    console.log('🔵 [INSTAGRAM OAUTH] Checking granted permissions...');
    const permissionsResponse = await fetch(`https://graph.facebook.com/me/permissions?access_token=${tokenData.access_token}&appsecret_proof=${appsecretProof}`);
    
    let grantedPermissions: string[] = [];
    if (permissionsResponse.ok) {
      const permissionsData = await permissionsResponse.json();
      grantedPermissions = permissionsData.data
        ?.filter((perm: any) => perm.status === 'granted')
        ?.map((perm: any) => perm.permission) || [];
      
      console.log('🔵 [INSTAGRAM OAUTH] Granted permissions:', grantedPermissions);
      
      // Validate that we have the required permissions for Instagram functionality
      const requiredPermissions = [
        'business_management',
        'pages_show_list',
        'pages_manage_posts'
      ];
      
      const missingPermissions = requiredPermissions.filter(perm => !grantedPermissions.includes(perm));
      if (missingPermissions.length > 0) {
        console.warn('🟡 [INSTAGRAM OAUTH] Missing some required permissions:', missingPermissions);
      }
      
      // Check for Instagram-specific permissions
      const instagramPermissions = grantedPermissions.filter(perm => 
        perm.includes('pages_') || perm === 'business_management' || perm === 'read_insights'
      );
      console.log('🔵 [INSTAGRAM OAUTH] Instagram-relevant permissions:', instagramPermissions);
    } else {
      console.warn('🟡 [INSTAGRAM OAUTH] Could not fetch permissions, continuing anyway');
    }

    // Get workspace ID
    const workspaceId = await getActiveWorkspaceId(session.user.id);
    if (!workspaceId) {
      console.error('🔴 [INSTAGRAM OAUTH] No workspace found for user');
      return NextResponse.redirect(new URL(`${baseUrl}/settings?error=no_workspace`));
    }

    console.log('🔵 [INSTAGRAM OAUTH] Saving Instagram connection to database...');

    // Save Instagram connection to social_accounts table (same as other social integrations)
    const expiresAt = tokenData.expires_in 
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days if no expiry provided

    const { error: socialAccountError } = await supabase
      .from('social_accounts')
        .upsert({
          user_id: session.user.id,
          workspace_id: workspaceId,
        platform: 'instagram',
        access_token: tokenData.access_token,
        account_id: profileData.id,
        account_name: profileData.name || 'Instagram User',
        is_connected: true,
        token_expires_at: expiresAt,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
        onConflict: 'workspace_id,platform,account_id'
        });

    if (socialAccountError) {
      console.error('🔴 [INSTAGRAM OAUTH] Error saving social account:', socialAccountError);
      return NextResponse.redirect(new URL(`${baseUrl}/settings?error=instagram_save_failed`));
    }
    
    console.log('🟢 [INSTAGRAM OAUTH] Instagram account connected successfully!');
    return NextResponse.redirect(new URL(`${baseUrl}/settings?success=instagram_connected`));

  } catch (error) {
    console.error('🔴 [INSTAGRAM OAUTH] Unexpected error:', error);
    return NextResponse.redirect(new URL(`${baseUrl}/settings?error=instagram_unexpected_error`));
  }
} 