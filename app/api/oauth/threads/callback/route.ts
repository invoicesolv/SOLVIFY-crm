import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getActiveWorkspaceId } from '@/lib/permission';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Threads OAuth callback
export async function GET(request: NextRequest) {
  console.log('Threads OAuth callback: Starting...');
  
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    console.error('Threads OAuth callback: No user session found');
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/login`));
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('Threads OAuth callback error:', error);
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=threads_auth_failed`));
  }

  if (!code) {
    console.error('Threads OAuth callback: No authorization code received');
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=threads_auth_failed`));
  }

  try {
    console.log('Threads OAuth: Exchanging code for access token');

    // Get workspace ID
    const workspaceId = await getActiveWorkspaceId(session.user.id);
    if (!workspaceId) {
      console.error('Threads OAuth: No workspace found for user');
      return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=threads_auth_failed`));
    }

    // Exchange authorization code for access token (using Facebook token endpoint)
    const tokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    
    const tokenParams = new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID!,
      client_secret: process.env.FACEBOOK_APP_SECRET!,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/oauth/threads/callback`,
      code: code,
    });

    const tokenResponse = await fetch(`${tokenUrl.toString()}?${tokenParams.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Threads OAuth: Token exchange failed:', errorText);
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json();
    console.log('Threads OAuth: Token data received:', {
      has_access_token: !!tokenData.access_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type
    });

    if (!tokenData.access_token) {
      console.error('Threads OAuth: No access token in response');
      throw new Error('No access token received from Threads');
    }

    // Get user information from Facebook Graph API (Threads data comes through Facebook)
    console.log('Threads OAuth: Fetching user profile from Facebook Graph API');
    const userResponse = await fetch(`https://graph.facebook.com/me?fields=id,name&access_token=${tokenData.access_token}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!userResponse.ok) {
      console.error('Threads OAuth: Failed to fetch user profile');
      throw new Error('Failed to fetch Threads user profile');
    }

    const userData = await userResponse.json();
    console.log('Threads OAuth: User data received:', userData);

    // Calculate token expiry
    const expiresAt = new Date();
    if (tokenData.expires_in) {
      expiresAt.setSeconds(expiresAt.getSeconds() + parseInt(tokenData.expires_in));
    } else {
      expiresAt.setDate(expiresAt.getDate() + 60); // Default 60 days
    }

    // Save to database
    console.log('Threads OAuth: Saving to database');
    const { error: dbError } = await supabase
      .from('social_accounts')
      .upsert({
        user_id: session.user.id,
        workspace_id: workspaceId,
        platform: 'threads',
        access_token: tokenData.access_token,
        account_id: userData.id,
        account_name: userData.name || 'Threads Account',
        is_connected: true,
        token_expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'workspace_id,platform,account_id'
      });

    if (dbError) {
      console.error('Threads OAuth: Database save failed:', dbError);
      throw new Error('Failed to save Threads connection');
    }

    console.log('Threads OAuth: Success! Redirecting...');
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?success=threads_connected`));

  } catch (error) {
    console.error('Threads OAuth callback error:', error);
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=threads_auth_failed`));
  }
} 