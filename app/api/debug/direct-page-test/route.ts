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

    console.log('[Direct Page Test] Testing Solvify AB page directly for Instagram connection');

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
    const accessToken = fbAccount.access_token;
    const appSecret = process.env.FACEBOOK_APP_SECRET!;

    // Generate appsecret_proof
    const appsecretProof = crypto.createHmac('sha256', appSecret).update(accessToken).digest('hex');

    const results = {
      success: true,
      message: 'Direct page test completed',
      tests: [] as any[],
      debug: {
        userId: session.user.id,
        timestamp: new Date().toISOString()
      }
    };

    // Test 1: Direct call to Solvify AB page with Instagram fields
    const solvifyPageId = '109400455228964';
    
    try {
      console.log('[Direct Page Test] Testing Solvify AB page directly...');
      
      const pageUrl = `https://graph.facebook.com/v23.0/${solvifyPageId}?fields=id,name,instagram_business_account{id,username,name,followers_count,media_count,profile_picture_url,biography,website}&access_token=${accessToken}&appsecret_proof=${appsecretProof}`;
      
      const pageResponse = await fetch(pageUrl);
      const pageData = await pageResponse.json();

      results.tests.push({
        test: 'Solvify AB Direct Page Test',
        status: pageResponse.status,
        success: pageResponse.ok,
        data: pageData,
        hasInstagramAccount: !!pageData.instagram_business_account,
        url: pageUrl.replace(accessToken, 'ACCESS_TOKEN').replace(appsecretProof, 'APPSECRET_PROOF')
      });

      if (pageData.instagram_business_account) {
        console.log('[Direct Page Test] ✅ Instagram account found!', pageData.instagram_business_account);
      } else {
        console.log('[Direct Page Test] ❌ No Instagram account found on Solvify AB page');
      }
    } catch (error) {
      results.tests.push({
        test: 'Solvify AB Direct Page Test',
        status: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Test 2: Try with different field combinations
    const fieldTests = [
      'instagram_business_account',
      'instagram_business_account{id,username}',
      'instagram_business_account{id,username,name,followers_count}',
      'connected_instagram_account',
      'instagram_accounts'
    ];

    for (const fields of fieldTests) {
      try {
        console.log(`[Direct Page Test] Testing with fields: ${fields}`);
        
        const testUrl = `https://graph.facebook.com/v23.0/${solvifyPageId}?fields=id,name,${fields}&access_token=${accessToken}&appsecret_proof=${appsecretProof}`;
        
        const testResponse = await fetch(testUrl);
        const testData = await testResponse.json();

        results.tests.push({
          test: `Field Test: ${fields}`,
          status: testResponse.status,
          success: testResponse.ok,
          data: testData,
          hasInstagramData: !!(testData.instagram_business_account || testData.connected_instagram_account || testData.instagram_accounts),
          url: testUrl.replace(accessToken, 'ACCESS_TOKEN').replace(appsecretProof, 'APPSECRET_PROOF')
        });
      } catch (error) {
        results.tests.push({
          test: `Field Test: ${fields}`,
          status: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Test 3: Check page permissions
    try {
      console.log('[Direct Page Test] Checking page permissions...');
      
      const permUrl = `https://graph.facebook.com/v23.0/${solvifyPageId}/permissions?access_token=${accessToken}&appsecret_proof=${appsecretProof}`;
      
      const permResponse = await fetch(permUrl);
      const permData = await permResponse.json();

      results.tests.push({
        test: 'Page Permissions',
        status: permResponse.status,
        success: permResponse.ok,
        data: permData,
        url: permUrl.replace(accessToken, 'ACCESS_TOKEN').replace(appsecretProof, 'APPSECRET_PROOF')
      });
    } catch (error) {
      results.tests.push({
        test: 'Page Permissions',
        status: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    console.log('[Direct Page Test] Test completed:', {
      testsRun: results.tests.length,
      instagramFound: results.tests.some(t => t.hasInstagramAccount || t.hasInstagramData)
    });

    return NextResponse.json(results);

  } catch (error) {
    console.error('[Direct Page Test] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to perform direct page test',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 