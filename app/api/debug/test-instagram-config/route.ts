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

  console.log('=== TESTING INSTAGRAM CONFIGURATION ===');

  try {
    // Get the user's personal Facebook token
    const { data: personalAccount, error: dbError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('platform', 'facebook')
      .not('account_name', 'like', '%(Page)%')
      .single();

    if (dbError || !personalAccount) {
      return NextResponse.json({ error: 'No Facebook personal account found' }, { status: 404 });
    }

    // Get app secret for appsecret_proof
    const appSecret = process.env.META_CLIENT_SECRET || process.env.FACEBOOK_CLIENT_SECRET || process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) {
      return NextResponse.json({ error: 'Missing app secret' }, { status: 500 });
    }

    // Generate appsecret_proof
    const appsecretProof = crypto.createHmac('sha256', appSecret).update(personalAccount.access_token).digest('hex');

    // Test 1: Try accessing Instagram Business accounts directly with existing token
    console.log('Test 1: Direct Instagram Business account access');
    const directUrl = new URL('https://graph.facebook.com/v23.0/me/accounts');
    directUrl.searchParams.set('fields', 'id,name,instagram_business_account{id,name,username}');
    directUrl.searchParams.set('access_token', personalAccount.access_token);
    directUrl.searchParams.set('appsecret_proof', appsecretProof);

    const directResponse = await fetch(directUrl.toString());
    const directData = await directResponse.json();

    // Test 2: Check what permissions we actually have
    console.log('Test 2: Check token permissions');
    const permissionsUrl = new URL('https://graph.facebook.com/v23.0/me/permissions');
    permissionsUrl.searchParams.set('access_token', personalAccount.access_token);
    permissionsUrl.searchParams.set('appsecret_proof', appsecretProof);

    const permissionsResponse = await fetch(permissionsUrl.toString());
    const permissionsData = await permissionsResponse.json();

    // Test 3: Try to get pages with specific Instagram fields
    console.log('Test 3: Get pages with Instagram account info');
    const pagesUrl = new URL('https://graph.facebook.com/v23.0/me/accounts');
    pagesUrl.searchParams.set('fields', 'id,name,instagram_business_account');
    pagesUrl.searchParams.set('access_token', personalAccount.access_token);
    pagesUrl.searchParams.set('appsecret_proof', appsecretProof);

    const pagesResponse = await fetch(pagesUrl.toString());
    const pagesData = await pagesResponse.json();

    // Test 4: Try using your Instagram configuration ID directly
    console.log('Test 4: Check if we can use Instagram configuration ID');
    const configId = '640826611749404'; // Your Instagram configuration ID
    const configUrl = new URL(`https://graph.facebook.com/v23.0/${configId}`);
    configUrl.searchParams.set('fields', 'id,name');
    configUrl.searchParams.set('access_token', personalAccount.access_token);
    configUrl.searchParams.set('appsecret_proof', appsecretProof);

    const configResponse = await fetch(configUrl.toString());
    const configData = await configResponse.json();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      token_info: {
        user_id: personalAccount.account_id,
        token_length: personalAccount.access_token.length,
        account_name: personalAccount.account_name
      },
      tests: {
        test1_direct_instagram: {
          url: directUrl.toString().replace(personalAccount.access_token, '[REDACTED]'),
          status: directResponse.status,
          success: directResponse.ok,
          data: directData
        },
        test2_permissions: {
          url: permissionsUrl.toString().replace(personalAccount.access_token, '[REDACTED]'),
          status: permissionsResponse.status,
          success: permissionsResponse.ok,
          data: permissionsData
        },
        test3_pages_instagram: {
          url: pagesUrl.toString().replace(personalAccount.access_token, '[REDACTED]'),
          status: pagesResponse.status,
          success: pagesResponse.ok,
          data: pagesData
        },
        test4_config_access: {
          url: configUrl.toString().replace(personalAccount.access_token, '[REDACTED]'),
          status: configResponse.status,
          success: configResponse.ok,
          data: configData
        }
      },
      analysis: {
        instagram_accounts_found: (directData?.data || []).filter((page: any) => page.instagram_business_account).length,
        permissions_granted: permissionsData?.data?.filter((p: any) => p.status === 'granted')?.map((p: any) => p.permission) || [],
        business_management_granted: permissionsData?.data?.some((p: any) => p.permission === 'business_management' && p.status === 'granted'),
        pages_show_list_granted: permissionsData?.data?.some((p: any) => p.permission === 'pages_show_list' && p.status === 'granted'),
        pages_manage_posts_granted: permissionsData?.data?.some((p: any) => p.permission === 'pages_manage_posts' && p.status === 'granted'),
        next_steps: directData?.error ? [
          'Instagram configuration permissions may not be active',
          'Try reconnecting Facebook with Instagram Business permissions',
          'Ensure Instagram Business accounts are properly connected to Facebook pages'
        ] : []
      }
    });

  } catch (error) {
    console.error('Instagram configuration test error:', error);
    return NextResponse.json({ 
      error: 'Test failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 