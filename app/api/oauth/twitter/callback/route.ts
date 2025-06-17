import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  console.log('========== X OAUTH CALLBACK DEBUG START ==========');
  console.log('X OAuth callback: Starting...');
  
  // Use development URL when in development mode
  const baseUrl = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000' 
    : process.env.NEXTAUTH_URL;
    
  console.log('X OAuth callback: Environment:', process.env.NODE_ENV);
  console.log('X OAuth callback: Base URL:', baseUrl);
  
  // Get session using NextAuth JWT token instead of getServerSession
  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET 
  });
  
  console.log('X OAuth callback: Token found:', !!token);
  console.log('X OAuth callback: User ID from token:', token?.sub);
  
  if (!token?.sub) {
    console.error('X OAuth callback: No user token found. User must be logged in first.');
    return NextResponse.redirect(new URL(`${baseUrl}/login?error=oauth_requires_login&message=Please log in first before connecting social media accounts`));
  }
  
  const userId = token.sub;
  console.log('X OAuth callback: Using user ID:', userId);

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  console.log('X OAuth callback: URL parameters:');
  console.log('- code:', code ? 'present' : 'missing');
  console.log('- state:', state ? 'present' : 'missing');
  console.log('- error:', error);
  console.log('- full URL:', request.nextUrl.href);

  if (error) {
    console.error('X OAuth callback: OAuth error from Twitter:', error);
    return NextResponse.redirect(new URL(`${baseUrl}/settings?error=twitter_auth_failed&details=${encodeURIComponent(error)}`));
  }

  if (!code) {
    console.error('X OAuth callback: No authorization code received');
    return NextResponse.redirect(new URL(`${baseUrl}/settings?error=twitter_auth_failed&details=No authorization code received`));
  }

  if (!state) {
    console.error('X OAuth callback: No state parameter received');
    return NextResponse.redirect(new URL(`${baseUrl}/settings?error=twitter_auth_failed&details=No state parameter received`));
  }

  try {
    // Parse state to get code verifier
    let stateData: { codeVerifier?: string; [key: string]: any } = {};
    try {
      if (state) {
        // The state parameter might be URL encoded, so decode it first
        const decodedState = decodeURIComponent(state);
        console.log('X OAuth callback: Decoded state:', decodedState);
        
        // Try to parse as JSON first
        try {
        stateData = JSON.parse(decodedState);
        } catch (jsonError) {
          // If JSON parsing fails, try to extract codeVerifier manually
          console.log('X OAuth callback: JSON parsing failed, trying manual extraction...');
          const codeVerifierMatch = decodedState.match(/codeVerifier:([^}]+)/);
          if (codeVerifierMatch) {
            stateData = { codeVerifier: codeVerifierMatch[1] };
            console.log('X OAuth callback: Extracted codeVerifier manually:', stateData.codeVerifier);
          } else {
            throw new Error('Could not extract codeVerifier from state parameter');
          }
        }
        
        console.log('X OAuth callback: Parsed state data:', stateData);
      }
    } catch (parseError) {
      console.error('X OAuth callback: Failed to parse state parameter:', parseError);
      console.error('X OAuth callback: Raw state:', state);
      throw new Error('Invalid state parameter format');
    }
    
    const codeVerifier = stateData.codeVerifier;
    console.log('X OAuth callback: Code verifier found:', !!codeVerifier);

    if (!codeVerifier) {
      console.error('X OAuth callback: No code verifier found in state');
      throw new Error('Missing code verifier in state parameter');
    }

    // Exchange authorization code for access token
    console.log('X OAuth callback: Exchanging code for token...');
    
    // Check environment variables
    const clientId = process.env.TWITTER_CLIENT_ID;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET;
    
    console.log('X OAuth callback: Environment check:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      clientIdLength: clientId?.length,
      clientSecretLength: clientSecret?.length
    });
    
    if (!clientId || !clientSecret) {
      throw new Error('Missing Twitter OAuth credentials');
    }
    
    // Create Basic auth header - Twitter API v2 requires BOTH auth header AND body params
    const credentials = `${clientId}:${clientSecret}`;
    const encodedCredentials = Buffer.from(credentials).toString('base64');
    console.log('X OAuth callback: Using Twitter API v2 format with both auth header and body params');
    
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${encodedCredentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${baseUrl}/api/oauth/twitter/callback`,
        code_verifier: codeVerifier,
        client_id: clientId,
        client_secret: clientSecret,
        client_type: 'third_party_app',
      }),
    });

    console.log('X OAuth callback: Token response status:', tokenResponse.status);
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('X OAuth callback: Token exchange failed:', errorText);
      throw new Error(`Token exchange failed: ${tokenResponse.status} ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('X OAuth callback: Token data received:', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      scope: tokenData.scope
    });

    // Get user profile from X API
    console.log('X OAuth callback: Fetching user profile...');
    const userResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    console.log('X OAuth callback: User profile response status:', userResponse.status);
    
    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('X OAuth callback: Failed to fetch user profile:', errorText);
      throw new Error(`Failed to fetch user profile: ${userResponse.status} ${errorText}`);
    }

    const userData = await userResponse.json();
    console.log('X OAuth callback: User data received:', {
      id: userData.data?.id,
      username: userData.data?.username,
      name: userData.data?.name
    });

    // Save to Supabase
    console.log('X OAuth callback: Saving to database...');
    
    // Create admin client for database operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log('X OAuth callback: Database save parameters:');
    console.log('- user_id:', userId);
    console.log('- platform:', 'x');
    console.log('- account_id:', userData.data.id);
    console.log('- account_name:', userData.data.username);

    // Get workspace ID for the user using admin client
    console.log('X OAuth callback: Looking up workspace for user:', userId);
    
    // First try to get a workspace where user is admin, then fallback to any workspace
    const { data: workspaceData, error: workspaceError } = await supabase
      .from('team_members')
      .select('workspace_id, is_admin')
      .eq('user_id', userId)
      .order('is_admin', { ascending: false }) // Prioritize admin workspaces
      .order('created_at', { ascending: false }) // Then most recent
      .limit(1)
      .single();

    if (workspaceError) {
      console.error('X OAuth callback: Workspace lookup error:', workspaceError);
      throw new Error(`Failed to find workspace for user: ${workspaceError.message}`);
    }

    const workspaceId = workspaceData?.workspace_id;
    console.log('X OAuth callback: Workspace ID found:', workspaceId, '(admin:', workspaceData?.is_admin, ')');

    if (!workspaceId) {
      console.error('X OAuth callback: No workspace found for user:', userId);
      throw new Error('User is not a member of any workspace');
    }

    const { data, error: dbError } = await supabase
      .from('social_accounts')
      .upsert({
        user_id: userId,
        workspace_id: workspaceId,
        platform: 'x', // Changed from 'twitter' to 'x' to match frontend
        account_id: userData.data.id,
        account_name: userData.data.username,
        display_name: userData.data.name,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        is_connected: true,
      }, {
        onConflict: 'workspace_id,platform,account_id'
      });

    if (dbError) {
      console.error('X OAuth callback: Database save error:', dbError);
      throw new Error(`Database save failed: ${dbError.message}`);
    }

    console.log('X OAuth callback: Database save successful');
    console.log('X OAuth callback: Saved data:', data);
    
    console.log('========== X OAUTH CALLBACK DEBUG END ==========');
    return NextResponse.redirect(new URL(`${baseUrl}/settings?success=twitter_connected`));

  } catch (error) {
    console.error('========== X OAUTH CALLBACK ERROR ==========');
    console.error('X OAuth callback error:', error);
    console.error('X OAuth callback error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('========== X OAUTH CALLBACK ERROR END ==========');
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.redirect(new URL(`${baseUrl}/settings?error=twitter_auth_failed&details=${encodeURIComponent(errorMessage)}`));
  }
} 