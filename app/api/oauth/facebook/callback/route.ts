import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getActiveWorkspaceId } from '@/lib/permission';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Facebook OAuth callback
export async function GET(request: NextRequest) {
  console.log('Facebook OAuth callback: Starting...');
  
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    console.error('Facebook OAuth callback: No user session found');
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/login`));
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('Facebook OAuth error:', error);
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=facebook_auth_failed`));
  }

  if (!code) {
    console.error('Facebook OAuth callback: No authorization code received');
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=no_code`));
  }

  try {
    console.log('Facebook OAuth: Exchanging code for access token');
    
    // Use consistent environment variables - prioritize FACEBOOK_* over META_*
    const clientId = process.env.FACEBOOK_APP_ID || process.env.META_CLIENT_ID;
    const clientSecret = process.env.FACEBOOK_APP_SECRET || process.env.META_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/oauth/facebook/callback`;

    if (!clientId || !clientSecret) {
      console.error('Facebook OAuth: Missing client credentials');
      throw new Error('Missing Facebook client credentials');
    }

    console.log('Facebook OAuth: Using credentials - Client ID:', clientId?.substring(0, 8) + '***');

    // Build the token exchange URL
    const tokenUrl = new URL('https://graph.facebook.com/v23.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', clientId);
    tokenUrl.searchParams.set('client_secret', clientSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    console.log('Facebook OAuth: Making token request to Facebook Graph API');
    console.log('Facebook OAuth: Token URL:', tokenUrl.toString().replace(/client_secret=[^&]*/, 'client_secret=***'));

    const tokenResponse = await fetch(tokenUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    console.log('Facebook OAuth: Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Facebook OAuth token error response:', errorText);
      throw new Error(`Facebook token exchange failed: ${tokenResponse.status} - ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Facebook OAuth: Token data received:', {
      has_access_token: !!tokenData.access_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type
    });

    if (!tokenData.access_token) {
      console.error('Facebook OAuth: No access token in response');
      throw new Error('No access token received from Facebook');
    }

    // Get user information from Facebook
    console.log('Facebook OAuth: Fetching user profile from Facebook Graph API');
    
    // Create appsecret_proof for secure API calls
    const crypto = require('crypto');
    const appsecret_proof = crypto
      .createHmac('sha256', clientSecret)
      .update(tokenData.access_token)
      .digest('hex');
    
    const userResponse = await fetch(`https://graph.facebook.com/me?access_token=${tokenData.access_token}&appsecret_proof=${appsecret_proof}&fields=id,name`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!userResponse.ok) {
      const userErrorText = await userResponse.text();
      console.error('Facebook OAuth user profile error response:', userErrorText);
      throw new Error(`Failed to fetch user profile: ${userResponse.status} - ${userErrorText}`);
    }

    const userData = await userResponse.json();
    console.log('Facebook OAuth: User data received:', {
      has_id: !!userData.id,
      has_name: !!userData.name,
      user_id: userData.id
    });

    if (!userData.id) {
      console.error('Facebook OAuth: No user ID in profile response');
      throw new Error('No user ID received from Facebook');
    }

    // Get the workspace ID for this user
    console.log('Facebook OAuth: Getting workspace ID');
    const workspaceId = await getActiveWorkspaceId(session.user.id);
    
    if (!workspaceId) {
      console.error('Facebook OAuth: No active workspace found for user');
      throw new Error('No active workspace found for user');
    }

    // Store the access token in the database
    console.log('Facebook OAuth: Saving connection to database');
    
    // Calculate expiration time (Facebook tokens are typically long-lived)
    const expiresAt = tokenData.expires_in 
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days if no expiry provided
    
    const { error: dbError } = await supabase
      .from('social_accounts')
      .upsert({
        user_id: session.user.id,
        workspace_id: workspaceId,
        platform: 'facebook',
        access_token: tokenData.access_token,
        account_id: userData.id, // Use actual Facebook user ID
        account_name: userData.name || 'Facebook Account',
        is_connected: true,
        token_expires_at: expiresAt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'workspace_id,platform,account_id'
      });

    if (dbError) {
      console.error('Facebook OAuth: Database error:', dbError);
      throw new Error(`Failed to save Facebook connection: ${dbError.message}`);
    }

    // Check what permissions were actually granted
    console.log('Facebook OAuth: Checking granted permissions');
    const permissionsResponse = await fetch(`https://graph.facebook.com/me/permissions?access_token=${tokenData.access_token}&appsecret_proof=${appsecret_proof}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    let grantedPermissions: string[] = ['public_profile', 'email'];
    let hasBusinessPermissions = false;
    
    if (permissionsResponse.ok) {
      const permData = await permissionsResponse.json();
      grantedPermissions = permData.data
        ?.filter((perm: any) => perm.status === 'granted')
        ?.map((perm: any) => perm.permission) || ['public_profile', 'email'];
      
      hasBusinessPermissions = grantedPermissions.some(perm => 
        ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'business_management'].includes(perm)
      );
      
      console.log('Facebook OAuth: Granted permissions:', grantedPermissions);
      console.log('Facebook OAuth: Has business permissions:', hasBusinessPermissions);
    }

    console.log('Facebook OAuth: Connection saved successfully');
    
    // If we have business permissions, also fetch and save Facebook pages
    if (hasBusinessPermissions && grantedPermissions.includes('pages_show_list')) {
      console.log('Facebook OAuth: Fetching Facebook pages');
      
      try {
        // Request pages with access tokens included
        const pagesResponse = await fetch(`https://graph.facebook.com/me/accounts?fields=id,name,access_token,category,perms&access_token=${tokenData.access_token}&appsecret_proof=${appsecret_proof}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (pagesResponse.ok) {
          const pagesData = await pagesResponse.json();
          console.log('Facebook OAuth: Found', pagesData.data?.length || 0, 'pages');
          console.log('Facebook OAuth: Pages data:', JSON.stringify(pagesData.data, null, 2));
          
          if (pagesData.data && pagesData.data.length > 0) {
            // Save each page as a separate social account
            for (const page of pagesData.data) {
              console.log('Facebook OAuth: Processing page:', {
                id: page.id,
                name: page.name,
                has_access_token: !!page.access_token,
                access_token_preview: page.access_token ? page.access_token.substring(0, 20) + '...' : 'None',
                category: page.category,
                perms: page.perms
              });
              const { error: pageError } = await supabase
                .from('social_accounts')
                .upsert({
                  user_id: session.user.id,
                  workspace_id: workspaceId,
                  platform: 'facebook',
                  access_token: page.access_token || tokenData.access_token, // Use page token if available
                  account_id: page.id,
                  account_name: `${page.name} (Page)`,
                  is_connected: true,
                  token_expires_at: expiresAt,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'workspace_id,platform,account_id'
                });

              if (pageError) {
                console.error('Facebook OAuth: Error saving page:', page.name, pageError);
              } else {
                console.log('Facebook OAuth: Saved page:', page.name);
              }
            }
          }
        } else {
          console.error('Facebook OAuth: Failed to fetch pages:', pagesResponse.status);
        }
      } catch (pagesError) {
        console.error('Facebook OAuth: Error fetching pages:', pagesError);
      }
    }
    
    // If we only have basic permissions, offer to upgrade to business permissions
    if (!hasBusinessPermissions) {
      console.log('Facebook OAuth: Only basic permissions granted, offering upgrade');
      return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/social-media?success=facebook_connected&upgrade_needed=true`));
    } else {
      console.log('Facebook OAuth: Business permissions granted, ready for posting');
      return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/social-media?success=facebook_connected&business_ready=true`));
    }
  } catch (error: any) {
    console.error('Facebook OAuth callback error:', error);
    console.error('Facebook OAuth error stack:', error.stack);
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=facebook_auth_failed&details=${encodeURIComponent(error.message || 'Unknown error')}`));
  }
} 