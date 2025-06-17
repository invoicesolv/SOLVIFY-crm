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

    console.log('[Fresh Page Token Test] Getting fresh page token and testing Instagram connection');

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
      message: 'Fresh page token test completed',
      steps: [] as string[],
      tests: [] as any[],
      debug: {
        userId: session.user.id,
        timestamp: new Date().toISOString()
      }
    };

    // Step 1: Get fresh page tokens
    results.steps.push('Getting fresh page tokens with user access token...');
    
    let solvifyPageToken = '';
    let solvifyPageId = '109400455228964';

    try {
      console.log('[Fresh Page Token Test] Getting fresh page tokens...');
      
      const pagesUrl = `https://graph.facebook.com/v23.0/me/accounts?fields=id,name,access_token&access_token=${userAccessToken}&appsecret_proof=${userAppsecretProof}`;
      
      const pagesResponse = await fetch(pagesUrl);
      const pagesData = await pagesResponse.json();

      results.tests.push({
        test: 'Get Fresh Page Tokens',
        status: pagesResponse.status,
        success: pagesResponse.ok,
        data: pagesData,
        url: pagesUrl.replace(userAccessToken, 'USER_ACCESS_TOKEN').replace(userAppsecretProof, 'USER_APPSECRET_PROOF')
      });

      if (pagesResponse.ok && pagesData.data) {
        const solvifyPage = pagesData.data.find((page: any) => page.id === solvifyPageId);
        if (solvifyPage) {
          solvifyPageToken = solvifyPage.access_token;
          results.steps.push(`✅ Found Solvify AB page token: ${solvifyPageToken.substring(0, 20)}...`);
          console.log('[Fresh Page Token Test] Got fresh Solvify AB page token');
        } else {
          results.steps.push('❌ Solvify AB page not found in pages list');
          return NextResponse.json({
            ...results,
            success: false,
            error: 'Solvify AB page not found'
          });
        }
      } else {
        results.steps.push('❌ Failed to get page tokens');
        return NextResponse.json({
          ...results,
          success: false,
          error: 'Failed to get page tokens'
        });
      }
    } catch (error) {
      results.tests.push({
        test: 'Get Fresh Page Tokens',
        status: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      return NextResponse.json({
        ...results,
        success: false,
        error: 'Failed to get fresh page tokens'
      });
    }

    // Step 2: Use fresh page token to test Instagram connection
    results.steps.push('Testing Instagram connection with fresh page token...');
    
    // Generate appsecret_proof for page token
    const pageAppsecretProof = crypto.createHmac('sha256', appSecret).update(solvifyPageToken).digest('hex');

    // Test 1: Use fresh page token to get Instagram account
    try {
      console.log('[Fresh Page Token Test] Testing with fresh page token for Instagram account...');
      
      const pageUrl = `https://graph.facebook.com/v23.0/${solvifyPageId}?fields=id,name,instagram_business_account{id,username,name,followers_count,media_count,profile_picture_url,biography,website}&access_token=${solvifyPageToken}&appsecret_proof=${pageAppsecretProof}`;
      
      const pageResponse = await fetch(pageUrl);
      const pageData = await pageResponse.json();

      results.tests.push({
        test: 'Fresh Page Token - Instagram Business Account',
        status: pageResponse.status,
        success: pageResponse.ok,
        data: pageData,
        hasInstagramAccount: !!pageData.instagram_business_account,
        instagramData: pageData.instagram_business_account || null,
        url: pageUrl.replace(solvifyPageToken, 'FRESH_PAGE_ACCESS_TOKEN').replace(pageAppsecretProof, 'PAGE_APPSECRET_PROOF')
      });

      if (pageData.instagram_business_account) {
        results.steps.push('🎉 SUCCESS! Instagram account found with fresh page token!');
        console.log('[Fresh Page Token Test] 🎉 SUCCESS! Instagram account found:', pageData.instagram_business_account);
      } else {
        results.steps.push('❌ Still no Instagram account found with fresh page token');
        console.log('[Fresh Page Token Test] ❌ Still no Instagram account found with fresh page token');
      }
    } catch (error) {
      results.tests.push({
        test: 'Fresh Page Token - Instagram Business Account',
        status: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      results.steps.push('❌ Error testing Instagram with fresh page token');
    }

    // Test 2: Try different Instagram field variations with fresh page token
    const fieldTests = [
      'instagram_business_account',
      'instagram_business_account{id,username,name}',
      'instagram_business_account{id,username,name,followers_count,media_count}',
      'connected_instagram_account'
    ];

    for (const fields of fieldTests) {
      try {
        console.log(`[Fresh Page Token Test] Testing fresh page token with fields: ${fields}`);
        
        const testUrl = `https://graph.facebook.com/v23.0/${solvifyPageId}?fields=id,name,${fields}&access_token=${solvifyPageToken}&appsecret_proof=${pageAppsecretProof}`;
        
        const testResponse = await fetch(testUrl);
        const testData = await testResponse.json();

        results.tests.push({
          test: `Fresh Page Token Field Test: ${fields}`,
          status: testResponse.status,
          success: testResponse.ok,
          data: testData,
          hasInstagramData: !!(testData.instagram_business_account || testData.connected_instagram_account),
          instagramData: testData.instagram_business_account || testData.connected_instagram_account || null,
          url: testUrl.replace(solvifyPageToken, 'FRESH_PAGE_ACCESS_TOKEN').replace(pageAppsecretProof, 'PAGE_APPSECRET_PROOF')
        });
      } catch (error) {
        results.tests.push({
          test: `Fresh Page Token Field Test: ${fields}`,
          status: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Test 3: Check what the fresh page token can access
    try {
      console.log('[Fresh Page Token Test] Checking fresh page token capabilities...');
      
      const capUrl = `https://graph.facebook.com/v23.0/${solvifyPageId}?fields=id,name,category,about,website,phone,emails,location,hours,fan_count,access_token&access_token=${solvifyPageToken}&appsecret_proof=${pageAppsecretProof}`;
      
      const capResponse = await fetch(capUrl);
      const capData = await capResponse.json();

      results.tests.push({
        test: 'Fresh Page Token Capabilities',
        status: capResponse.status,
        success: capResponse.ok,
        data: capData,
        url: capUrl.replace(solvifyPageToken, 'FRESH_PAGE_ACCESS_TOKEN').replace(pageAppsecretProof, 'PAGE_APPSECRET_PROOF')
      });
    } catch (error) {
      results.tests.push({
        test: 'Fresh Page Token Capabilities',
        status: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    results.steps.push('✅ Fresh page token test completed');
    
    console.log('[Fresh Page Token Test] Test completed:', {
      testsRun: results.tests.length,
      instagramFound: results.tests.some(t => t.hasInstagramAccount || t.hasInstagramData)
    });

    return NextResponse.json(results);

  } catch (error) {
    console.error('[Fresh Page Token Test] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to perform fresh page token test',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 