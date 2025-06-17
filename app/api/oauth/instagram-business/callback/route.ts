import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    if (error) {
      console.error('Instagram Business OAuth error:', error);
      return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(error)}`, request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/settings?error=no_code', request.url));
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.FACEBOOK_APP_ID!,
        client_secret: process.env.FACEBOOK_APP_SECRET!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/oauth/instagram-business/callback`,
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || tokenData.error) {
      console.error('Token exchange error:', tokenData);
      return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(tokenData.error?.message || 'token_exchange_failed')}`, request.url));
    }

    const accessToken = tokenData.access_token;

    // Generate appsecret_proof for secure API calls
    const appSecret = process.env.FACEBOOK_APP_SECRET!;
    const appsecretProof = crypto.createHmac('sha256', appSecret).update(accessToken).digest('hex');

    // Get user's personal Facebook account info with appsecret_proof
    const userResponse = await fetch(
      `https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${accessToken}&appsecret_proof=${appsecretProof}`
    );
    
    const userData = await userResponse.json();

    if (!userResponse.ok) {
      console.error('Failed to fetch user info:', userData);
      return NextResponse.redirect(new URL('/settings?error=user_info_failed', request.url));
    }

    // Get Instagram Business accounts through personal account
    const instagramAccounts: any[] = [];
    
    console.log('[Instagram Business] Starting Instagram account discovery for user:', userData.id, userData.name);
    
    // Method 1: Check Facebook pages for connected Instagram Business accounts
    console.log('[Instagram Business] Method 1: Checking Facebook pages for Instagram connections');
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,instagram_business_account&access_token=${accessToken}&appsecret_proof=${appsecretProof}`
    );
    
    console.log('[Instagram Business] Pages response status:', pagesResponse.status, pagesResponse.ok);
    
    if (pagesResponse.ok) {
      const pagesData = await pagesResponse.json();
      const pages = pagesData.data || [];
      
      console.log('[Instagram Business] Found', pages.length, 'Facebook pages');
      console.log('[Instagram Business] Pages data:', pages.map(p => ({ 
        id: p.id, 
        name: p.name, 
        has_instagram: !!p.instagram_business_account 
      })));
      
      for (const page of pages) {
        if (page.instagram_business_account) {
          console.log('[Instagram Business] Processing Instagram account for page:', page.name);
          const igAccountId = page.instagram_business_account.id;
          
          try {
            // Get page access token for better permissions
            const pageTokenResponse = await fetch(
              `https://graph.facebook.com/v18.0/${page.id}?fields=access_token&access_token=${accessToken}&appsecret_proof=${appsecretProof}`
            );
            
            let tokenToUse = accessToken;
            let proofToUse = appsecretProof;
            
            if (pageTokenResponse.ok) {
              const pageTokenData = await pageTokenResponse.json();
              if (pageTokenData.access_token) {
                tokenToUse = pageTokenData.access_token;
                // Generate new proof for page token
                proofToUse = crypto.createHmac('sha256', appSecret).update(tokenToUse).digest('hex');
                console.log('[Instagram Business] Got page access token for:', page.name);
              }
            }
            
            // Get Instagram account details
            console.log('[Instagram Business] Fetching Instagram details for account:', igAccountId);
            const igDetailsResponse = await fetch(
              `https://graph.facebook.com/v18.0/${igAccountId}?fields=id,username,name,biography,profile_picture_url,followers_count,media_count,website&access_token=${tokenToUse}&appsecret_proof=${proofToUse}`
            );
            
            console.log('[Instagram Business] Instagram details response:', igDetailsResponse.status, igDetailsResponse.ok);
            
            if (igDetailsResponse.ok) {
              const igDetails = await igDetailsResponse.json();
              console.log('[Instagram Business] Instagram account details:', {
                id: igDetails.id,
                username: igDetails.username,
                name: igDetails.name,
                followers: igDetails.followers_count
              });
              
              instagramAccounts.push({
                id: igAccountId,
                username: igDetails.username,
                name: igDetails.name,
                biography: igDetails.biography,
                profile_picture_url: igDetails.profile_picture_url,
                followers_count: igDetails.followers_count,
                media_count: igDetails.media_count,
                website: igDetails.website,
                access_token: tokenToUse,
                connected_facebook_page: {
                  id: page.id,
                  name: page.name
                }
              });
            } else {
              const errorData = await igDetailsResponse.json();
              console.error('[Instagram Business] Failed to get Instagram details:', errorData);
            }
          } catch (error) {
            console.error(`[Instagram Business] Error processing Instagram account ${igAccountId}:`, error);
          }
        }
      }
    } else {
      const pagesError = await pagesResponse.json();
      console.error('[Instagram Business] Failed to fetch pages:', pagesError);
    }

    // Method 2: Try direct Instagram accounts if no accounts found via pages
    if (instagramAccounts.length === 0) {
      console.log('[Instagram Business] Method 2: Trying direct Instagram accounts endpoint');
      try {
        const userInstagramResponse = await fetch(
          `https://graph.facebook.com/v18.0/${userData.id}/instagram_accounts?access_token=${accessToken}&appsecret_proof=${appsecretProof}`
        );
        
        console.log('[Instagram Business] Direct Instagram response:', userInstagramResponse.status, userInstagramResponse.ok);
        
        if (userInstagramResponse.ok) {
          const userInstagramData = await userInstagramResponse.json();
          console.log('[Instagram Business] Direct Instagram data:', userInstagramData);
          
          if (userInstagramData.data) {
            console.log('[Instagram Business] Found', userInstagramData.data.length, 'direct Instagram accounts');
            
            for (const igAccount of userInstagramData.data) {
              console.log('[Instagram Business] Processing direct Instagram account:', igAccount.id);
              const igDetailsResponse = await fetch(
                `https://graph.facebook.com/v18.0/${igAccount.id}?fields=id,username,name,biography,profile_picture_url,followers_count,media_count,website&access_token=${accessToken}&appsecret_proof=${appsecretProof}`
              );
              
              if (igDetailsResponse.ok) {
                const igDetails = await igDetailsResponse.json();
                console.log('[Instagram Business] Direct Instagram details:', {
                  id: igDetails.id,
                  username: igDetails.username,
                  name: igDetails.name
                });
                
                instagramAccounts.push({
                  id: igAccount.id,
                  username: igDetails.username,
                  name: igDetails.name,
                  biography: igDetails.biography,
                  profile_picture_url: igDetails.profile_picture_url,
                  followers_count: igDetails.followers_count,
                  media_count: igDetails.media_count,
                  website: igDetails.website,
                  access_token: accessToken,
                  connected_facebook_page: null
                });
              } else {
                const errorData = await igDetailsResponse.json();
                console.error('[Instagram Business] Failed to get direct Instagram details:', errorData);
              }
            }
          }
        } else {
          const directError = await userInstagramResponse.json();
          console.error('[Instagram Business] Direct Instagram endpoint failed:', directError);
        }
      } catch (error) {
        console.error('[Instagram Business] Error trying direct Instagram accounts:', error);
      }
    }

    console.log('[Instagram Business] Final result: Found', instagramAccounts.length, 'Instagram Business accounts');

    if (instagramAccounts.length === 0) {
      console.log('[Instagram Business] No Instagram accounts found, redirecting with error');
      return NextResponse.redirect(new URL('/settings?error=no_instagram_accounts', request.url));
    }

    // Save Instagram Business integration
    const now = new Date();
    const expiresAt = tokenData.expires_in 
      ? new Date(now.getTime() + tokenData.expires_in * 1000)
      : new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days default

    const { error: integrationError } = await supabase
      .from('integrations')
      .upsert({
        user_id: session.user.id,
        service_name: 'instagram-business',
        access_token: accessToken,
        refresh_token: null,
        expires_at: expiresAt.toISOString(),
        scopes: ['business_management', 'pages_show_list', 'pages_read_engagement'],
        metadata: {
          facebook_user_id: userData.id,
          facebook_user_name: userData.name,
          instagram_accounts: instagramAccounts.map(account => ({
            id: account.id,
            username: account.username,
            name: account.name,
            followers_count: account.followers_count,
            connected_facebook_page: account.connected_facebook_page
          }))
        },
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      }, {
        onConflict: 'user_id,service_name'
      });

    if (integrationError) {
      console.error('Error saving Instagram Business integration:', integrationError);
      return NextResponse.redirect(new URL('/settings?error=save_failed', request.url));
    }

    return NextResponse.redirect(new URL('/settings?success=instagram_connected', request.url));

  } catch (error) {
    console.error('Instagram Business callback error:', error);
    return NextResponse.redirect(new URL('/settings?error=callback_failed', request.url));
  }
} 