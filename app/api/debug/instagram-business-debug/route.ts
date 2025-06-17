import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  console.log('=== INSTAGRAM BUSINESS DEBUG START ===');

  try {
    // 1. Get the user's personal Facebook token
    const { data: personalAccount, error: dbError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('platform', 'facebook')
      .not('account_name', 'like', '%(Page)')
      .single();

    if (dbError || !personalAccount) {
      return NextResponse.json({ 
        error: 'No personal Facebook account found',
        details: 'Please connect Facebook first'
      }, { status: 400 });
    }

    console.log('Found personal Facebook account:', personalAccount.account_name);

    // 2. Get app secret and create appsecret_proof
    const appSecret = process.env.META_CLIENT_SECRET || process.env.FACEBOOK_CLIENT_SECRET || process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) {
      return NextResponse.json({ error: 'Missing Facebook app secret' }, { status: 400 });
    }

    const appsecret_proof = crypto
      .createHmac('sha256', appSecret)
      .update(personalAccount.access_token)
      .digest('hex');

    const results: Array<any> = [];

    // 3. Test multiple Instagram Business API calls
    const tests = [
      {
        name: 'Basic Pages with Instagram Fields',
        url: `https://graph.facebook.com/v23.0/me/accounts?fields=id,name,instagram_business_account&access_token=${personalAccount.access_token}&appsecret_proof=${appsecret_proof}`
      },
      {
        name: 'Extended Instagram Business Info',
        url: `https://graph.facebook.com/v23.0/me/accounts?fields=id,name,instagram_business_account{id,name,username,profile_picture_url}&access_token=${personalAccount.access_token}&appsecret_proof=${appsecret_proof}`
      },
      {
        name: 'All Instagram Related Fields',
        url: `https://graph.facebook.com/v23.0/me/accounts?fields=id,name,instagram_business_account,instagram_business_account{id,name,username,biography,website,profile_picture_url,followers_count,media_count}&access_token=${personalAccount.access_token}&appsecret_proof=${appsecret_proof}`
      },
      {
        name: 'Check User Instagram Accounts Direct',
        url: `https://graph.facebook.com/v23.0/me?fields=id,name,accounts{id,name,instagram_business_account}&access_token=${personalAccount.access_token}&appsecret_proof=${appsecret_proof}`
      }
    ];

    for (const test of tests) {
      console.log(`Running test: ${test.name}`);
      console.log(`URL: ${test.url.replace(personalAccount.access_token, '[REDACTED]')}`);
      
      try {
        const response = await fetch(test.url);
        const data = await response.json();
        
                 results.push({
           test_name: test.name,
           status: response.status,
           success: response.ok,
           data: data,
           instagram_accounts_found: countInstagramAccounts(data),
           pages_with_instagram: findPagesWithInstagram(data)
         });
         
         console.log(`${test.name} - Status: ${response.status}, Instagram accounts: ${countInstagramAccounts(data)}`);
      } catch (error: any) {
        console.error(`${test.name} failed:`, error);
        results.push({
          test_name: test.name,
          status: 'error',
          success: false,
          error: error.message
        });
      }
    }

    // 4. Test specific page Instagram access
    console.log('Testing individual page Instagram access...');
    const pageTests: Array<any> = [];
    
    // Get known page IDs from our earlier debug
    const knownPageIds = ['634834979708871', '558689663991640', '404693982720803', '651917638752524'];
    
    for (const pageId of knownPageIds) {
      try {
        const pageInstagramUrl = `https://graph.facebook.com/v23.0/${pageId}?fields=id,name,instagram_business_account{id,name,username}&access_token=${personalAccount.access_token}&appsecret_proof=${appsecret_proof}`;
        
        console.log(`Testing page ${pageId} for Instagram account`);
        const response = await fetch(pageInstagramUrl);
        const data = await response.json();
        
        pageTests.push({
          page_id: pageId,
          status: response.status,
          success: response.ok,
          data: data,
          has_instagram: !!data.instagram_business_account
        });
        
        if (data.instagram_business_account) {
          console.log(`✅ Page ${pageId} HAS Instagram Business Account:`, data.instagram_business_account);
        } else {
          console.log(`❌ Page ${pageId} has NO Instagram Business Account`);
        }
      } catch (error: any) {
        console.error(`Error testing page ${pageId}:`, error);
        pageTests.push({
          page_id: pageId,
          status: 'error',
          success: false,
          error: error.message
        });
      }
    }

    // 5. Summary and analysis
    const totalInstagramAccounts = results.reduce((sum, result) => sum + (result.instagram_accounts_found || 0), 0);
    const pagesWithInstagram = results.reduce((sum, result) => sum + (result.pages_with_instagram?.length || 0), 0);

    console.log('=== INSTAGRAM BUSINESS DEBUG COMPLETE ===');
    console.log(`Total Instagram accounts found: ${totalInstagramAccounts}`);
    console.log(`Pages with Instagram: ${pagesWithInstagram}`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      user_id: session.user.id,
      personal_account: {
        account_id: personalAccount.account_id,
        account_name: personalAccount.account_name,
        token_length: personalAccount.access_token.length
      },
      summary: {
        total_tests: results.length,
        total_instagram_accounts_found: totalInstagramAccounts,
        pages_with_instagram: pagesWithInstagram,
        individual_page_tests: pageTests.length
      },
      api_tests: results,
      individual_page_tests: pageTests,
             analysis: {
         likely_issues: analyzeResults(results, pageTests),
         next_steps: getNextSteps(results, pageTests)
       }
    });

  } catch (error: any) {
    console.error('Instagram Business Debug error:', error);
    return NextResponse.json({ 
      error: 'Failed to debug Instagram Business accounts', 
      details: error.message,
      stack: error.stack 
    }, { status: 500 });
  }

  // Helper methods
  function countInstagramAccounts(data: any): number {
    if (!data?.data) return 0;
    return data.data.filter((page: any) => page.instagram_business_account).length;
  }

  function findPagesWithInstagram(data: any): Array<any> {
    if (!data?.data) return [];
    return data.data.filter((page: any) => page.instagram_business_account)
      .map((page: any) => ({
        page_id: page.id,
        page_name: page.name,
        instagram_id: page.instagram_business_account?.id,
        instagram_username: page.instagram_business_account?.username
      }));
  }

  function analyzeResults(results: Array<any>, pageTests: Array<any>): Array<string> {
    const issues: Array<string> = [];
    
    const totalInstagram = results.reduce((sum, r) => sum + (r.instagram_accounts_found || 0), 0);
    if (totalInstagram === 0) {
      issues.push("No Instagram Business accounts found in any API call");
    }
    
    const failedTests = results.filter(r => !r.success);
    if (failedTests.length > 0) {
      issues.push(`${failedTests.length} API tests failed`);
    }
    
    const pagesWithoutInstagram = pageTests.filter(pt => pt.success && !pt.has_instagram);
    if (pagesWithoutInstagram.length > 0) {
      issues.push(`${pagesWithoutInstagram.length} Facebook pages have no connected Instagram Business account`);
    }
    
    return issues;
  }

  function getNextSteps(results: Array<any>, pageTests: Array<any>): Array<string> {
    const steps: Array<string> = [];
    
    const totalInstagram = results.reduce((sum, r) => sum + (r.instagram_accounts_found || 0), 0);
    if (totalInstagram === 0) {
      steps.push("Connect Instagram Business accounts to your Facebook pages in Facebook Business Manager");
      steps.push("Ensure Facebook pages are linked to Instagram Business (not personal) accounts");
      steps.push("Request business_management and pages_manage_posts permissions");
    } else {
      steps.push("Instagram Business accounts found - check why they're not being saved to database");
      steps.push("Review Instagram OAuth callback logic");
    }
    
    return steps;
  }
} 