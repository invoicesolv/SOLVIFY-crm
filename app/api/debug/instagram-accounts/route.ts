import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface DebugResult {
  facebookAccount: {
    account_id: string;
    account_name: string;
    token_length?: number;
    expires_at?: string;
    error?: string;
  };
  userInfo?: any;
  test1_basic_instagram?: {
    url: string;
    status: number;
    data: any;
  };
  test2_extended_instagram?: {
    url: string;
    status: number;
    data: any;
  };
  test3_all_fields?: {
    url: string;
    status: number;
    data: any;
  };
  instagramAnalysis?: {
    test1_pages_with_instagram: any[];
    test2_pages_with_instagram: any[];
    test3_pages_with_instagram: any[];
    test1_total_pages: number;
    test2_total_pages: number;
    test3_total_pages: number;
  };
  error?: string;
}

export async function GET(request: NextRequest) {
  console.log('Instagram Debug: Starting...');
  
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // Get Facebook access tokens for this user
    const { data: facebookAccounts, error: dbError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('platform', 'facebook')
      .eq('is_connected', true);

    if (dbError) {
      console.error('Instagram Debug: Database error:', dbError);
      return NextResponse.json({ error: 'Database error', details: dbError }, { status: 500 });
    }

    if (!facebookAccounts || facebookAccounts.length === 0) {
      return NextResponse.json({ 
        error: 'No Facebook accounts found', 
        message: 'You need to connect Facebook first to access Instagram Business accounts' 
      }, { status: 404 });
    }

    const results: DebugResult[] = [];

    // Check environment variables
    const appSecret = process.env.META_CLIENT_SECRET || process.env.FACEBOOK_CLIENT_SECRET || process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) {
      return NextResponse.json({ 
        error: 'Missing app secret', 
        message: 'META_CLIENT_SECRET, FACEBOOK_CLIENT_SECRET, or FACEBOOK_APP_SECRET is required' 
      }, { status: 500 });
    }

    for (const account of facebookAccounts) {
      console.log(`Instagram Debug: Checking account ${account.account_name} (${account.account_id})`);
      
      // Generate appsecret_proof
      const appsecretProof = crypto.createHmac('sha256', appSecret).update(account.access_token).digest('hex');

      try {
        // Test 1: Get basic account info
        const userUrl = new URL('https://graph.facebook.com/v23.0/me');
        userUrl.searchParams.set('fields', 'id,name');
        userUrl.searchParams.set('access_token', account.access_token);
        userUrl.searchParams.set('appsecret_proof', appsecretProof);

        const userResponse = await fetch(userUrl.toString());
        const userData = await userResponse.json();

        // Test 2: Get pages with Instagram info (multiple field variations)
        const pagesUrl1 = new URL('https://graph.facebook.com/v23.0/me/accounts');
        pagesUrl1.searchParams.set('fields', 'id,name,instagram_business_account');
        pagesUrl1.searchParams.set('access_token', account.access_token);
        pagesUrl1.searchParams.set('appsecret_proof', appsecretProof);

        const pagesResponse1 = await fetch(pagesUrl1.toString());
        const pagesData1 = await pagesResponse1.json();

        // Test 3: Get pages with extended Instagram fields
        const pagesUrl2 = new URL('https://graph.facebook.com/v23.0/me/accounts');
        pagesUrl2.searchParams.set('fields', 'id,name,instagram_business_account{id,name,username,profile_picture_url}');
        pagesUrl2.searchParams.set('access_token', account.access_token);
        pagesUrl2.searchParams.set('appsecret_proof', appsecretProof);

        const pagesResponse2 = await fetch(pagesUrl2.toString());
        const pagesData2 = await pagesResponse2.json();

        // Test 4: Get pages with all available fields
        const pagesUrl3 = new URL('https://graph.facebook.com/v23.0/me/accounts');
        pagesUrl3.searchParams.set('fields', 'id,name,access_token,category,category_list,instagram_business_account,tasks');
        pagesUrl3.searchParams.set('access_token', account.access_token);
        pagesUrl3.searchParams.set('appsecret_proof', appsecretProof);

        const pagesResponse3 = await fetch(pagesUrl3.toString());
        const pagesData3 = await pagesResponse3.json();

        results.push({
          facebookAccount: {
            account_id: account.account_id,
            account_name: account.account_name,
            token_length: account.access_token.length,
            expires_at: account.token_expires_at
          },
          userInfo: userData,
          test1_basic_instagram: {
            url: pagesUrl1.toString().replace(account.access_token, '[REDACTED]'),
            status: pagesResponse1.status,
            data: pagesData1
          },
          test2_extended_instagram: {
            url: pagesUrl2.toString().replace(account.access_token, '[REDACTED]'),
            status: pagesResponse2.status,
            data: pagesData2
          },
          test3_all_fields: {
            url: pagesUrl3.toString().replace(account.access_token, '[REDACTED]'),
            status: pagesResponse3.status,
            data: pagesData3
          },
          instagramAnalysis: {
            test1_pages_with_instagram: pagesData1.data?.filter((page: any) => page.instagram_business_account) || [],
            test2_pages_with_instagram: pagesData2.data?.filter((page: any) => page.instagram_business_account) || [],
            test3_pages_with_instagram: pagesData3.data?.filter((page: any) => page.instagram_business_account) || [],
            test1_total_pages: pagesData1.data?.length || 0,
            test2_total_pages: pagesData2.data?.length || 0,
            test3_total_pages: pagesData3.data?.length || 0
          }
        });

      } catch (fetchError) {
        console.error(`Instagram Debug: Error fetching data for account ${account.account_id}:`, fetchError);
        results.push({
          facebookAccount: {
            account_id: account.account_id,
            account_name: account.account_name,
            error: 'Failed to fetch data'
          },
          error: fetchError instanceof Error ? fetchError.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalFacebookAccounts: facebookAccounts.length,
      environment: {
        hasMetaClientSecret: !!process.env.META_CLIENT_SECRET,
        hasFacebookClientSecret: !!process.env.FACEBOOK_CLIENT_SECRET,
        hasFacebookAppSecret: !!process.env.FACEBOOK_APP_SECRET,
        hasFacebookAppId: !!process.env.FACEBOOK_APP_ID
      },
      results
    });

  } catch (error) {
    console.error('Instagram Debug: Error:', error);
    return NextResponse.json({ 
      error: 'Debug failed', 
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 