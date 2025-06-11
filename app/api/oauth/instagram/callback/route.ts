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
  console.log('Instagram OAuth callback: Starting...');
  
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    console.error('Instagram OAuth callback: No user session found');
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/login`));
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('Instagram OAuth callback error:', error);
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=instagram_auth_failed`));
  }

  if (!code) {
    console.error('Instagram OAuth callback: No authorization code received');
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=instagram_auth_failed`));
  }

  try {
    console.log('Instagram OAuth: Exchanging code for access token');

    // Get workspace ID
    const workspaceId = await getActiveWorkspaceId(session.user.id);
    if (!workspaceId) {
      console.error('Instagram OAuth: No workspace found for user');
      return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=instagram_auth_failed`));
    }

    // Check environment variables
    if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
      console.error('Instagram OAuth: Missing Facebook app credentials');
      return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=instagram_config_missing`));
    }

    // Get app secret for appsecret_proof
    const appSecret = process.env.META_CLIENT_SECRET || process.env.FACEBOOK_CLIENT_SECRET || process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) {
      console.error('Instagram OAuth: Missing Facebook app secret for appsecret_proof');
      return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=instagram_config_missing`));
    }

    // Exchange authorization code for access token
    // Use Facebook token endpoint since we're going through Facebook OAuth
    const tokenUrl = new URL('https://graph.facebook.com/v23.0/oauth/access_token');
    
    const tokenParams = new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID!,
      client_secret: process.env.META_CLIENT_SECRET || process.env.FACEBOOK_APP_SECRET!,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/oauth/instagram/callback`,
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
      console.error('Instagram OAuth: Token exchange failed:', errorText);
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json();
    console.log('Instagram OAuth: Token data received:', {
      has_access_token: !!tokenData.access_token,
      user_id: tokenData.user_id
    });

    if (!tokenData.access_token) {
      console.error('Instagram OAuth: No access token in response');
      throw new Error('No access token received from Instagram');
    }

    // Generate appsecret_proof for Facebook API calls
    const appsecretProof = crypto.createHmac('sha256', appSecret).update(tokenData.access_token).digest('hex');

    // First get the Facebook pages that have Instagram Business accounts
    console.log('Instagram OAuth: Fetching Facebook pages with Instagram accounts');
    const pagesUrl = new URL('https://graph.facebook.com/v23.0/me/accounts');
    pagesUrl.searchParams.set('fields', 'id,name,instagram_business_account');
    pagesUrl.searchParams.set('access_token', tokenData.access_token);
    pagesUrl.searchParams.set('appsecret_proof', appsecretProof);

    const pagesResponse = await fetch(pagesUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!pagesResponse.ok) {
      const errorData = await pagesResponse.text();
      console.error('Instagram OAuth: Failed to fetch Facebook pages:', errorData);
      throw new Error('Failed to fetch Facebook pages with Instagram accounts');
    }

    const pagesData = await pagesResponse.json();
    console.log('Instagram OAuth: Pages data received:', pagesData);

    // Find pages with Instagram Business accounts
    const pagesWithInstagram = pagesData.data?.filter((page: any) => page.instagram_business_account) || [];
    
    if (pagesWithInstagram.length === 0) {
      console.error('Instagram OAuth: No Instagram Business accounts found connected to Facebook pages');
      return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=no_instagram_business_accounts`));
    }

    // Get user information from Facebook as well
    console.log('Instagram OAuth: Fetching user profile from Facebook Graph API');
    const userUrl = new URL('https://graph.facebook.com/v23.0/me');
    userUrl.searchParams.set('fields', 'id,name');
    userUrl.searchParams.set('access_token', tokenData.access_token);
    userUrl.searchParams.set('appsecret_proof', appsecretProof);

    const userResponse = await fetch(userUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!userResponse.ok) {
      console.error('Instagram OAuth: Failed to fetch user profile');
      throw new Error('Failed to fetch Instagram user profile');
    }

    const userData = await userResponse.json();
    console.log('Instagram OAuth: User data received:', userData);

    // Calculate token expiry
    const expiresAt = new Date();
    if (tokenData.expires_in) {
      expiresAt.setSeconds(expiresAt.getSeconds() + parseInt(tokenData.expires_in));
    } else {
      expiresAt.setDate(expiresAt.getDate() + 60); // Default 60 days
    }

    // Save Instagram Business accounts to database
    console.log('Instagram OAuth: Saving Instagram Business accounts to database');
    
    for (const page of pagesWithInstagram) {
      const instagramBusinessAccount = page.instagram_business_account;
      
      console.log(`Saving Instagram Business account: ${instagramBusinessAccount.id} for page: ${page.name}`);
      
      const { error: dbError } = await supabase
        .from('social_accounts')
        .upsert({
          user_id: session.user.id,
          workspace_id: workspaceId,
          platform: 'instagram',
          access_token: tokenData.access_token, // Use the main access token
          account_id: instagramBusinessAccount.id,
          account_name: `${page.name} (Page)`, // Mark as Instagram page
          is_connected: true,
          token_expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'workspace_id,platform,account_id'
        });

      if (dbError) {
        console.error('Instagram OAuth: Database save failed for Instagram account:', instagramBusinessAccount.id, dbError);
        throw new Error(`Failed to save Instagram connection for ${page.name}`);
      }
    }
    
    console.log(`Instagram OAuth: Successfully saved ${pagesWithInstagram.length} Instagram Business accounts`);

    console.log('Instagram OAuth: Success! Redirecting...');
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?success=instagram_connected`));

  } catch (error) {
    console.error('Instagram OAuth callback error:', error);
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=instagram_auth_failed`));
  }
} 