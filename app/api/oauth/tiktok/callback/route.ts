import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// TikTok OAuth callback
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    console.error('TikTok OAuth callback: No user session found');
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/login`));
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    console.error('TikTok OAuth error:', error);
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=tiktok_auth_failed`));
  }

  if (!code) {
    console.error('TikTok OAuth callback: No authorization code received');
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=no_code`));
  }

  try {
    console.log('TikTok OAuth: Exchanging code for access token');
    
    // Parse state to get code verifier
    let codeVerifier = '';
    if (state) {
      try {
        const stateData = JSON.parse(state);
        codeVerifier = stateData.codeVerifier;
      } catch (e) {
        console.error('TikTok OAuth: Failed to parse state:', e);
      }
    }
    
    // Exchange code for access token
    const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/oauth/tiktok/callback`,
        code_verifier: codeVerifier,
      }),
    });

    const tokenData = await tokenResponse.json();
    console.log('TikTok OAuth: Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      console.error('TikTok OAuth token error:', tokenData);
      throw new Error(tokenData.error_description || 'Failed to exchange code for token');
    }

    console.log('TikTok OAuth: Successfully received access token');

    // Fetch user profile information
    const profileResponse = await fetch('https://open.tiktokapis.com/v2/user/info/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: ['open_id', 'union_id', 'avatar_url', 'display_name', 'username']
      }),
    });

    const profileData = await profileResponse.json();
    console.log('TikTok OAuth: Profile response status:', profileResponse.status);

    if (!profileResponse.ok) {
      console.error('TikTok OAuth profile error:', profileData);
      throw new Error('Failed to fetch user profile');
    }

    const userData = profileData.data?.user;
    console.log('TikTok OAuth: User profile data:', {
      open_id: userData?.open_id,
      display_name: userData?.display_name,
      username: userData?.username
    });

    // Get workspace ID for the user
    console.log('TikTok OAuth: Looking up workspace for user:', session.user.id);
    
    // Create admin client for database operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get workspace ID for the user (use same logic as other OAuth flows)
    const { data: allWorkspaces, error: workspaceError } = await supabase
      .from('team_members')
      .select('workspace_id, role')
      .eq('user_id', session.user.id)
      .order('role', { ascending: true }) // admin comes before member
      .order('created_at', { ascending: false }); // most recent first

    if (workspaceError) {
      console.error('TikTok OAuth: Workspace lookup error:', workspaceError);
      throw new Error(`Failed to find workspace for user: ${workspaceError.message}`);
    }

    if (!allWorkspaces || allWorkspaces.length === 0) {
      console.error('TikTok OAuth: No workspace found for user:', session.user.id);
      throw new Error('User is not a member of any workspace');
    }

    // Use the first workspace (prioritized by admin role, then most recent)
    const workspaceData = allWorkspaces[0];
    const workspaceId = workspaceData?.workspace_id;
    console.log('TikTok OAuth: Workspace ID found:', workspaceId, '(admin:', workspaceData?.role === 'admin', ')');

    // Save TikTok connection to database
    const { data: saveData, error: saveError } = await supabase
      .from('social_accounts')
      .upsert({
        user_id: session.user.id,
        workspace_id: workspaceId,
        platform: 'tiktok',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        account_id: userData?.open_id,
        account_name: userData?.display_name || userData?.username,
        display_name: userData?.display_name,
        is_connected: true,
        token_expires_at: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'workspace_id,platform,account_id'
      })
      .select();

    if (saveError) {
      console.error('TikTok OAuth: Database save error:', saveError);
      throw new Error(`Failed to save TikTok connection: ${saveError.message}`);
    }

    console.log('TikTok OAuth: Database save successful');
    console.log('TikTok OAuth: Saved data:', saveData);
    
    console.log('TikTok OAuth: Redirecting to settings with success');
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?success=tiktok_connected`));
  } catch (error) {
    console.error('TikTok OAuth callback error:', error);
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=tiktok_auth_failed`));
  }
} 