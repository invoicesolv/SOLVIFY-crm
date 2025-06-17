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

    console.log('[Instagram Direct Test] Testing direct Instagram Graph API endpoints');

    // Get Facebook account
    const { data: facebookAccounts, error: fbError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('platform', 'facebook');

    if (fbError || !facebookAccounts || facebookAccounts.length === 0) {
      return NextResponse.json({ 
        error: 'No Facebook account found',
        message: 'Please connect your Facebook account first'
      }, { status: 404 });
    }

    const fbAccount = facebookAccounts[0];
    const userAccessToken = fbAccount.access_token;
    const appSecret = process.env.FACEBOOK_APP_SECRET!;

    // Generate appsecret_proof for user token
    const userAppsecretProof = crypto.createHmac('sha256', appSecret).update(userAccessToken).digest('hex');

    const results = {
      success: true,
      message: 'Instagram direct endpoint test completed',
      tests: [] as any[],
      debug: {
        userId: session.user.id,
        timestamp: new Date().toISOString(),
        instagramAccountId: '17841453579286758' // From your Meta Business Suite
      }
    };

    // Test 1: Direct Instagram account endpoint
    const instagramAccountId = '17841453579286758';
    
    try {
      console.log('[Instagram Direct Test] Testing direct Instagram account endpoint...');
      
      const instagramUrl = `https://graph.facebook.com/v23.0/${instagramAccountId}?fields=id,username,name,followers_count,media_count,profile_picture_url,biography&access_token=${userAccessToken}&appsecret_proof=${userAppsecretProof}`;
      
      const instagramResponse = await fetch(instagramUrl);
      const instagramData = await instagramResponse.json();

      results.tests.push({
        test: 'Direct Instagram Account Access',
        endpoint: `/${instagramAccountId}`,
        status: instagramResponse.status,
        success: instagramResponse.ok,
        data: instagramData,
        url: instagramUrl.replace(userAccessToken, 'ACCESS_TOKEN').replace(userAppsecretProof, 'APPSECRET_PROOF')
      });

      if (instagramResponse.ok && instagramData.username) {
        console.log('[Instagram Direct Test] 🎉 SUCCESS! Direct Instagram access worked:', instagramData);
      } else {
        console.log('[Instagram Direct Test] ❌ Direct Instagram access failed:', instagramData);
      }
    } catch (error) {
      results.tests.push({
        test: 'Direct Instagram Account Access',
        endpoint: `/${instagramAccountId}`,
        status: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Test 2: Instagram media endpoint
    try {
      console.log('[Instagram Direct Test] Testing Instagram media endpoint...');
      
      const mediaUrl = `https://graph.facebook.com/v23.0/${instagramAccountId}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp&access_token=${userAccessToken}&appsecret_proof=${userAppsecretProof}`;
      
      const mediaResponse = await fetch(mediaUrl);
      const mediaData = await mediaResponse.json();

      results.tests.push({
        test: 'Instagram Media Access',
        endpoint: `/${instagramAccountId}/media`,
        status: mediaResponse.status,
        success: mediaResponse.ok,
        data: mediaData,
        url: mediaUrl.replace(userAccessToken, 'ACCESS_TOKEN').replace(userAppsecretProof, 'APPSECRET_PROOF')
      });
    } catch (error) {
      results.tests.push({
        test: 'Instagram Media Access',
        endpoint: `/${instagramAccountId}/media`,
        status: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Test 3: Instagram insights endpoint
    try {
      console.log('[Instagram Direct Test] Testing Instagram insights endpoint...');
      
      const insightsUrl = `https://graph.facebook.com/v23.0/${instagramAccountId}/insights?metric=impressions,reach,profile_views&period=day&access_token=${userAccessToken}&appsecret_proof=${userAppsecretProof}`;
      
      const insightsResponse = await fetch(insightsUrl);
      const insightsData = await insightsResponse.json();

      results.tests.push({
        test: 'Instagram Insights Access',
        endpoint: `/${instagramAccountId}/insights`,
        status: insightsResponse.status,
        success: insightsResponse.ok,
        data: insightsData,
        url: insightsUrl.replace(userAccessToken, 'ACCESS_TOKEN').replace(userAppsecretProof, 'APPSECRET_PROOF')
      });
    } catch (error) {
      results.tests.push({
        test: 'Instagram Insights Access',
        endpoint: `/${instagramAccountId}/insights`,
        status: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Test 4: Try with page token instead
    try {
      console.log('[Instagram Direct Test] Getting fresh page token for Instagram test...');
      
      const pagesUrl = `https://graph.facebook.com/v23.0/me/accounts?fields=id,name,access_token&access_token=${userAccessToken}&appsecret_proof=${userAppsecretProof}`;
      const pagesResponse = await fetch(pagesUrl);
      const pagesData = await pagesResponse.json();

      if (pagesResponse.ok && pagesData.data) {
        const solvifyPage = pagesData.data.find((page: any) => page.id === '109400455228964');
        if (solvifyPage) {
          const pageToken = solvifyPage.access_token;
          const pageAppsecretProof = crypto.createHmac('sha256', appSecret).update(pageToken).digest('hex');

          console.log('[Instagram Direct Test] Testing Instagram with page token...');
          
          const pageInstagramUrl = `https://graph.facebook.com/v23.0/${instagramAccountId}?fields=id,username,name,followers_count,media_count,profile_picture_url,biography&access_token=${pageToken}&appsecret_proof=${pageAppsecretProof}`;
          
          const pageInstagramResponse = await fetch(pageInstagramUrl);
          const pageInstagramData = await pageInstagramResponse.json();

          results.tests.push({
            test: 'Instagram Access with Page Token',
            endpoint: `/${instagramAccountId} (with page token)`,
            status: pageInstagramResponse.status,
            success: pageInstagramResponse.ok,
            data: pageInstagramData,
            url: pageInstagramUrl.replace(pageToken, 'PAGE_ACCESS_TOKEN').replace(pageAppsecretProof, 'PAGE_APPSECRET_PROOF')
          });
        }
      }
    } catch (error) {
      results.tests.push({
        test: 'Instagram Access with Page Token',
        endpoint: `/${instagramAccountId} (with page token)`,
        status: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Test 5: Try alternative Instagram endpoints
    const alternativeEndpoints = [
      `https://graph.instagram.com/v23.0/${instagramAccountId}`,
      `https://graph.facebook.com/v23.0/instagram_oembed`,
      `https://graph.facebook.com/v23.0/me/instagram_accounts`
    ];

    for (const endpoint of alternativeEndpoints) {
      try {
        console.log(`[Instagram Direct Test] Testing alternative endpoint: ${endpoint}`);
        
        const testUrl = `${endpoint}?access_token=${userAccessToken}&appsecret_proof=${userAppsecretProof}`;
        const testResponse = await fetch(testUrl);
        const testData = await testResponse.json();

        results.tests.push({
          test: `Alternative Endpoint: ${endpoint}`,
          endpoint: endpoint,
          status: testResponse.status,
          success: testResponse.ok,
          data: testData,
          url: testUrl.replace(userAccessToken, 'ACCESS_TOKEN').replace(userAppsecretProof, 'APPSECRET_PROOF')
        });
      } catch (error) {
        results.tests.push({
          test: `Alternative Endpoint: ${endpoint}`,
          endpoint: endpoint,
          status: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    console.log('[Instagram Direct Test] Test completed:', {
      testsRun: results.tests.length,
      successfulTests: results.tests.filter(t => t.success).length
    });

    return NextResponse.json(results);

  } catch (error) {
    console.error('[Instagram Direct Test] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to perform Instagram direct endpoint test',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 