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

    console.log('[Facebook Live Test] Starting comprehensive Instagram API test for user:', session.user.id);

    // Get existing Facebook accounts from social_accounts table
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
      message: 'Comprehensive Instagram API test completed',
      instagramAccounts: [] as any[],
      apiResponses: [] as any[],
      troubleshooting: [] as string[],
      debug: {
        userId: session.user.id,
        facebookAccountId: fbAccount.id,
        timestamp: new Date().toISOString()
      }
    };

    // Test 1: Check current user permissions
    try {
      const permissionsUrl = `https://graph.facebook.com/v23.0/me/permissions?access_token=${accessToken}&appsecret_proof=${appsecretProof}`;
      
      console.log('[Facebook Live Test] Checking user permissions...');
      const permissionsResponse = await fetch(permissionsUrl);
      const permissionsData = await permissionsResponse.json();

      results.apiResponses.push({
        endpoint: 'User Permissions',
        status: permissionsResponse.status,
        success: permissionsResponse.ok,
        data: permissionsData,
        url: permissionsUrl.replace(accessToken, 'ACCESS_TOKEN').replace(appsecretProof, 'APPSECRET_PROOF')
      });

      if (permissionsResponse.ok && permissionsData.data) {
        const grantedPermissions = permissionsData.data
          .filter((p: any) => p.status === 'granted')
          .map((p: any) => p.permission);
        
        const requiredPermissions = [
          'business_management',
          'pages_show_list', 
          'pages_read_engagement',
          'pages_read_user_content',
          'instagram_basic'
        ];

        const missingPermissions = requiredPermissions.filter(p => !grantedPermissions.includes(p));
        
        if (missingPermissions.length > 0) {
          results.troubleshooting.push(`❌ Missing required permissions: ${missingPermissions.join(', ')}`);
          results.troubleshooting.push('💡 Solution: Reconnect Facebook with all required permissions');
        } else {
          results.troubleshooting.push('✅ All required permissions granted');
        }
      }
    } catch (error) {
      results.apiResponses.push({
        endpoint: 'User Permissions',
        status: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Test 2: Get Facebook pages with detailed Instagram fields
    let pages: any[] = [];
    try {
      const pagesUrl = `https://graph.facebook.com/v23.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,followers_count,media_count,profile_picture_url,biography}&access_token=${accessToken}&appsecret_proof=${appsecretProof}`;
      
      console.log('[Facebook Live Test] Fetching pages with Instagram accounts...');
      const pagesResponse = await fetch(pagesUrl);
      const pagesData = await pagesResponse.json();

      results.apiResponses.push({
        endpoint: 'Facebook Pages with Instagram',
        status: pagesResponse.status,
        success: pagesResponse.ok,
        data: pagesData,
        url: pagesUrl.replace(accessToken, 'ACCESS_TOKEN').replace(appsecretProof, 'APPSECRET_PROOF')
      });

      if (pagesResponse.ok && pagesData.data) {
        pages = pagesData.data;
        console.log('[Facebook Live Test] Found pages:', pages.length);
        
        let pagesWithInstagram = 0;
        for (const page of pages) {
          if (page.instagram_business_account) {
            pagesWithInstagram++;
            const igAccount = page.instagram_business_account;
            results.instagramAccounts.push({
              id: igAccount.id,
              username: igAccount.username,
              name: igAccount.name,
              followers_count: igAccount.followers_count,
              media_count: igAccount.media_count,
              profile_picture_url: igAccount.profile_picture_url,
              biography: igAccount.biography,
              connected_facebook_page: {
                id: page.id,
                name: page.name
              }
            });
          }
        }

        if (pagesWithInstagram === 0) {
          results.troubleshooting.push(`❌ Found ${pages.length} Facebook Pages but NONE have Instagram Business accounts connected`);
          results.troubleshooting.push('💡 This means the Instagram account is not properly linked to any Facebook Page at the API level');
        } else {
          results.troubleshooting.push(`✅ Found ${pagesWithInstagram} Facebook Pages with Instagram Business accounts`);
        }
      }
    } catch (error) {
      results.apiResponses.push({
        endpoint: 'Facebook Pages with Instagram',
        status: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Test 3: Check each page individually for Instagram connection
    for (const page of pages) {
      try {
        const pageUrl = `https://graph.facebook.com/v23.0/${page.id}?fields=id,name,instagram_business_account{id,username,name}&access_token=${accessToken}&appsecret_proof=${appsecretProof}`;
        
        console.log(`[Facebook Live Test] Checking page ${page.name} for Instagram connection...`);
        const pageResponse = await fetch(pageUrl);
        const pageData = await pageResponse.json();

        results.apiResponses.push({
          endpoint: `Page Check: ${page.name}`,
          status: pageResponse.status,
          success: pageResponse.ok,
          data: pageData,
          url: pageUrl.replace(accessToken, 'ACCESS_TOKEN').replace(appsecretProof, 'APPSECRET_PROOF')
        });

        if (pageResponse.ok && pageData.instagram_business_account) {
          // This should have been caught above, but double-check
          const igAccount = pageData.instagram_business_account;
          if (!results.instagramAccounts.find(acc => acc.id === igAccount.id)) {
            results.instagramAccounts.push({
              id: igAccount.id,
              username: igAccount.username,
              name: igAccount.name,
              connected_facebook_page: {
                id: page.id,
                name: page.name
              },
              source: 'individual_page_check'
            });
          }
        }
      } catch (error) {
        results.apiResponses.push({
          endpoint: `Page Check: ${page.name}`,
          status: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Test 4: Try alternative Instagram discovery methods
    const alternativeMethods = [
      {
        name: 'Direct Instagram Accounts (will fail)',
        url: `https://graph.facebook.com/v23.0/me/instagram_accounts?access_token=${accessToken}&appsecret_proof=${appsecretProof}`
      }
    ];

    for (const method of alternativeMethods) {
      try {
        console.log(`[Facebook Live Test] Testing ${method.name}...`);
        const response = await fetch(method.url);
        const data = await response.json();

        results.apiResponses.push({
          endpoint: method.name,
          status: response.status,
          success: response.ok,
          data: data,
          url: method.url.replace(accessToken, 'ACCESS_TOKEN').replace(appsecretProof, 'APPSECRET_PROOF')
        });
      } catch (error) {
        results.apiResponses.push({
          endpoint: method.name,
          status: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Add comprehensive troubleshooting based on results
    if (results.instagramAccounts.length === 0) {
      results.troubleshooting.push('');
      results.troubleshooting.push('🔍 DIAGNOSIS: Instagram Business account not connected to Facebook Pages');
      results.troubleshooting.push('');
      results.troubleshooting.push('📋 SOLUTIONS TO TRY:');
      results.troubleshooting.push('1. Go to Meta Business Suite (business.facebook.com)');
      results.troubleshooting.push('2. Navigate to Settings > Business Assets > Instagram accounts');
      results.troubleshooting.push('3. Find your Instagram account "solvifysearch"');
      results.troubleshooting.push('4. Click "Connect to Page" and select one of your Facebook Pages');
      results.troubleshooting.push('5. Make sure the connection shows "Connected" status');
      results.troubleshooting.push('');
      results.troubleshooting.push('🔄 ALTERNATIVE SOLUTION:');
      results.troubleshooting.push('1. Go to Instagram app > Settings > Business tools and controls');
      results.troubleshooting.push('2. Tap "Connect to Facebook Page"');
      results.troubleshooting.push('3. Select one of your Facebook Pages to connect to');
      results.troubleshooting.push('');
      results.troubleshooting.push('⚠️  IMPORTANT: The Instagram account must be connected to a Facebook PAGE, not just your personal Facebook profile');
    }

    // Update success status based on results
    if (results.instagramAccounts.length === 0) {
      results.success = false;
      results.message = 'No Instagram Business accounts found - connection issue detected';
    } else {
      results.message = `Found ${results.instagramAccounts.length} Instagram Business account(s)`;
    }

    console.log('[Facebook Live Test] Comprehensive test completed:', {
      instagramAccountsFound: results.instagramAccounts.length,
      apiCallsMade: results.apiResponses.length,
      troubleshootingSteps: results.troubleshooting.length
    });

    return NextResponse.json(results);

  } catch (error) {
    console.error('[Facebook Live Test] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to perform comprehensive Instagram API test',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 