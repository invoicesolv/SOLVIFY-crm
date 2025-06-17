import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Page Token Test] Testing with Solvify AB page token directly');

    const appSecret = process.env.FACEBOOK_APP_SECRET!;
    
    // This is the Solvify AB page token from the previous API response
    const solvifyPageToken = 'EAAULWgn22D0BO61PQebiQamkC2Mmi4Ubmrn7FYtryeywuZAdd4CPbYl7OOIzGq2TAt6rAVjvn3CEhP4OxjZADFXOivTxiPPYCXkYYg3tyu7QXgmSmvqsK9piBYYd3iMa78zijFPUQGXH0dwzubekz6wZB4FrbwxX7ugHTCpJuCKrLjys2DmDMbcGGIZBtS0he3Ht';
    const solvifyPageId = '109400455228964';

    // Generate appsecret_proof for page token
    const appsecretProof = crypto.createHmac('sha256', appSecret).update(solvifyPageToken).digest('hex');

    const results = {
      success: true,
      message: 'Page token test completed',
      tests: [] as any[],
      debug: {
        userId: session.user.id,
        pageId: solvifyPageId,
        timestamp: new Date().toISOString()
      }
    };

    // Test 1: Use page token to get Instagram account
    try {
      console.log('[Page Token Test] Testing with page token for Instagram account...');
      
      const pageUrl = `https://graph.facebook.com/v23.0/${solvifyPageId}?fields=id,name,instagram_business_account{id,username,name,followers_count,media_count,profile_picture_url,biography,website}&access_token=${solvifyPageToken}&appsecret_proof=${appsecretProof}`;
      
      const pageResponse = await fetch(pageUrl);
      const pageData = await pageResponse.json();

      results.tests.push({
        test: 'Page Token - Instagram Business Account',
        status: pageResponse.status,
        success: pageResponse.ok,
        data: pageData,
        hasInstagramAccount: !!pageData.instagram_business_account,
        instagramData: pageData.instagram_business_account || null,
        url: pageUrl.replace(solvifyPageToken, 'PAGE_ACCESS_TOKEN').replace(appsecretProof, 'APPSECRET_PROOF')
      });

      if (pageData.instagram_business_account) {
        console.log('[Page Token Test] 🎉 SUCCESS! Instagram account found:', pageData.instagram_business_account);
      } else {
        console.log('[Page Token Test] ❌ Still no Instagram account found with page token');
      }
    } catch (error) {
      results.tests.push({
        test: 'Page Token - Instagram Business Account',
        status: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Test 2: Try different Instagram field variations with page token
    const fieldTests = [
      'instagram_business_account',
      'instagram_business_account{id,username,name}',
      'instagram_business_account{id,username,name,followers_count,media_count}',
      'connected_instagram_account'
    ];

    for (const fields of fieldTests) {
      try {
        console.log(`[Page Token Test] Testing page token with fields: ${fields}`);
        
        const testUrl = `https://graph.facebook.com/v23.0/${solvifyPageId}?fields=id,name,${fields}&access_token=${solvifyPageToken}&appsecret_proof=${appsecretProof}`;
        
        const testResponse = await fetch(testUrl);
        const testData = await testResponse.json();

        results.tests.push({
          test: `Page Token Field Test: ${fields}`,
          status: testResponse.status,
          success: testResponse.ok,
          data: testData,
          hasInstagramData: !!(testData.instagram_business_account || testData.connected_instagram_account),
          instagramData: testData.instagram_business_account || testData.connected_instagram_account || null,
          url: testUrl.replace(solvifyPageToken, 'PAGE_ACCESS_TOKEN').replace(appsecretProof, 'APPSECRET_PROOF')
        });
      } catch (error) {
        results.tests.push({
          test: `Page Token Field Test: ${fields}`,
          status: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Test 3: Check what the page token can access
    try {
      console.log('[Page Token Test] Checking page token capabilities...');
      
      const capUrl = `https://graph.facebook.com/v23.0/${solvifyPageId}?fields=id,name,category,about,website,phone,emails,location,hours,fan_count,access_token&access_token=${solvifyPageToken}&appsecret_proof=${appsecretProof}`;
      
      const capResponse = await fetch(capUrl);
      const capData = await capResponse.json();

      results.tests.push({
        test: 'Page Token Capabilities',
        status: capResponse.status,
        success: capResponse.ok,
        data: capData,
        url: capUrl.replace(solvifyPageToken, 'PAGE_ACCESS_TOKEN').replace(appsecretProof, 'APPSECRET_PROOF')
      });
    } catch (error) {
      results.tests.push({
        test: 'Page Token Capabilities',
        status: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    console.log('[Page Token Test] Test completed:', {
      testsRun: results.tests.length,
      instagramFound: results.tests.some(t => t.hasInstagramAccount || t.hasInstagramData)
    });

    return NextResponse.json(results);

  } catch (error) {
    console.error('[Page Token Test] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to perform page token test',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 