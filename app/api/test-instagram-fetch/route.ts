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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Test Instagram] Starting test for user:', session.user.id);

    // Get existing Facebook accounts from social_accounts table
    const { data: facebookAccounts, error: fbError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('platform', 'facebook');

    if (fbError || !facebookAccounts || facebookAccounts.length === 0) {
      return NextResponse.json({ 
        error: 'No Facebook account found',
        details: fbError?.message 
      }, { status: 404 });
    }

    const fbAccount = facebookAccounts[0];
    const accessToken = fbAccount.access_token;
    const appSecret = process.env.FACEBOOK_APP_SECRET!;
    const appsecretProof = crypto.createHmac('sha256', appSecret).update(accessToken).digest('hex');

    console.log('[Test Instagram] Using Facebook token to fetch Instagram accounts');

    // Test the exact same API call as the Instagram Business callback
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,instagram_business_account&access_token=${accessToken}&appsecret_proof=${appsecretProof}`
    );

    console.log('[Test Instagram] Pages response status:', pagesResponse.status);

    if (!pagesResponse.ok) {
      const errorData = await pagesResponse.json();
      console.error('[Test Instagram] Pages API error:', errorData);
      return NextResponse.json({
        error: 'Facebook Pages API error',
        details: errorData,
        status: pagesResponse.status
      }, { status: 400 });
    }

    const pagesData = await pagesResponse.json();
    console.log('[Test Instagram] Pages data:', pagesData);

    const instagramAccounts: any[] = [];
    const pages = pagesData.data || [];

    console.log('[Test Instagram] Found', pages.length, 'Facebook pages');

    for (const page of pages) {
      console.log('[Test Instagram] Page:', page.name, 'has Instagram:', !!page.instagram_business_account);
      
      if (page.instagram_business_account) {
        const igAccountId = page.instagram_business_account.id;
        console.log('[Test Instagram] Found Instagram account:', igAccountId, 'for page:', page.name);

        // Get page access token
        const pageTokenResponse = await fetch(
          `https://graph.facebook.com/v18.0/${page.id}?fields=access_token&access_token=${accessToken}&appsecret_proof=${appsecretProof}`
        );

        let tokenToUse = accessToken;
        let proofToUse = appsecretProof;

        if (pageTokenResponse.ok) {
          const pageTokenData = await pageTokenResponse.json();
          if (pageTokenData.access_token) {
            tokenToUse = pageTokenData.access_token;
            proofToUse = crypto.createHmac('sha256', appSecret).update(tokenToUse).digest('hex');
            console.log('[Test Instagram] Got page access token for:', page.name);
          }
        }

        // Get Instagram account details
        const igDetailsResponse = await fetch(
          `https://graph.facebook.com/v18.0/${igAccountId}?fields=id,username,name,biography,profile_picture_url,followers_count,media_count,website&access_token=${tokenToUse}&appsecret_proof=${proofToUse}`
        );

        console.log('[Test Instagram] Instagram details response:', igDetailsResponse.status);

        if (igDetailsResponse.ok) {
          const igDetails = await igDetailsResponse.json();
          console.log('[Test Instagram] Instagram details:', igDetails);

          instagramAccounts.push({
            id: igAccountId,
            username: igDetails.username,
            name: igDetails.name,
            biography: igDetails.biography,
            profile_picture_url: igDetails.profile_picture_url,
            followers_count: igDetails.followers_count,
            media_count: igDetails.media_count,
            website: igDetails.website,
            connected_facebook_page: {
              id: page.id,
              name: page.name
            }
          });
        } else {
          const errorData = await igDetailsResponse.json();
          console.error('[Test Instagram] Failed to get Instagram details:', errorData);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Found ${instagramAccounts.length} Instagram Business accounts`,
      instagramAccounts,
      pagesChecked: pages.length,
      debug: {
        userId: session.user.id,
        facebookAccountId: fbAccount.id,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[Test Instagram] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 